
const express = require("express");

const router = express.Router();

const {
    register,
    login,
    getMe,
} = require("../controllers/authController");

const authenticateUser = require("../middleware/authMiddleware");

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected route
router.get("/me", authenticateUser, getMe);

module.exports = router;
