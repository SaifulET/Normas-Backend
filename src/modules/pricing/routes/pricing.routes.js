import express from "express";
import * as pricingController from "../controllers/pricing.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", pricingController.getPricing);
router.get("/plans", pricingController.getPublicPlans);
router.get("/feature-comparison", pricingController.getFeatureComparison);
router.get("/plans/:planType", pricingController.getPublicPlanByType);

router.use(authenticate);

router.post(
  "/preview",
  authorize("investor", "investee"),
  pricingController.previewSubscription
);
router.post(
  "/subscribe",
  authorize("investor", "investee"),
  pricingController.createSubscription
);
router.patch(
  "/my-subscription/change-plan",
  authorize("investor", "investee"),
  pricingController.changeMyPlan
);
router.patch(
  "/my-subscription/cancel",
  authorize("investor", "investee"),
  pricingController.cancelMySubscription
);
router.post(
  "/my-subscription/sync",
  authorize("investor", "investee"),
  pricingController.syncMySubscription
);
router.get(
  "/my-subscription",
  authorize("investor", "investee"),
  pricingController.getMySubscription
);
router.get(
  "/my-upcoming-invoice",
  authorize("investor", "investee"),
  pricingController.getMyUpcomingInvoice
);
router.get(
  "/my-payments",
  authorize("investor", "investee"),
  pricingController.getMyPayments
);
router.get(
  "/my-payments/:invoiceId",
  authorize("investor", "investee", "superadmin"),
  pricingController.getMyPaymentById
);

router.post("/", authorize("superadmin"), pricingController.createPricing);
router.patch("/:pricingId", authorize("superadmin"), pricingController.updatePricing);
router.get("/admin/plans", authorize("superadmin"), pricingController.getAdminPlanConfigs);
router.get(
  "/admin/plans/:planType",
  authorize("superadmin"),
  pricingController.getAdminPlanConfigByType
);
router.patch(
  "/admin/plans/:planType",
  authorize("superadmin"),
  pricingController.updateAdminPlanConfig
);
router.get("/admin/subscriptions", authorize("superadmin"), pricingController.getAdminSubscriptions);
router.get(
  "/admin/subscriptions/:subscriptionId",
  authorize("superadmin"),
  pricingController.getAdminSubscriptionById
);
router.post(
  "/admin/subscriptions/:subscriptionId/suspend",
  authorize("superadmin"),
  pricingController.suspendSubscriptionByAdmin
);
router.post(
  "/admin/subscriptions/:subscriptionId/sync",
  authorize("superadmin"),
  pricingController.syncSubscriptionByAdmin
);

export default router;
