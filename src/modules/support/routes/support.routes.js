import express from "express";
import * as supportController from "../controllers/support.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

// Public or authenticated contact form submit
router.post("/", supportController.createSupportConversation);

router.use(authenticate);

router.get("/", authorize("superadmin"), supportController.getAllSupportConversations);
router.get(
  "/my-messages",
  authorize("investor", "investee", "superadmin"),
  supportController.getMySupportConversations
);
router.get(
  "/my-messages/:conversationId",
  authorize("investor", "investee", "superadmin"),
  supportController.getMySupportConversationById
);
router.get(
  "/:conversationId",
  authorize("investor", "investee", "superadmin"),
  supportController.getSupportConversationById
);
router.patch(
  "/:conversationId/seen",
  authorize("investor", "investee", "superadmin"),
  supportController.markSupportConversationAsSeen
);
router.patch(
  "/:conversationId/status",
  authorize("superadmin"),
  supportController.updateSupportConversationStatus
);
router.delete(
  "/:conversationId",
  authorize("superadmin"),
  supportController.deleteSupportConversation
);
router.post(
  "/:conversationId/messages",
  authorize("investor", "investee", "superadmin"),
  supportController.createSupportMessage
);

export default router;
