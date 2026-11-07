
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.JWT_SECRET) {
    throw new Error(
        "JWT_SECRET is required. Add a strong random secret to server/.env."
    );
}

const pool = require("./config/db");
const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

// Home route
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Sweety API is running",
    });
});

// Database health check
app.get("/api/health", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT current_database()"
        );

        res.status(200).json({
            success: true,
            message: "Database connected successfully",
            database: result.rows[0].current_database,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Database connection failed",
        });
    }
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`Sweety API running on port ${PORT}`);
});
