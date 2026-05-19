import express from "express";
import * as investmentConversationController from "../controllers/investmentConversation.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticate, authorize("investor", "investee", "superadmin"));

router.get("/", investmentConversationController.getMyConversations);
router.get("/inbox", investmentConversationController.getMyConversationInbox);
router.get("/sidebar", investmentConversationController.getMyConversationInbox);
router.get("/requests", investmentConversationController.getConversationRequests);
router.post("/", investmentConversationController.createOrGetConversation);
router.get("/meeting-requests", investmentConversationController.getMeetingRequests);
router.get("/meeting-requests/:meetingRequestId", investmentConversationController.getMeetingRequestById);
router.patch(
  "/meeting-requests/:meetingRequestId/status",
  investmentConversationController.updateMeetingRequestStatus
);
router.get("/schedules", investmentConversationController.getMySchedules);
router.get("/schedules/:meetingRequestId", investmentConversationController.getScheduleById);
router.get("/:conversationId", investmentConversationController.getConversationById);
router.patch("/:conversationId/seen", investmentConversationController.markConversationAsSeen);
router.get("/:conversationId/messages", investmentConversationController.getConversationMessages);
router.post("/:conversationId/messages", investmentConversationController.createConversationMessage);
router.get(
  "/:conversationId/meeting-requests",
  investmentConversationController.getConversationMeetingRequests
);
router.post("/:conversationId/meeting-requests", investmentConversationController.createMeetingRequest);

export default router;
