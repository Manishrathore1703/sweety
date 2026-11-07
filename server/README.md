# Sweety backend

REST API for patient glucose tracking, doctor-patient connections, and glucose
reports. The backend uses CommonJS JavaScript, Express 5, PostgreSQL (`pg`),
JWT authentication, and bcrypt. Glucose data is treated as sensitive: user
search and connection endpoints return profile details only.

## Requirements and setup

- Node.js 20 or newer
- PostgreSQL 14 or newer

From `server/`:

```sh
npm install
createdb sweety
cp .env.example .env
```

Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in `.env`.
Set `JWT_SECRET` to a unique random secret (for example,
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
`CLIENT_URL` is a comma-separated allowlist of browser origins. Requests without
an `Origin` header (such as command-line clients) are allowed.

Apply the initial schema, then the incremental migration:

```sh
psql -d "$DB_NAME" -f database/schema.sql
psql -d "$DB_NAME" -f database/migrations/001_relationship_workflow.sql
```

These scripts are safe to rerun and do not drop tables or delete data. The
migration requires the `users` and `readings` tables from the initial schema.
Resolve any pre-existing duplicate rows if a unique index cannot be created;
the migration intentionally does not delete or rewrite user data.

Optional repeatable demo data:

```sh
npm run seed
```

Seed logins (passwords are demo-only; do not use in production):

| Role | Email | Password |
|---|---|---|
| Doctor | `doctor@example.com` | `DemoDoctor123!` |
| Patient | `patient1@example.com` | `DemoPatient123!` |
| Patient | `patient2@example.com` | `DemoPatient123!` |
| Patient | `patient3@example.com` | `DemoPatient123!` |

Start the API with `npm start` or use `npm run dev`. The default port is 5001;
set `PORT` to override it. `GET /api/health` checks the database connection.

## Structure

```text
database/
  migrations/       Incremental SQL migrations
  schema.sql        Idempotent initial schema
  seed.js           Repeatable bcrypt-hashed demo data
src/
  config/           PostgreSQL pool
  controllers/      HTTP request handling
  middleware/       JWT and role authorization
  routes/           API route mounting
  services/         Report and doctor-patient transactions
  utils/            Shared validation and HTTP errors
tests/              Jest unit and service tests
```

## Authentication and response format

Register with `POST /api/auth/register` using JSON:

```json
{
  "name": "Pat Example",
  "email": "pat@example.com",
  "password": "a-strong-password",
  "role": "patient"
}
```

Use the returned token as `Authorization: Bearer <token>`. Roles are
`patient` and `doctor`. Protected endpoints enforce roles on the server.
Successful responses have `success: true`; errors have `success: false` and a
clear `message`. Validation errors use HTTP 400, unauthenticated requests 401,
forbidden access 403, missing resources 404, and state/uniqueness conflicts 409.
Unexpected server errors return a generic 500 response without database detail.

## API endpoints

All bodies are JSON. Protected endpoints require a bearer token.

### Authentication

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Authenticated |

### Patient readings and reports

| Method | Path | Access |
|---|---|---|
| POST | `/api/readings` | Patient |
| GET | `/api/readings` | Patient; optional `date`, `page`, `limit` |
| GET | `/api/readings/:id` | Patient; own reading only |
| PUT | `/api/readings/:id` | Patient; own reading only |
| DELETE | `/api/readings/:id` | Patient; own reading only |
| GET | `/api/reports/daily?date=YYYY-MM-DD` | Patient |
| GET | `/api/reports/month-to-date?date=YYYY-MM-DD` | Patient |
| GET | `/api/reports/previous-month?date=YYYY-MM-DD` | Patient |

Reading dates must be real `YYYY-MM-DD` calendar dates and cannot be in the
future. Each reading must use one of `morning_fasting`, `after_breakfast`,
`after_lunch`, or `after_dinner`, with an integer glucose value from 40 to 600.
The unique date-and-slot constraint means no patient can create more than four
readings per day. Daily reports include readings ordered by time slot.
Month-to-date runs from the first of the selected month through the selected
date. Previous-month reports cover the complete month before the selected date.
Empty periods return null maximum/minimum/average and a zero count.

### Doctor search and patient search

| Method | Path | Access |
|---|---|---|
| GET | `/api/patients/search?email=...` | Doctor |
| GET | `/api/doctors/search?email=...` | Patient |

Searches are case-insensitive exact email matches. Results contain only safe
profile fields and never glucose readings or password hashes.

### Doctor-patient requests

| Method | Path | Access |
|---|---|---|
| POST | `/api/doctor-requests` | Doctor or patient |
| GET | `/api/doctor-requests/sent` | Doctor or patient |
| GET | `/api/doctor-requests/received` | Doctor or patient |
| PATCH | `/api/doctor-requests/:id/accept` | Intended recipient |
| PATCH | `/api/doctor-requests/:id/reject` | Intended recipient |
| PATCH | `/api/doctor-requests/:id/cancel` | Initiator |

A doctor sends `{ "patient_email": "patient@example.com" }`; a patient sends
`{ "doctor_email": "doctor@example.com" }`. A patient may have only one active
doctor. Duplicate pending requests and attempts to connect an already-assigned
patient return 409. Rejected and cancelled requests do not create assignments.
After a rejected or cancelled request, either party may initiate a new request.
The existing partial index permits a patient to have at most one pending
patient-initiated request at a time.

### Doctor assignments and reports

| Method | Path | Access |
|---|---|---|
| GET | `/api/doctor/patients` | Doctor |
| GET | `/api/doctor/assignments/history` | Doctor |
| POST | `/api/doctor/assignments/:id/end` | Owning doctor |
| GET | `/api/doctor/patients/:patientId/reports/daily?date=YYYY-MM-DD` | Assigned doctor |
| GET | `/api/doctor/patients/:patientId/reports/month-to-date?date=YYYY-MM-DD` | Assigned doctor |
| GET | `/api/doctor/patients/:patientId/reports/previous-month?date=YYYY-MM-DD` | Assigned doctor |

Only active assignments grant access to patient reports. Ending an assignment
preserves its history and immediately revokes report access. Request rows never
grant report access.

## Database integrity and migration behavior

The schema enforces case-insensitive unique emails, role and reading-value
checks, reading date/slot uniqueness, request status checks, and assignment
state consistency. A partial unique index allows only one active doctor per
patient while allowing a doctor to have multiple patients. Requests and
assignments reference users with foreign keys. Future dates are rejected by
application validation against PostgreSQL `CURRENT_DATE`; they are not encoded
as a time-dependent `CHECK` constraint.

Request acceptance locks the request row and patient row in a transaction,
validates both account roles and the current assignment state, then creates
the assignment and changes the request status before commit. The active
assignment unique index is the final safeguard against concurrent acceptance.

## Testing

Run the existing Jest suite:

```sh
npm test
```

The current suite covers date and reading validation, report date boundaries
and empty-period statistics, plus transaction locking, authorization, and
existing-assignment rejection in the connection workflow. Database-backed
end-to-end tests require a separately provisioned test database and are not
configured by this project yet.
