jest.mock("../src/config/db", () => ({
    query: jest.fn(),
}));

const pool = require("../src/config/db");
const { getGlucoseReport } = require("../src/services/reportService");
const { getDateRange } = require("../src/controllers/reportController");

describe("report calculations", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("calculates previous month correctly across the January boundary", () => {
        expect(getDateRange("previous-month", "2026-01-15")).toEqual({
            startDate: "2025-12-01",
            endDate: "2025-12-31",
        });
    });

    test("keeps month-to-date ending on the selected date", () => {
        expect(getDateRange("month-to-date", "2026-11-07")).toEqual({
            startDate: "2026-11-01",
            endDate: "2026-11-07",
        });
    });

    test("preserves null statistics for periods without readings", async () => {
        pool.query.mockResolvedValueOnce({
            rows: [{
                maximum: null,
                minimum: null,
                average: null,
                total_readings: 0,
            }],
        });

        const report = await getGlucoseReport("12", "2026-11-01", "2026-11-07");

        expect(report.statistics).toEqual({
            maximum: null,
            minimum: null,
            average: null,
            total_readings: 0,
        });
        expect(pool.query).toHaveBeenCalledTimes(1);
    });
});
