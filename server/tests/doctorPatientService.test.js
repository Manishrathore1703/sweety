jest.mock("../src/config/db", () => ({
    connect: jest.fn(),
}));

const pool = require("../src/config/db");
const service = require("../src/services/doctorPatientService");

const pendingRequest = {
    id: "14",
    doctor_id: "2",
    patient_id: "8",
    initiated_by: "doctor",
    status: "pending",
};

const createClient = ({ assigned = false } = {}) => {
    const client = {
        query: jest.fn(async (sql) => {
            if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
                return { rows: [] };
            }
            if (sql.includes("FROM doctor_patient_requests")) {
                return { rows: [pendingRequest] };
            }
            if (sql.includes("FOR UPDATE") && sql.includes("FROM users")) {
                return { rows: [{ id: "8" }] };
            }
            if (sql.includes("SELECT id, role")) {
                return {
                    rows: [
                        { id: "2", role: "doctor" },
                        { id: "8", role: "patient" },
                    ],
                };
            }
            if (sql.includes("FROM doctor_patient_assignments")) {
                return { rows: assigned ? [{ id: "3" }] : [] };
            }
            if (sql.includes("UPDATE doctor_patient_requests")) {
                return { rows: [{ ...pendingRequest, status: "accepted" }] };
            }
            return { rows: [] };
        }),
        release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);
    return client;
};

describe("doctor-patient request transactions", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("locks and accepts a request atomically", async () => {
        const client = createClient();
        const result = await service.changeRequestStatus(
            { id: "8", role: "patient" },
            "14",
            "accept"
        );

        expect(result.request.status).toBe("accepted");
        expect(client.query).toHaveBeenCalledWith(
            expect.stringContaining("FOR UPDATE"),
            ["14"]
        );
        expect(client.query).toHaveBeenCalledWith("COMMIT");
        expect(client.release).toHaveBeenCalled();
    });

    test("does not grant access when another account tries to accept", async () => {
        const client = createClient();
        const result = await service.changeRequestStatus(
            { id: "2", role: "doctor" },
            "14",
            "accept"
        );

        expect(result).toEqual({ error: "not-authorized" });
        expect(client.query).toHaveBeenCalledWith("ROLLBACK");
        expect(client.query.mock.calls.some(([sql]) =>
            sql.includes("INSERT INTO doctor_patient_assignments")
        )).toBe(false);
    });

    test("does not accept if the patient already has an active doctor", async () => {
        const client = createClient({ assigned: true });
        const result = await service.changeRequestStatus(
            { id: "8", role: "patient" },
            "14",
            "accept"
        );

        expect(result).toEqual({ error: "patient-already-assigned" });
        expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    });
});
