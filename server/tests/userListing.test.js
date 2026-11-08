process.env.JWT_SECRET = "user-listing-test-secret";

jest.mock("../src/config/db", () => ({
    query: jest.fn(),
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const pool = require("../src/config/db");
const app = require("../src/server");

const tokenFor = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET);

describe("registered user listing routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("patients can list doctors without sensitive fields", async () => {
        pool.query.mockResolvedValue({
            rows: [{
                id: "12",
                name: "Priya Sharma",
                email: "priya@example.com",
                total: 1,
            }],
        });

        const response = await request(app)
            .get("/api/doctors")
            .set("Authorization", `Bearer ${tokenFor("8", "patient")}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            data: [{ id: "12", name: "Priya Sharma", email: "priya@example.com" }],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("id <> $2"),
            ["doctor", "8", 20, 0]
        );
        expect(pool.query.mock.calls[0][0]).not.toMatch(/password/i);
    });

    test("doctors can list patients with pagination metadata", async () => {
        pool.query.mockResolvedValue({
            rows: [{
                id: "21",
                name: "Asha Patel",
                email: "asha@example.com",
                total: 8,
            }],
        });

        const response = await request(app)
            .get("/api/patients?page=2&limit=3")
            .set("Authorization", `Bearer ${tokenFor("4", "doctor")}`);

        expect(response.status).toBe(200);
        expect(response.body.pagination).toEqual({
            page: 2,
            limit: 3,
            total: 8,
            totalPages: 3,
        });
        expect(pool.query).toHaveBeenCalledWith(
            expect.any(String),
            ["patient", "4", 3, 3]
        );
    });

    test.each([
        ["/api/doctors", "patient"],
        ["/api/patients", "doctor"],
    ])("%s rejects unauthenticated requests", async (path) => {
        const response = await request(app).get(path);
        expect(response.status).toBe(401);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test.each([
        ["/api/doctors", "doctor"],
        ["/api/patients", "patient"],
    ])("%s rejects the wrong role", async (path, role) => {
        const response = await request(app)
            .get(path)
            .set("Authorization", `Bearer ${tokenFor("4", role)}`);

        expect(response.status).toBe(403);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test.each([
        ["/api/doctors?page=0"],
        ["/api/doctors?limit=51"],
        ["/api/patients?page=1.5"],
        ["/api/patients?limit=invalid"],
    ])("%s rejects invalid pagination", async (path) => {
        const isDoctorList = path.startsWith("/api/doctors");
        const response = await request(app)
            .get(path)
            .set("Authorization", `Bearer ${tokenFor("4", isDoctorList ? "patient" : "doctor")}`);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            success: false,
            message: "Invalid pagination parameters",
        });
        expect(pool.query).not.toHaveBeenCalled();
    });

    test("returns an empty page and zero totals when no role users exist", async () => {
        pool.query.mockResolvedValue({
            rows: [{ id: null, name: null, email: null, total: 0 }],
        });

        const response = await request(app)
            .get("/api/doctors")
            .set("Authorization", `Bearer ${tokenFor("8", "patient")}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([]);
        expect(response.body.pagination).toEqual({
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
        });
    });
});
