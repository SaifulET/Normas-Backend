import express from "express";
import * as reportController from "../controllers/report.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.post("/", authorize("investor", "investee", "superadmin"), reportController.createReport);
router.get("/", authorize("superadmin"), reportController.getAllReports);
router.get("/:reportId", authorize("superadmin"), reportController.getReportById);
router.patch("/:reportId/action", authorize("superadmin"), reportController.takeReportAction);
router.patch("/:reportId/status", authorize("superadmin"), reportController.updateReportStatus);
router.delete("/:reportId", authorize("superadmin"), reportController.deleteReport);

export default router;
