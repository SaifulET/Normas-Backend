import * as subscriptionService from "../services/subscription.service.js";

export const createCheckoutSession = async (req, res, next) => {
  try {
    const result = await subscriptionService.createCheckoutSession(req.user, req.body);

    res.status(201).json({
      success: true,
      message: "Stripe checkout session created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const createChangePlanCheckoutSession = async (req, res, next) => {
  try {
    const result = await subscriptionService.createCheckoutSession(req.user, {
      ...req.body,
      changePlan: true,
      mode: "change_plan",
    });

    res.status(201).json({
      success: true,
      message: "Stripe change-plan checkout session created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMySubscription = async (req, res, next) => {
  try {
    const result = await subscriptionService.getMySubscription(req.user);

    res.status(200).json({
      success: true,
      message: "Subscription fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelMySubscription = async (req, res, next) => {
  try {
    const result = await subscriptionService.cancelMySubscription(req.user);

    res.status(200).json({
      success: true,
      message: "Subscription will be canceled at period end",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyUpcomingInvoice = async (req, res, next) => {
  try {
    const result = await subscriptionService.getMyUpcomingInvoice(req.user);

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
    const result = await subscriptionService.getMyPayments(req.user);

    res.status(200).json({
      success: true,
      message: "Payments fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleStripeWebhook = async (req, res, next) => {
  try {
    const signature = req.headers["stripe-signature"];
    const result = await subscriptionService.handleStripeWebhookEvent(signature, req.body);

    res.status(200).json({
      success: true,
      message: "Stripe subscription webhook processed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
