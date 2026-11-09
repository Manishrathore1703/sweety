const bcrypt = require("bcrypt");
const pool = require("../src/config/db");

const demoUsers = [
    { key: "demoPatient", name: "Sweety Demo Patient", email: "demo@sweety.local", role: "patient", password: "Demo@12345" },
    { key: "doctor", name: "Demo Doctor", email: "doctor@example.com", role: "doctor", password: "DemoDoctor123!" },
    { key: "patient1", name: "Demo Patient One", email: "patient1@example.com", role: "patient", password: "DemoPatient123!" },
    { key: "patient2", name: "Demo Patient Two", email: "patient2@example.com", role: "patient", password: "DemoPatient123!" },
    { key: "patient3", name: "Demo Patient Three", email: "patient3@example.com", role: "patient", password: "DemoPatient123!" },
];

const dateDaysAgo = (days) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
};

const readingSlots = [
    { timeSlot: "morning_fasting", minimum: 88, range: 25 },
    { timeSlot: "after_breakfast", minimum: 124, range: 37 },
    { timeSlot: "after_lunch", minimum: 119, range: 39 },
    { timeSlot: "after_dinner", minimum: 116, range: 42 },
];

const seed = async () => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const ids = {};

        for (const demoUser of demoUsers) {
            const passwordHash = await bcrypt.hash(demoUser.password, 12);
            const result = await client.query(
                `INSERT INTO users (name, email, password_hash, role)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (LOWER(email)) DO UPDATE
                    SET name = EXCLUDED.name,
                        password_hash = EXCLUDED.password_hash,
                        role = EXCLUDED.role,
                        updated_at = CURRENT_TIMESTAMP
                 RETURNING id`,
                [
                    demoUser.name,
                    demoUser.email,
                    passwordHash,
                    demoUser.role,
                ]
            );
            ids[demoUser.key] = result.rows[0].id;
        }

        const readings = [
            [ids.demoPatient, dateDaysAgo(2), "morning_fasting", 101],
            [ids.demoPatient, dateDaysAgo(2), "after_breakfast", 142],
            [ids.demoPatient, dateDaysAgo(2), "after_lunch", 134],
            [ids.demoPatient, dateDaysAgo(2), "after_dinner", 128],
            [ids.demoPatient, dateDaysAgo(1), "morning_fasting", 96],
            [ids.demoPatient, dateDaysAgo(1), "after_breakfast", 138],
            [ids.demoPatient, dateDaysAgo(1), "after_lunch", 129],
            [ids.demoPatient, dateDaysAgo(1), "after_dinner", 124],
            [ids.demoPatient, dateDaysAgo(0), "morning_fasting", 99],
            [ids.demoPatient, dateDaysAgo(0), "after_breakfast", 145],
            [ids.demoPatient, dateDaysAgo(0), "after_lunch", 136],
            [ids.demoPatient, dateDaysAgo(0), "after_dinner", 131],
            [ids.patient1, dateDaysAgo(2), "morning_fasting", 104],
            [ids.patient1, dateDaysAgo(1), "after_lunch", 138],
            [ids.patient1, dateDaysAgo(0), "morning_fasting", 99],
            [ids.patient2, dateDaysAgo(3), "morning_fasting", 112],
            [ids.patient2, dateDaysAgo(1), "after_dinner", 146],
            [ids.patient3, dateDaysAgo(2), "after_breakfast", 127],
        ];

        const patientKeys = ["demoPatient", "patient1", "patient2", "patient3"];
        for (const [patientIndex, patientKey] of patientKeys.entries()) {
            for (let daysAgo = 0; daysAgo < 90; daysAgo += 1) {
                for (const [slotIndex, slot] of readingSlots.entries()) {
                    const glucoseValue =
                        slot.minimum +
                        ((daysAgo * 7 + patientIndex * 11 + slotIndex * 13) %
                            slot.range);
                    readings.push([
                        ids[patientKey],
                        dateDaysAgo(daysAgo),
                        slot.timeSlot,
                        glucoseValue,
                    ]);
                }
            }
        }

        for (const reading of readings) {
            await client.query(
                `INSERT INTO readings
                    (user_id, reading_date, time_slot, glucose_value)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (user_id, reading_date, time_slot) DO NOTHING`,
                reading
            );
        }

        await client.query(
            `INSERT INTO doctor_patient_assignments
                (doctor_id, patient_id, status)
             VALUES ($1, $2, 'active')
             ON CONFLICT (patient_id) WHERE status = 'active' DO NOTHING`,
            [ids.doctor, ids.patient1]
        );

        await client.query(
            `INSERT INTO doctor_patient_assignments
                (doctor_id, patient_id, status, assigned_at, ended_at)
             SELECT $1, $2, 'ended', CURRENT_TIMESTAMP - INTERVAL '30 days',
                    CURRENT_TIMESTAMP - INTERVAL '7 days'
             WHERE NOT EXISTS (
                SELECT 1
                FROM doctor_patient_assignments
                WHERE doctor_id = $1 AND patient_id = $2 AND status = 'ended'
             )`,
            [ids.doctor, ids.patient2]
        );

        await client.query(
            `INSERT INTO doctor_patient_requests
                (doctor_id, patient_id, initiated_by, status)
             VALUES ($1, $2, 'doctor', 'pending')
             ON CONFLICT DO NOTHING`,
            [ids.doctor, ids.patient3]
        );
        await client.query(
            `INSERT INTO doctor_patient_requests
                (doctor_id, patient_id, initiated_by, status)
             VALUES ($1, $2, 'patient', 'pending')
             ON CONFLICT DO NOTHING`,
            [ids.doctor, ids.patient2]
        );

        await client.query("COMMIT");
        console.log("Demo data seeded successfully.");
        console.log("Patient login: demo@sweety.local / Demo@12345");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
};

seed().catch((error) => {
    console.error("Failed to seed demo data:", error);
    process.exitCode = 1;
});
