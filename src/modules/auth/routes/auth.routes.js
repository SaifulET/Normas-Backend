import express from "express";
import authController from "../controllers/auth.controller.js";
import { authenticate } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/signin", authController.signin);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authenticate, authController.logout);
router.post("/forgot-password", authController.forgotPassword);
router.post("/resend-password-otp", authController.resendPasswordOtp);
router.post("/verify-password-otp", authController.verifyPasswordOtp);
router.post("/set-new-password", authController.setNewPassword);

export default router;
