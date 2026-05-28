import express from "express";
import * as adminUserController from "../controllers/adminUser.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticate, authorize("superadmin"));

router.get("/", adminUserController.getAdminUsers);
router.get("/:userId", adminUserController.getAdminUserDetails);
router.get("/:userId/profile", adminUserController.getAdminUserProfile);
router.get("/:userId/kyc", adminUserController.getAdminUserKyc);
router.get("/:userId/pitches", adminUserController.getAdminUserPitches);
router.get("/:userId/features", adminUserController.getAdminUserPitches);
router.patch("/:userId/status", adminUserController.updateAdminUserAccountStatus);

export default router;
