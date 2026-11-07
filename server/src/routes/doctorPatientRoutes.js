const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const controller = require("../controllers/doctorPatientController");

const router = express.Router();

router.get(
    "/patients/search",
    authenticateUser,
    authorizeRoles("doctor"),
    controller.searchPatients
);
router.get(
    "/doctors/search",
    authenticateUser,
    authorizeRoles("patient"),
    controller.searchDoctors
);

router.post(
    "/doctor-requests",
    authenticateUser,
    authorizeRoles("doctor", "patient"),
    controller.createRequest
);
router.get(
    "/doctor-requests/sent",
    authenticateUser,
    authorizeRoles("doctor", "patient"),
    controller.listSentRequests
);
router.get(
    "/doctor-requests/received",
    authenticateUser,
    authorizeRoles("doctor", "patient"),
    controller.listReceivedRequests
);
router.patch(
    "/doctor-requests/:id/accept",
    authenticateUser,
    authorizeRoles("doctor", "patient"),
    controller.acceptRequest
);
router.patch(
    "/doctor-requests/:id/reject",
    authenticateUser,
    authorizeRoles("doctor", "patient"),
    controller.rejectRequest
);
router.patch(
    "/doctor-requests/:id/cancel",
    authenticateUser,
    authorizeRoles("doctor", "patient"),
    controller.cancelRequest
);

router.get(
    "/doctor/patients",
    authenticateUser,
    authorizeRoles("doctor"),
    controller.getPatients
);
router.get(
    "/doctor/assignments/history",
    authenticateUser,
    authorizeRoles("doctor"),
    controller.getAssignmentHistory
);
router.post(
    "/doctor/assignments/:id/end",
    authenticateUser,
    authorizeRoles("doctor"),
    controller.endAssignment
);

module.exports = router;
