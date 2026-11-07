const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const controller = require("../controllers/doctorPatientController");

const router = express.Router();
router.use(authenticateUser);

router.get(
    "/patients/search",
    authorizeRoles("doctor"),
    controller.searchPatients
);
router.get(
    "/doctors/search",
    authorizeRoles("patient"),
    controller.searchDoctors
);

router.post(
    "/doctor-requests",
    authorizeRoles("doctor", "patient"),
    controller.createRequest
);
router.get(
    "/doctor-requests/sent",
    authorizeRoles("doctor", "patient"),
    controller.listSentRequests
);
router.get(
    "/doctor-requests/received",
    authorizeRoles("doctor", "patient"),
    controller.listReceivedRequests
);
router.patch(
    "/doctor-requests/:id/accept",
    authorizeRoles("doctor", "patient"),
    controller.acceptRequest
);
router.patch(
    "/doctor-requests/:id/reject",
    authorizeRoles("doctor", "patient"),
    controller.rejectRequest
);
router.patch(
    "/doctor-requests/:id/cancel",
    authorizeRoles("doctor", "patient"),
    controller.cancelRequest
);

router.get(
    "/doctor/patients",
    authorizeRoles("doctor"),
    controller.getPatients
);
router.get(
    "/doctor/assignments/history",
    authorizeRoles("doctor"),
    controller.getAssignmentHistory
);
router.post(
    "/doctor/assignments/:id/end",
    authorizeRoles("doctor"),
    controller.endAssignment
);

module.exports = router;
