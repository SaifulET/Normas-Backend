import express from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import * as moderationController from "../controllers/moderation.controller.js";

const router = express.Router();

router.use(authenticate, authorize("superadmin"));

router.get("/alerts", moderationController.getModerationAlerts);
router.get("/alerts/:alertId", moderationController.getModerationAlertById);
router.patch("/alerts/:alertId/review", moderationController.markAlertReviewed);
router.patch("/alerts/:alertId/post/approve", moderationController.approveAlertPost);
router.patch("/alerts/:alertId/post/suspend", moderationController.keepAlertPostSuspended);
router.delete("/alerts/:alertId/post", moderationController.deleteAlertPost);
router.post("/alerts/:alertId/user/warn", moderationController.warnAlertUser);
router.patch("/alerts/:alertId/user/suspend", moderationController.suspendAlertUser);

export default router;
