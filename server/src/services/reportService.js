
const pool = require("../config/db");

const getGlucoseReport = async (
    userId,
    startDate,
    endDate,
    includeReadings = false
) => {
    // Calculate report statistics
    const statsResult = await pool.query(
        `SELECT
            MAX(glucose_value) AS maximum,
            MIN(glucose_value) AS minimum,
            ROUND(AVG(glucose_value)::numeric, 1)::float AS average,
            COUNT(*)::int AS total_readings
         FROM readings
         WHERE user_id = $1
           AND reading_date BETWEEN $2::date AND $3::date`,
        [userId, startDate, endDate]
    );

    const statistics = statsResult.rows[0];

    let readings = [];

    // Include readings for the selected period so reports can be charted.
    if (includeReadings) {
        const readingsResult = await pool.query(
            `SELECT
                id,
                reading_date,
                time_slot,
                glucose_value,
                created_at,
                updated_at
             FROM readings
             WHERE user_id = $1
               AND reading_date BETWEEN $2::date AND $3::date
             ORDER BY
                reading_date,
                CASE time_slot
                    WHEN 'morning_fasting' THEN 1
                    WHEN 'after_breakfast' THEN 2
                    WHEN 'after_lunch' THEN 3
                    WHEN 'after_dinner' THEN 4
                END`,
            [userId, startDate, endDate]
        );

        readings = readingsResult.rows;
    }

    return {
        period: {
            start_date: startDate,
            end_date: endDate,
        },
        statistics,
        ...(includeReadings && { readings }),
    };
};

module.exports = {
    getGlucoseReport,
};
