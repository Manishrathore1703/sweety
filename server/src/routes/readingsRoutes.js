
const express = require("express");

const router = express.Router();

const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
    createReading,
    getReadings,
    getReadingById,
    updateReading,
    deleteReading,
} = require("../controllers/readingsController");

// All reading endpoints require patient authentication.
router.use(authenticateUser);
router.use(authorizeRoles("patient"));

router.post("/", createReading);
router.get("/", getReadings);
router.get("/:id", getReadingById);
router.put("/:id", updateReading);
router.delete("/:id", deleteReading);

module.exports = router;
