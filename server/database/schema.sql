

CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL
        CHECK (role IN ('patient', 'doctor')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Emails are case-insensitive for uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
ON users (LOWER(email));


-- 2. GLUCOSE READINGS

CREATE TABLE IF NOT EXISTS readings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    reading_date DATE NOT NULL,

    time_slot VARCHAR(30) NOT NULL
        CHECK (
            time_slot IN (
                'morning_fasting',
                'after_breakfast',
                'after_lunch',
                'after_dinner'
            )
        ),

    glucose_value INTEGER NOT NULL
        CHECK (glucose_value BETWEEN 40 AND 600),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- One reading per slot per patient per day.
    UNIQUE (user_id, reading_date, time_slot)
);

CREATE INDEX IF NOT EXISTS readings_user_date_idx
ON readings (user_id, reading_date);


-- 3. DOCTOR-PATIENT REQUESTS
-- Supports invitations initiated by either side.

CREATE TABLE IF NOT EXISTS doctor_patient_requests (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    doctor_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    patient_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    initiated_by VARCHAR(20) NOT NULL
        CHECK (initiated_by IN ('doctor', 'patient')),

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'accepted',
                'rejected',
                'cancelled'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (doctor_id <> patient_id)
);

-- Prevent duplicate pending requests between the same doctor and patient.
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_doctor_patient_request
ON doctor_patient_requests (doctor_id, patient_id)
WHERE status = 'pending';

-- Prevent a patient from having multiple pending requests they initiated.
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_patient_request
ON doctor_patient_requests (patient_id)
WHERE status = 'pending' AND initiated_by = 'patient';

CREATE INDEX IF NOT EXISTS doctor_requests_sent_idx
ON doctor_patient_requests (doctor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS doctor_requests_received_idx
ON doctor_patient_requests (patient_id, created_at DESC);


-- 4. DOCTOR-PATIENT ASSIGNMENTS
-- Stores current and previous relationships.

CREATE TABLE IF NOT EXISTS doctor_patient_assignments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    doctor_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    patient_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'ended')),

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ,

    CHECK (doctor_id <> patient_id),

    CHECK (
        (status = 'active' AND ended_at IS NULL)
        OR
        (status = 'ended' AND ended_at IS NOT NULL)
    )
);

-- A patient can have only one active doctor.
-- A doctor can have multiple active patients.
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_doctor_per_patient
ON doctor_patient_assignments (patient_id)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS assignments_doctor_status_idx
ON doctor_patient_assignments (doctor_id, status);

CREATE INDEX IF NOT EXISTS assignments_patient_status_idx
ON doctor_patient_assignments (patient_id, status);
