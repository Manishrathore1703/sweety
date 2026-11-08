const { validateId } = require("../utils/readingValidation");
const HttpError = require("../utils/httpError");
const doctorPatientService = require("../services/doctorPatientService");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getSearchEmail = (value) => {
    if (typeof value !== "string" || !EMAIL_PATTERN.test(value.trim())) {
        throw new HttpError(400, "A valid email address is required");
    }

    return value.trim().toLowerCase();
};

const getPagination = (query) => {
    const rawPage = query.page ?? "1";
    const rawLimit = query.limit ?? "20";

    if (
        typeof rawPage !== "string" ||
        !/^\d+$/.test(rawPage) ||
        typeof rawLimit !== "string" ||
        !/^\d+$/.test(rawLimit)
    ) {
        return null;
    }

    const page = Number(rawPage);
    const limit = Number(rawLimit);
    const offset = (page - 1) * limit;

    if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 50 ||
        !Number.isSafeInteger(offset)
    ) {
        return null;
    }

    return { page, limit, offset };
};

const mapServiceError = (error) => {
    const errors = {
        "target-not-found": [404, "Account not found for the requested role"],
        "patient-already-assigned": [409, "Patient already has an active doctor"],
        "request-already-pending": [409, "A request is already pending for this doctor and patient"],
        "request-not-found": [404, "Request not found"],
        "request-not-pending": [409, "Request is no longer pending"],
        "not-authorized": [403, "You are not authorized to perform this action"],
        "accounts-invalid": [409, "Doctor or patient account is no longer valid"],
        "assignment-not-found": [404, "Assignment not found"],
        "assignment-not-active": [409, "Assignment is already ended"],
    };

    if (error && errors[error]) {
        const [status, message] = errors[error];
        throw new HttpError(status, message);
    }
};

const searchPatients = async (req, res) => {
    const patient = await doctorPatientService.findUserByEmail(
        "patient",
        getSearchEmail(req.query.email)
    );

    return res.status(200).json({
        success: true,
        patient,
    });
};

const searchDoctors = async (req, res) => {
    const doctor = await doctorPatientService.findUserByEmail(
        "doctor",
        getSearchEmail(req.query.email)
    );

    return res.status(200).json({
        success: true,
        doctor,
    });
};

const listUsersByRole = (role, resource) => async (req, res) => {
    const pagination = getPagination(req.query);
    if (!pagination) {
        return res.status(400).json({
            success: false,
            message: "Invalid pagination parameters",
        });
    }

    try {
        const { users, total } = await doctorPatientService.listUsersByRole(
            role,
            req.user.id,
            pagination.limit,
            pagination.offset
        );

        return res.status(200).json({
            success: true,
            data: users,
            pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total: Number(total),
                totalPages: Math.ceil(Number(total) / pagination.limit),
            },
        });
    } catch (error) {
        console.error(`Fetch ${resource} error:`, error);
        return res.status(500).json({
            success: false,
            message: `Unable to fetch ${resource}`,
        });
    }
};

const createRequest = async (req, res) => {
    const field = req.user.role === "doctor" ? "patient_email" : "doctor_email";
    const email = getSearchEmail(req.body?.[field]);
    const result = await doctorPatientService.createRequest(req.user, email);

    if (result.error) {
        mapServiceError(result.error);
    }

    return res.status(201).json({
        success: true,
        message: "Connection request created",
        request: result.request,
    });
};

const listSentRequests = async (req, res) => {
    const requests = await doctorPatientService.listRequests(req.user, "sent");
    return res.status(200).json({ success: true, requests });
};

const listReceivedRequests = async (req, res) => {
    const requests = await doctorPatientService.listRequests(req.user, "received");
    return res.status(200).json({ success: true, requests });
};

const updateRequest = (action) => async (req, res) => {
    if (!validateId(req.params.id)) {
        throw new HttpError(400, "Invalid request ID");
    }

    const result = await doctorPatientService.changeRequestStatus(
        req.user,
        req.params.id,
        action
    );

    if (result.error) {
        mapServiceError(result.error);
    }

    return res.status(200).json({
        success: true,
        message: `Connection request ${
            { accept: "accepted", reject: "rejected", cancel: "cancelled" }[action]
        }`,
        request: result.request,
    });
};

const getPatients = async (req, res) => {
    const patients = await doctorPatientService.getAssignments(req.user.id, false);
    return res.status(200).json({ success: true, patients });
};

const getAssignmentHistory = async (req, res) => {
    const assignments = await doctorPatientService.getAssignments(req.user.id, true);
    return res.status(200).json({ success: true, assignments });
};

const endAssignment = async (req, res) => {
    if (!validateId(req.params.id)) {
        throw new HttpError(400, "Invalid assignment ID");
    }

    const result = await doctorPatientService.endAssignment(
        req.user.id,
        req.params.id
    );

    if (result.error) {
        mapServiceError(result.error);
    }

    return res.status(200).json({
        success: true,
        message: "Assignment ended",
        assignment: result.assignment,
    });
};

module.exports = {
    searchPatients,
    searchDoctors,
    listDoctors: listUsersByRole("doctor", "doctors"),
    listPatients: listUsersByRole("patient", "patients"),
    createRequest,
    listSentRequests,
    listReceivedRequests,
    acceptRequest: updateRequest("accept"),
    rejectRequest: updateRequest("reject"),
    cancelRequest: updateRequest("cancel"),
    getPatients,
    getAssignmentHistory,
    endAssignment,
};
