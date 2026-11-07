const pool = require("../config/db");
const { validateId } = require("../utils/readingValidation");
const HttpError = require("../utils/httpError");
const { hasActiveAssignment } = require("../services/doctorPatientService");
const { generateReport } = require("./reportController");

const resolveAssignedPatient = async (req) => {
    const { patientId } = req.params;

    if (!validateId(patientId)) {
        throw new HttpError(400, "Invalid patient ID");
    }

    const patient = await pool.query(
        "SELECT id FROM users WHERE id = $1 AND role = 'patient'",
        [patientId]
    );

    if (patient.rows.length === 0) {
        throw new HttpError(404, "Patient not found");
    }

    if (!(await hasActiveAssignment(req.user.id, patientId))) {
        throw new HttpError(403, "No active assignment for this patient");
    }

    return patientId;
};

module.exports = {
    getDailyReport: generateReport("daily", resolveAssignedPatient),
    getMonthToDateReport: generateReport("month-to-date", resolveAssignedPatient),
    getPreviousMonthReport: generateReport("previous-month", resolveAssignedPatient),
};
