import express from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import * as blockedIpController from "../controllers/blockedIp.controller.js";

const router = express.Router();

router.use(authenticate, authorize("superadmin"));

router.get("/", blockedIpController.getBlockedIps);
router.delete("/:blockedIpId", blockedIpController.unblockIp);

export default router;
