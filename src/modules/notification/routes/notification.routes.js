import express from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import * as notificationController from "../controllers/notification.controller.js";

const router = express.Router();

router.use(authenticate, authorize("investor", "investee", "superadmin"));

router.get("/", notificationController.getNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.patch("/mark-all-read", notificationController.markAllNotificationsAsRead);
router.patch("/:notificationId/read", notificationController.markNotificationAsRead);

export default router;
