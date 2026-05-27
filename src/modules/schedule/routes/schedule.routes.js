import express from "express";
import * as scheduleController from "../controllers/schedule.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticate, authorize("investor", "investee", "superadmin"));

router.get("/", scheduleController.getSchedules);
router.get("/:scheduleId", scheduleController.getScheduleById);

router.post("/", authorize("superadmin"), scheduleController.createSchedule);
router.patch("/:scheduleId", authorize("superadmin"), scheduleController.updateSchedule);
router.delete("/:scheduleId", authorize("superadmin"), scheduleController.deleteSchedule);

export default router;
