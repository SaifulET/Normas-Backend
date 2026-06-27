import express from "express";
import * as investmentConversationController from "../controllers/investmentConversation.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import UserSubscription from "../../pricing/models/subscription.model.js";

const router = express.Router();
const investeeConversationStatuses = ["active", "cancel_at_period_end"];

const requireInvesteeSubscription = async (req, res, next) => {
  try {
    if (req.user?.role !== "investee") {
      return next();
    }

    const subscription = await UserSubscription.exists({
      user: req.user.userId,
      localStatus: { $in: investeeConversationStatuses },
    });

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: "An active Investee subscription is required to use investor messages and scheduling",
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

router.use(authenticate, authorize("investor", "investee", "superadmin"));
router.use(requireInvesteeSubscription);

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
