import express from "express";
import authController from "../controllers/auth.controller.js";
import * as profileController from "../controllers/profile.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { handleProfileImageUpload } from "../../../middlewares/profileUpload.middleware.js";

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/signin", authController.signin);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authenticate, authController.logout);
router.post("/forgot-password", authController.forgotPassword);
router.post("/resend-password-otp", authController.resendPasswordOtp);
router.post("/verify-password-otp", authController.verifyPasswordOtp);
router.post("/set-new-password", authController.setNewPassword);
router.get("/profile", authenticate, profileController.getMyProfile);
router.patch("/profile", authenticate, profileController.updateMyProfile);
router.get(
  "/superadmin/profile",
  authenticate,
  authorize("superadmin"),
  profileController.getSuperadminProfile
);
router.patch(
  "/superadmin/profile",
  authenticate,
  authorize("superadmin"),
  handleProfileImageUpload,
  profileController.updateSuperadminProfile
);

export default router;
