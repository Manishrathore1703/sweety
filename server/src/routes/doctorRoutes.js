const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const reports = require("../controllers/doctorReportController");

const router = express.Router();
router.use(authenticateUser, authorizeRoles("doctor"));

router.get(
    "/patients/:patientId/reports/daily",
    reports.getDailyReport
);
router.get(
    "/patients/:patientId/reports/month-to-date",
    reports.getMonthToDateReport
);
router.get(
    "/patients/:patientId/reports/previous-month",
    reports.getPreviousMonthReport
);

module.exports = router;
