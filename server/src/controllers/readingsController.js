
const pool = require("../config/db");

const {
    validateReading,
    validateId,
} = require("../utils/readingValidation");

const isFutureDate = async (date) => {
    const result = await pool.query(
        "SELECT $1::date > CURRENT_DATE AS is_future",
        [date]
    );

    return result.rows[0].is_future;
};



const createReading = async (req, res) => {
    try {
        const { reading_date, time_slot, glucose_value } = req.body;

        const errors = validateReading({
            reading_date,
            time_slot,
            glucose_value,
        });

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors,
            });
        }

        if (await isFutureDate(reading_date)) {
            return res.status(400).json({
                success: false,
                message: "Future dates are not allowed",
            });
        }

        
        const userId = req.user.id;

        const result = await pool.query(
            `INSERT INTO readings
                (user_id, reading_date, time_slot, glucose_value)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [userId, reading_date, time_slot, glucose_value]
        );

        return res.status(201).json({
            success: true,
            message: "Glucose reading added successfully",
            reading: result.rows[0],
        });

    } catch (error) {
        console.error("Create reading error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "A reading already exists for this time slot and date",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to add glucose reading",
        });
    }
};




const getReadings = async (req, res) => {
    try {
        const userId = req.user.id;
        const { date, page = "1", limit = "10" } = req.query;

        const pageNumber = Number(page);
        const limitNumber = Number(limit);

        if (
            !Number.isInteger(pageNumber) ||
            pageNumber < 1 ||
            !Number.isInteger(limitNumber) ||
            limitNumber < 1 ||
            limitNumber > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid pagination parameters",
            });
        }

        const offset = (pageNumber - 1) * limitNumber;

        let query = `
            SELECT id, user_id, reading_date, time_slot,
                   glucose_value, created_at, updated_at
            FROM readings
            WHERE user_id = $1
        `;

        let countQuery = `
            SELECT COUNT(*)::int AS total
            FROM readings
            WHERE user_id = $1
        `;

        const values = [userId];
        const countValues = [userId];

        if (date) {
            const errors = validateReading({
                reading_date: date,
                time_slot: "morning_fasting",
                glucose_value: 100,
            });

            if (errors.some(error =>
                error.includes("Date")
            )) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid date. Use YYYY-MM-DD",
                });
            }

            values.push(date);
            countValues.push(date);

            query += ` AND reading_date = $2`;
            countQuery += ` AND reading_date = $2`;
        }

        query += `
            ORDER BY reading_date DESC,
                     CASE time_slot
                         WHEN 'morning_fasting' THEN 1
                         WHEN 'after_breakfast' THEN 2
                         WHEN 'after_lunch' THEN 3
                         WHEN 'after_dinner' THEN 4
                     END
            LIMIT $${values.length + 1}
            OFFSET $${values.length + 2}
        `;

        values.push(limitNumber, offset);

        const [readingsResult, countResult] = await Promise.all([
            pool.query(query, values),
            pool.query(countQuery, countValues),
        ]);

        const total = countResult.rows[0].total;

        return res.status(200).json({
            success: true,
            count: readingsResult.rows.length,
            pagination: {
                page: pageNumber,
                limit: limitNumber,
                total,
                totalPages: Math.ceil(total / limitNumber),
            },
            readings: readingsResult.rows,
        });

    } catch (error) {
        console.error("Get readings error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch readings",
        });
    }
};




const getReadingById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validateId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid reading ID",
            });
        }

        const result = await pool.query(
            `SELECT *
             FROM readings
             WHERE id = $1 AND user_id = $2`,
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Reading not found",
            });
        }

        return res.status(200).json({
            success: true,
            reading: result.rows[0],
        });

    } catch (error) {
        console.error("Get reading error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch reading",
        });
    }
};



const updateReading = async (req, res) => {
    try {
        const { id } = req.params;
        const { reading_date, time_slot, glucose_value } = req.body;

        if (!validateId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid reading ID",
            });
        }

        const errors = validateReading({
            reading_date,
            time_slot,
            glucose_value,
        });

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors,
            });
        }

        if (await isFutureDate(reading_date)) {
            return res.status(400).json({
                success: false,
                message: "Future dates are not allowed",
            });
        }

        const result = await pool.query(
            `UPDATE readings
             SET reading_date = $1,
                 time_slot = $2,
                 glucose_value = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 AND user_id = $5
             RETURNING *`,
            [
                reading_date,
                time_slot,
                glucose_value,
                id,
                req.user.id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Reading not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Reading updated successfully",
            reading: result.rows[0],
        });

    } catch (error) {
        console.error("Update reading error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "A reading already exists for this time slot and date",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to update reading",
        });
    }
};



const deleteReading = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validateId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid reading ID",
            });
        }

        const result = await pool.query(
            `DELETE FROM readings
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Reading not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Reading deleted successfully",
        });

    } catch (error) {
        console.error("Delete reading error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete reading",
        });
    }
};


module.exports = {
    createReading,
    getReadings,
    getReadingById,
    updateReading,
    deleteReading,
};
