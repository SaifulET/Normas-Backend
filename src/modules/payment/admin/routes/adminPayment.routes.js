import express from "express";
import { authenticate, authorize } from "../../../../middlewares/auth.middleware.js";
import * as adminPaymentController from "../controllers/adminPayment.controller.js";

const router = express.Router();

router.use(authenticate, authorize("superadmin"));

router.get("/", adminPaymentController.getAdminPayments);
router.get("/:paymentId", adminPaymentController.getAdminPaymentById);
router.delete("/:paymentId", adminPaymentController.deleteAdminPayment);

export default router;
