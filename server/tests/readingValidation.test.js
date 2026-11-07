const {
    validateDate,
    validateReading,
    validateId,
} = require("../src/utils/readingValidation");

describe("reading validation", () => {
    test.each([
        ["2026-11-07", true],
        ["2024-02-29", true],
        ["2026-02-30", false],
        ["2026-13-01", false],
        ["07-11-2026", false],
        ["", false],
        [undefined, false],
    ])("validates date %s", (date, valid) => {
        expect(validateDate(date)).toBe(valid);
    });

    test("checks reading value and slot constraints", () => {
        expect(validateReading({
            reading_date: "2026-11-07",
            time_slot: "morning_fasting",
            glucose_value: 40,
        })).toEqual([]);

        expect(validateReading({
            reading_date: "2026-11-07",
            time_slot: "invalid_slot",
            glucose_value: 600.5,
        })).toEqual([
            "Invalid time slot",
            "Glucose value must be an integer between 40 and 600",
        ]);
    });

    test("accepts only positive integer identifiers", () => {
        expect(validateId("1")).toBe(true);
        expect(validateId("0")).toBe(false);
        expect(validateId("1.2")).toBe(false);
        expect(validateId("abc")).toBe(false);
    });
});
