const { types } = require("pg");

describe("PostgreSQL date parsing", () => {
    test("preserves DATE values as calendar-date strings", () => {
        require("../src/config/db");

        const parseDate = types.getTypeParser(1082, "text");

        expect(parseDate("2026-11-02")).toBe("2026-11-02");
    });
});
