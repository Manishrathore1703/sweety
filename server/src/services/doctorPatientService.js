const pool = require("../config/db");

const withTransaction = async (operation) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const result = await operation(client);
        if (result && result.error) {
            await client.query("ROLLBACK");
            return result;
        }
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const findUserByEmail = async (role, email) => {
    const result = await pool.query(
        `SELECT id, name, email, role
         FROM users
         WHERE LOWER(email) = $1 AND role = $2`,
        [email, role]
    );

    return result.rows[0] || null;
};

const createRequest = async (user, email) => withTransaction(async (client) => {
    const recipientRole = user.role === "doctor" ? "patient" : "doctor";
    const targetResult = await client.query(
        `SELECT id, role
         FROM users
         WHERE LOWER(email) = $1 AND role = $2`,
        [email, recipientRole]
    );

    if (targetResult.rows.length === 0) {
        return { error: "target-not-found" };
    }

    const targetId = targetResult.rows[0].id;
    const doctorId = user.role === "doctor" ? user.id : targetId;
    const patientId = user.role === "patient" ? user.id : targetId;

    await client.query(
        "SELECT id FROM users WHERE id = $1 FOR UPDATE",
        [patientId]
    );

    const assignment = await client.query(
        `SELECT id
         FROM doctor_patient_assignments
         WHERE patient_id = $1 AND status = 'active'`,
        [patientId]
    );

    if (assignment.rows.length > 0) {
        return { error: "patient-already-assigned" };
    }

    const pending = await client.query(
        `SELECT id
         FROM doctor_patient_requests
         WHERE doctor_id = $1 AND patient_id = $2 AND status = 'pending'`,
        [doctorId, patientId]
    );

    if (pending.rows.length > 0) {
        return { error: "request-already-pending" };
    }

    const inserted = await client.query(
        `INSERT INTO doctor_patient_requests
            (doctor_id, patient_id, initiated_by)
         VALUES ($1, $2, $3)
         RETURNING id, doctor_id, patient_id, initiated_by, status,
                   created_at, updated_at`,
        [doctorId, patientId, user.role]
    );

    return { request: inserted.rows[0] };
});

const listRequests = async (user, direction) => {
    const ownsInitiation = direction === "sent";
    const relevantColumn = user.role === "doctor" ? "doctor_id" : "patient_id";
    const where = ownsInitiation
        ? `r.initiated_by = $2 AND r.${relevantColumn} = $1`
        : `r.initiated_by <> $2 AND r.${relevantColumn} = $1`;

    const result = await pool.query(
        `SELECT r.id, r.initiated_by, r.status, r.created_at, r.updated_at,
                other.id AS other_user_id,
                other.name AS other_user_name,
                other.email AS other_user_email,
                other.role AS other_user_role
         FROM doctor_patient_requests r
         JOIN users other
           ON other.id = CASE WHEN r.doctor_id = $1
                              THEN r.patient_id ELSE r.doctor_id END
         WHERE ${where}
         ORDER BY r.created_at DESC, r.id DESC`,
        [user.id, user.role]
    );

    return result.rows;
};

const changeRequestStatus = async (user, requestId, action) =>
    withTransaction(async (client) => {
        const result = await client.query(
            `SELECT id, doctor_id, patient_id, initiated_by, status
             FROM doctor_patient_requests
             WHERE id = $1
             FOR UPDATE`,
            [requestId]
        );

        if (result.rows.length === 0) {
            return { error: "request-not-found" };
        }

        const request = result.rows[0];
        if (request.status !== "pending") {
            return { error: "request-not-pending" };
        }

        const isInitiator = request.initiated_by === user.role &&
            (user.role === "doctor"
                ? String(request.doctor_id) === String(user.id)
                : String(request.patient_id) === String(user.id));
        const recipientId = request.initiated_by === "doctor"
            ? request.patient_id
            : request.doctor_id;

        if (
            action === "cancel"
                ? !isInitiator
                : String(recipientId) !== String(user.id)
        ) {
            return { error: "not-authorized" };
        }

        if (action !== "accept") {
            const status = action === "reject" ? "rejected" : "cancelled";
            const updated = await client.query(
                `UPDATE doctor_patient_requests
                 SET status = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING id, doctor_id, patient_id, initiated_by, status,
                           created_at, updated_at`,
                [status, requestId]
            );
            return { request: updated.rows[0] };
        }

        await client.query(
            "SELECT id FROM users WHERE id = $1 FOR UPDATE",
            [request.patient_id]
        );

        const roles = await client.query(
            `SELECT id, role
             FROM users
             WHERE id = ANY($1::bigint[])`,
            [[request.doctor_id, request.patient_id]]
        );
        const roleById = new Map(roles.rows.map((row) => [String(row.id), row.role]));

        if (
            roleById.get(String(request.doctor_id)) !== "doctor" ||
            roleById.get(String(request.patient_id)) !== "patient"
        ) {
            return { error: "accounts-invalid" };
        }

        const activeAssignment = await client.query(
            `SELECT id
             FROM doctor_patient_assignments
             WHERE patient_id = $1 AND status = 'active'`,
            [request.patient_id]
        );

        if (activeAssignment.rows.length > 0) {
            return { error: "patient-already-assigned" };
        }

        await client.query(
            `INSERT INTO doctor_patient_assignments
                (doctor_id, patient_id, status)
             VALUES ($1, $2, 'active')`,
            [request.doctor_id, request.patient_id]
        );

        const updated = await client.query(
            `UPDATE doctor_patient_requests
             SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING id, doctor_id, patient_id, initiated_by, status,
                       created_at, updated_at`,
            [requestId]
        );

        return { request: updated.rows[0] };
    });

const getAssignments = async (doctorId, includeEnded) => {
    const statusFilter = includeEnded ? "" : "AND a.status = 'active'";
    const result = await pool.query(
        `SELECT a.id AS assignment_id, a.patient_id, u.name AS patient_name,
                u.email AS patient_email, a.status, a.assigned_at, a.ended_at
         FROM doctor_patient_assignments a
         JOIN users u ON u.id = a.patient_id AND u.role = 'patient'
         WHERE a.doctor_id = $1 ${statusFilter}
         ORDER BY a.assigned_at DESC, a.id DESC`,
        [doctorId]
    );

    return result.rows;
};

const endAssignment = async (doctorId, assignmentId) =>
    withTransaction(async (client) => {
        const result = await client.query(
            `SELECT id, status
             FROM doctor_patient_assignments
             WHERE id = $1 AND doctor_id = $2
             FOR UPDATE`,
            [assignmentId, doctorId]
        );

        if (result.rows.length === 0) {
            return { error: "assignment-not-found" };
        }

        if (result.rows[0].status !== "active") {
            return { error: "assignment-not-active" };
        }

        const updated = await client.query(
            `UPDATE doctor_patient_assignments
             SET status = 'ended', ended_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING id AS assignment_id, doctor_id, patient_id,
                       status, assigned_at, ended_at`,
            [assignmentId]
        );

        return { assignment: updated.rows[0] };
    });

const hasActiveAssignment = async (doctorId, patientId) => {
    const result = await pool.query(
        `SELECT 1
         FROM doctor_patient_assignments
         WHERE doctor_id = $1 AND patient_id = $2 AND status = 'active'`,
        [doctorId, patientId]
    );
    return result.rows.length > 0;
};

module.exports = {
    findUserByEmail,
    createRequest,
    listRequests,
    changeRequestStatus,
    getAssignments,
    endAssignment,
    hasActiveAssignment,
};
