# Sweety API contract

Base URL: `http://localhost:5001`. All request and response bodies use JSON.
Protected endpoints require `Authorization: Bearer <JWT>`. Responses use
`{ "success": true, ... }` on success and
`{ "success": false, "message": "..." }` on errors. Validation errors may
include an `errors` array.

## Authentication

| Method and path | Auth / role | Inputs | Success | Common errors |
|---|---|---|---|---|
| `POST /api/auth/register` | Public | `{name,email,password,role}`; doctor additionally sends `doctor_registration_code` | 201 `{success,message,token,user}` | 400 invalid/missing fields; 403 invalid/missing doctor code; 409 duplicate email |
| `POST /api/auth/login` | Public | `{email,password}` | 200 `{success,message,token,user}` | 400 invalid/missing fields; 401 invalid credentials |
| `GET /api/auth/me` | Bearer JWT | None | 200 `{success,user}` | 401 missing/invalid/expired token; 404 user no longer exists |

`role` is `patient` or `doctor`; names and emails must be nonempty and email
must have valid syntax; password must contain at least eight characters. Email
comparison is case-insensitive. Password hashes are never returned.

## Readings and patient reports

| Method and path | Auth / role | Inputs | Success | Common errors |
|---|---|---|---|---|
| `POST /api/readings` | Patient | `{reading_date,time_slot,glucose_value}` | 201 `{success,message,reading}` | 400 invalid reading/future date; 401 unauthenticated; 403 wrong role; 409 duplicate date/slot |
| `GET /api/readings` | Patient | Optional query `date`, `page` (default 1), `limit` (default 10, max 100) | 200 `{success,count,pagination,readings}` | 400 invalid date or pagination; 401; 403 |
| `GET /api/readings/:id` | Patient | Positive BIGINT reading ID | 200 `{success,reading}` | 400 invalid ID; 401; 403; 404 not found/not owned |
| `PUT /api/readings/:id` | Patient | `{reading_date,time_slot,glucose_value}` | 200 `{success,message,reading}` | 400 invalid reading/future date/ID; 401; 403; 404; 409 duplicate slot |
| `DELETE /api/readings/:id` | Patient | Positive BIGINT reading ID | 200 `{success,message}` | 400 invalid ID; 401; 403; 404 not found/not owned |
| `GET /api/reports/daily?date=YYYY-MM-DD` | Patient | Required valid nonfuture date | 200 `{success,report:{period,statistics,readings}}` | 400 invalid/future date; 401; 403 |
| `GET /api/reports/month-to-date?date=YYYY-MM-DD` | Patient | Required valid nonfuture date | 200 `{success,report:{period,statistics}}` | 400 invalid/future date; 401; 403 |
| `GET /api/reports/previous-month?date=YYYY-MM-DD` | Patient | Required valid nonfuture date | 200 `{success,report:{period,statistics}}` | 400 invalid/future date; 401; 403 |

Reading dates must be real `YYYY-MM-DD` calendar dates. `time_slot` is one of
`morning_fasting`, `after_breakfast`, `after_lunch`, or `after_dinner`.
`glucose_value` is an integer from 40 through 600. A unique database key on
patient, date, and slot plus four allowed slots limits the day to four readings.
Daily report readings are ordered by slot. Month-to-date includes the first
through selected day; previous-month covers the full previous calendar month.
Empty statistics have null maximum, minimum, and average, and count zero.

## Search

| Method and path | Auth / role | Inputs | Success | Common errors |
|---|---|---|---|---|
| `GET /api/patients/search?email=...` | Doctor | Required email query | 200 `{success,patient}`; `patient` is null when absent | 400 invalid/missing email; 401; 403 |
| `GET /api/doctors/search?email=...` | Patient | Required email query | 200 `{success,doctor}`; `doctor` is null when absent | 400 invalid/missing email; 401; 403 |

Search matches exact email case-insensitively and only returns id, name, email,
and role. It does not expose readings or password hashes.

## Connection requests

| Method and path | Auth / role | Inputs | Success | Common errors |
|---|---|---|---|---|
| `POST /api/doctor-requests` | Patient or doctor | Patient sends `{doctor_email}`; doctor sends `{patient_email}` | 201 `{success,message,request}` | 400 invalid email; 401; 403 wrong role; 404 target/role not found; 409 active assignment or duplicate pending request |
| `GET /api/doctor-requests/sent` | Patient or doctor | None | 200 `{success,requests}` | 401; 403 |
| `GET /api/doctor-requests/received` | Patient or doctor | None | 200 `{success,requests}` | 401; 403 |
| `PATCH /api/doctor-requests/:id/accept` | Intended recipient | Positive BIGINT request ID | 200 `{success,message,request}` | 400 invalid ID; 401; 403 wrong party; 404; 409 not pending/active assignment conflict |
| `PATCH /api/doctor-requests/:id/reject` | Intended recipient | Positive BIGINT request ID | 200 `{success,message,request}` | 400 invalid ID; 401; 403 wrong party; 404; 409 not pending |
| `PATCH /api/doctor-requests/:id/cancel` | Initiator | Positive BIGINT request ID | 200 `{success,message,request}` | 400 invalid ID; 401; 403 wrong party; 404; 409 not pending |

Status values are `pending`, `accepted`, `rejected`, and `cancelled`. Request
creation derives sender, recipient, and initiator from the authenticated user;
client-supplied IDs/status are ignored. Only the recipient accepts/rejects;
only the initiator cancels. Rejected/cancelled requests do not create an
assignment. Accepting creates an active assignment transactionally.

## Assignments and doctor reports

| Method and path | Auth / role | Inputs | Success | Common errors |
|---|---|---|---|---|
| `GET /api/doctor/patients` | Doctor | None | 200 `{success,patients}` active assignments only | 401; 403 |
| `GET /api/doctor/assignments/history` | Doctor | None | 200 `{success,assignments}` active and ended history | 401; 403 |
| `POST /api/doctor/assignments/:id/end` | Owning doctor | Positive BIGINT assignment ID | 200 `{success,message,assignment}` | 400 invalid ID; 401; 403; 404 not found/not owned; 409 already ended |
| `GET /api/doctor/patients/:patientId/reports/daily?date=YYYY-MM-DD` | Doctor with active assignment | Patient ID and required valid nonfuture date | 200 `{success,report:{period,statistics,readings}}` | 400 invalid ID/date; 401; 403 not assigned; 404 patient absent |
| `GET /api/doctor/patients/:patientId/reports/month-to-date?date=YYYY-MM-DD` | Doctor with active assignment | Patient ID and required valid nonfuture date | 200 `{success,report:{period,statistics}}` | 400 invalid ID/date; 401; 403 not assigned; 404 patient absent |
| `GET /api/doctor/patients/:patientId/reports/previous-month?date=YYYY-MM-DD` | Doctor with active assignment | Patient ID and required valid nonfuture date | 200 `{success,report:{period,statistics}}` | 400 invalid ID/date; 401; 403 not assigned; 404 patient absent |

Assignments have status `active` or `ended`; an active assignment has no
`ended_at`, while ended history is preserved with an end timestamp. Ending
revokes doctor report access immediately. Pending requests never authorize
report access.

## Infrastructure routes

| Method and path | Auth / role | Success |
|---|---|---|
| `GET /` | Public | 200 `{success,message}` |
| `GET /api/health` | Public | 200 `{success,message,database}` or 500 generic database failure |

CORS allows origins listed in the comma-separated `CLIENT_URL` environment
setting. The example configuration includes Vite's `http://localhost:5173` and
`http://127.0.0.1:5173`.
