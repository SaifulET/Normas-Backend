import express from "express";
import { authenticate, authorize } from "../../../../middlewares/auth.middleware.js";
import * as subscriptionController from "../controllers/subscription.controller.js";

const router = express.Router();

router.use(authenticate, authorize("investor", "investee"));

router.post("/checkout-session", subscriptionController.createCheckoutSession);
router.post("/change-plan/checkout-session", subscriptionController.createChangePlanCheckoutSession);
router.get("/current", subscriptionController.getMySubscription);
router.patch("/cancel", subscriptionController.cancelMySubscription);
router.get("/upcoming-invoice", subscriptionController.getMyUpcomingInvoice);
router.get("/payments", subscriptionController.getMyPayments);

export default router;
