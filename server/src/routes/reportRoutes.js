
const express = require("express");

const router = express.Router();

const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
    getDailyReport,
    getMonthToDateReport,
    getPreviousMonthReport,
} = require("../controllers/reportController");

// All report endpoints require patient authentication.
router.use(authenticateUser);
router.use(authorizeRoles("patient"));

router.get("/daily", getDailyReport);

router.get("/month-to-date", getMonthToDateReport);

router.get("/previous-month", getPreviousMonthReport);

module.exports = router;
