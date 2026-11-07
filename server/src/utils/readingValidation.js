
const ALLOWED_TIME_SLOTS = [
    "morning_fasting",
    "after_breakfast",
    "after_lunch",
    "after_dinner",
];

const validateDate = (date) => {
    if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        return false;
    }

    const parsedDate = new Date(`${date}T00:00:00.000Z`);

    return (
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === date
    );
};

const validateReading = ({ reading_date, time_slot, glucose_value }) => {
    const errors = [];

    // Validate date format and actual calendar date
    if (
        typeof reading_date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(reading_date)
    ) {
        errors.push("Date must use YYYY-MM-DD format");
    } else {
        if (!validateDate(reading_date)) {
            errors.push("Invalid calendar date");
        }
    }

    // Validate time slot
    if (!ALLOWED_TIME_SLOTS.includes(time_slot)) {
        errors.push("Invalid time slot");
    }

    // Validate glucose value
    if (
        !Number.isInteger(glucose_value) ||
        glucose_value < 40 ||
        glucose_value > 600
    ) {
        errors.push("Glucose value must be an integer between 40 and 600");
    }

    return errors;
};

const validateId = (id) => {
    if (typeof id !== "string" || !/^[1-9]\d*$/.test(id)) {
        return false;
    }

    return BigInt(id) <= 9223372036854775807n;
};

module.exports = {
    ALLOWED_TIME_SLOTS,
    validateDate,
    validateReading,
    validateId,
};
