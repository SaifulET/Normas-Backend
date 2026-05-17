import * as pricingService from "../services/pricing.service.js";

export const getPricing = async (req, res, next) => {
  try {
    const result = await pricingService.getPricing(req.query);

    res.status(200).json({
      success: true,
      message: "Pricing fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicPlans = async (req, res, next) => {
  try {
    const result = await pricingService.getPublicPlans(req.query);

    res.status(200).json({
      success: true,
      message: "Plans fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicPlanByType = async (req, res, next) => {
  try {
    const result = await pricingService.getPublicPlanByType(req.params.planType, req.query);

    res.status(200).json({
      success: true,
      message: "Plan fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getFeatureComparison = async (req, res, next) => {
  try {
    const result = await pricingService.getFeatureComparison(req.query);

    res.status(200).json({
      success: true,
      message: "Feature comparison fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminPlanConfigs = async (_req, res, next) => {
  try {
    const result = await pricingService.getAdminPlanConfigs();

    res.status(200).json({
      success: true,
      message: "Admin pricing cards fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminPlanConfigByType = async (req, res, next) => {
  try {
    const result = await pricingService.getAdminPlanConfigByType(req.params.planType);

    res.status(200).json({
      success: true,
      message: "Admin pricing card fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminPlanConfig = async (req, res, next) => {
  try {
    const result = await pricingService.updateAdminPlanConfig(
      req.user,
      req.params.planType,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Admin pricing card updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const previewSubscription = async (req, res, next) => {
  try {
    const result = await pricingService.previewSubscription(req.user, req.body);

    res.status(200).json({
      success: true,
      message: "Subscription preview fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const createPricing = async (req, res, next) => {
  try {
    const result = await pricingService.createPricing(req.user, req.body);

    res.status(201).json({
      success: true,
      message: "Pricing created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePricing = async (req, res, next) => {
  try {
    const result = await pricingService.updatePricing(req.user, req.params.pricingId, req.body);

    res.status(200).json({
      success: true,
      message: "Pricing updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const createSubscription = async (req, res, next) => {
  try {
    const result = await pricingService.createSubscription(req.user, req.body);

    res.status(201).json({
      success: true,
      message: "Subscription created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const changeMyPlan = async (req, res, next) => {
  try {
    const result = await pricingService.changeMyPlan(req.user, req.body);

    res.status(200).json({
      success: true,
      message: "Subscription plan changed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelMySubscription = async (req, res, next) => {
  try {
    const result = await pricingService.cancelMySubscription(req.user);

    res.status(200).json({
      success: true,
      message: "Subscription will be canceled at period end",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMySubscription = async (req, res, next) => {
  try {
    const result = await pricingService.getMySubscription(req.user);

    res.status(200).json({
      success: true,
      message: "My subscription fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const syncMySubscription = async (req, res, next) => {
  try {
    const result = await pricingService.syncMySubscription(req.user);

    res.status(200).json({
      success: true,
      message: "My subscription synced successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyUpcomingInvoice = async (req, res, next) => {
  try {
    const result = await pricingService.getMyUpcomingInvoice(req.user);

    res.status(200).json({
      success: true,
      message: "Upcoming invoice fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyPayments = async (req, res, next) => {
  try {
    const result = await pricingService.getMyPayments(req.user, req.query);

    res.status(200).json({
      success: true,
      message: "My payments fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyPaymentById = async (req, res, next) => {
  try {
    const result = await pricingService.getMyPaymentById(req.user, req.params.invoiceId);

    res.status(200).json({
      success: true,
      message: "Payment details fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminSubscriptions = async (req, res, next) => {
  try {
    const result = await pricingService.getAdminSubscriptions(req.query);

    res.status(200).json({
      success: true,
      message: "Admin subscriptions fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminSubscriptionById = async (req, res, next) => {
  try {
    const result = await pricingService.getAdminSubscriptionById(req.params.subscriptionId);

    res.status(200).json({
      success: true,
      message: "Admin subscription details fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const suspendSubscriptionByAdmin = async (req, res, next) => {
  try {
    const result = await pricingService.suspendSubscriptionByAdmin(req.params.subscriptionId);

    res.status(200).json({
      success: true,
      message: "Subscription suspended successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const syncSubscriptionByAdmin = async (req, res, next) => {
  try {
    const result = await pricingService.syncSubscriptionByAdmin(req.params.subscriptionId);

    res.status(200).json({
      success: true,
      message: "Subscription synced successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleStripeWebhook = async (req, res, next) => {
  try {
    const signature = req.headers["stripe-signature"];
    const result = await pricingService.handleStripeWebhookEvent(signature, req.body);

    res.status(200).json({
      success: true,
      message: "Stripe webhook processed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
