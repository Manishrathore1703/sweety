
const pool = require("../config/db");

const { validateDate } = require("../utils/readingValidation");
const { getGlucoseReport } = require("../services/reportService");

// Check whether selected date is in the future.
const isFutureDate = async (date) => {
    const result = await pool.query(
        "SELECT $1::date > CURRENT_DATE AS is_future",
        [date]
    );

    return result.rows[0].is_future;
};

// Convert a UTC Date object into YYYY-MM-DD.
const formatDate = (date) => {
    return date.toISOString().slice(0, 10);
};

// Generate date ranges for each report.
const getDateRange = (type, selectedDate) => {
    const [year, month, day] = selectedDate
        .split("-")
        .map(Number);

    if (type === "daily") {
        return {
            startDate: selectedDate,
            endDate: selectedDate,
        };
    }

    if (type === "month-to-date") {
        const startDate =
            `${year}-${String(month).padStart(2, "0")}-01`;

        return {
            startDate,
            endDate: selectedDate,
        };
    }

    if (type === "previous-month") {
        const previousMonthStart = new Date(
            Date.UTC(year, month - 2, 1)
        );

        const previousMonthEnd = new Date(
            Date.UTC(year, month - 1, 0)
        );

        return {
            startDate: formatDate(previousMonthStart),
            endDate: formatDate(previousMonthEnd),
        };
    }

    throw new Error("Invalid report type");
};

// Reusable report controller.
const generateReport = (type) => {
    return async (req, res) => {
        try {
            const { date } = req.query;

            // 1. Validate date
            if (!validateDate(date)) {
                return res.status(400).json({
                    success: false,
                    message: "A valid date in YYYY-MM-DD format is required",
                });
            }

            // 2. Reject future dates
            if (await isFutureDate(date)) {
                return res.status(400).json({
                    success: false,
                    message: "Future dates are not allowed",
                });
            }

            // 3. Calculate date range
            const { startDate, endDate } = getDateRange(
                type,
                date
            );

            // 4. Fetch report for authenticated patient
            const report = await getGlucoseReport(
                req.user.id,
                startDate,
                endDate,
                type === "daily"
            );

            return res.status(200).json({
                success: true,
                report: {
                    period: {
                        type,
                        ...report.period,
                    },
                    statistics: report.statistics,
                    ...(type === "daily" && {
                        readings: report.readings,
                    }),
                },
            });

        } catch (error) {
            console.error(`${type} report error:`, error);

            return res.status(500).json({
                success: false,
                message: "Failed to generate glucose report",
            });
        }
    };
};

module.exports = {
    getDailyReport: generateReport("daily"),
    getMonthToDateReport: generateReport("month-to-date"),
    getPreviousMonthReport: generateReport("previous-month"),
};
