import express from "express";
import * as adminAnalyticsController from "../controllers/adminAnalytics.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticate, authorize("superadmin"));

router.get("/dashboard", adminAnalyticsController.getAdminDashboardAnalytics);

export default router;
