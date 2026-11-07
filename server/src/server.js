
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Sweety API is running",
    });
});

// Database connection test
app.get("/api/health", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT current_database(), NOW()"
        );

        res.status(200).json({
            success: true,
            message: "Database connected successfully",
            database: result.rows[0].current_database,
        });
    } catch (error) {
        console.error("Database health check failed:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed",
        });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Sweety API running on port ${PORT}`);
});
