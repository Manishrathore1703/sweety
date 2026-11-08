
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
const readingsRoutes = require("./routes/readingsRoutes");
const reportRoutes = require("./routes/reportRoutes");
const doctorPatientRoutes = require("./routes/doctorPatientRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const HttpError = require("./utils/httpError");


const app = express();

const allowedOrigins = (process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const isLocalDevOrigin = (origin) => {
    try {
        const { hostname } = new URL(origin);

        if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname)) {
            return true;
        }

        return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
    } catch {
        return false;
    }
};

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
            return callback(null, true);
        }

        const error = new Error("Origin is not allowed");
        error.status = 403;
        return callback(error);
    },
}));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/readings", readingsRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api", doctorPatientRoutes);
app.use("/api/doctor", doctorRoutes);

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
        console.error("Database health check failed:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed",
        });
    }
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Endpoint not found",
    });
});

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON request body",
        });
    }

    if (error instanceof HttpError) {
        return res.status(error.status).json({
            success: false,
            message: error.message,
        });
    }

    if (error.code === "23505") {
        return res.status(409).json({
            success: false,
            message: "A conflicting record already exists",
        });
    }

    if (error.code === "23514" || error.code === "23503" || error.status === 403) {
        return res.status(error.status || 400).json({
            success: false,
            message: "The request conflicts with current data or is not allowed",
        });
    }

    console.error("Unhandled request error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error",
    });
});

const PORT = process.env.PORT || 5001;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Sweety API running on port ${PORT}`);
    });
}

module.exports = app;
