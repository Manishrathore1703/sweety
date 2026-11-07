
const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            role: user.role,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "1d",
        }
    );
};

// POST /api/auth/register
const register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body || {};

        // 1. Validate required fields
        if (!name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: "Name, email, password and role are required",
            });
        }

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof role !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email, password and role are required",
            });
        }

        const normalizedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();

        if (!normalizedName) {
            return res.status(400).json({
                success: false,
                message: "Name cannot be empty",
            });
        }

        // 2. Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address",
            });
        }

        // 3. Validate password
        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters",
            });
        }

        // 4. Validate role
        if (!["patient", "doctor"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Role must be patient or doctor",
            });
        }

        // 5. Check whether email already exists
        const existingUser = await pool.query(
            "SELECT id FROM users WHERE LOWER(email) = $1",
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email is already registered",
            });
        }

        // 6. Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // 7. Save user
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, email, role, created_at`,
            [normalizedName, normalizedEmail, passwordHash, role]
        );

        const user = result.rows[0];

        // 8. Generate JWT
        const token = generateToken(user);

        return res.status(201).json({
            success: true,
            message: "Registration successful",
            token,
            user,
        });

    } catch (error) {
        console.error("Registration error:", error);

        // Handle duplicate email race condition
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Email is already registered",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// POST /api/auth/login
const login = async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            !email.trim() ||
            typeof password !== "string" ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address",
            });
        }

        // 1. Find user
        const result = await pool.query(
            `SELECT id, name, email, password_hash, role
             FROM users
             WHERE LOWER(email) = $1`,
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const user = result.rows[0];

        // 2. Compare password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // 3. Generate token
        const token = generateToken(user);

        // 4. Remove password hash from response
        const safeUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        };

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: safeUser,
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// GET /api/auth/me
const getMe = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, role, created_at
             FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            user: result.rows[0],
        });

    } catch (error) {
        console.error("Get profile error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

module.exports = {
    register,
    login,
    getMe,
};
