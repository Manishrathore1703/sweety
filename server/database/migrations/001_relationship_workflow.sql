-- Apply after the existing users/readings schema. Safe to rerun; preserves all rows.
CREATE TABLE IF NOT EXISTS doctor_patient_requests (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doctor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    initiated_by VARCHAR(20) NOT NULL
        CHECK (initiated_by IN ('doctor', 'patient')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (doctor_id <> patient_id)
);

CREATE TABLE IF NOT EXISTS doctor_patient_assignments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doctor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'ended')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ,
    CHECK (doctor_id <> patient_id),
    CHECK (
        (status = 'active' AND ended_at IS NULL)
        OR (status = 'ended' AND ended_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_doctor_patient_request
    ON doctor_patient_requests (doctor_id, patient_id)
    WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_patient_request
    ON doctor_patient_requests (patient_id)
    WHERE status = 'pending' AND initiated_by = 'patient';

CREATE INDEX IF NOT EXISTS doctor_requests_sent_idx
    ON doctor_patient_requests (doctor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS doctor_requests_received_idx
    ON doctor_patient_requests (patient_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_doctor_per_patient
    ON doctor_patient_assignments (patient_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS assignments_doctor_status_idx
    ON doctor_patient_assignments (doctor_id, status);

CREATE INDEX IF NOT EXISTS assignments_patient_status_idx
    ON doctor_patient_assignments (patient_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
    ON users (LOWER(email));

CREATE INDEX IF NOT EXISTS readings_user_date_idx
    ON readings (user_id, reading_date);
