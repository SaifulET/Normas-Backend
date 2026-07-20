import Stripe from "stripe";
import AppError from "../../../../utils/appError.js";
import User from "../../../auth/models/user.model.js";
import { notifyPaymentCreated } from "../../../notification/services/notification.service.js";
import Pricing, { billingCycles, pricingAudienceRoles } from "../../../pricing/models/pricing.model.js";
import SubscriptionInvoice from "../../../pricing/models/subscriptionInvoice.model.js";
import UserSubscription from "../../../pricing/models/subscription.model.js";

const DEFAULT_CURRENCY = "usd";
const PUBLIC_USER_FIELDS = "name email role profileImage mobile taxPercentage stripeCustomerId";
const ACTIVE_LOCAL_STATUSES = [
  "pending",
  "active",
  "cancel_at_period_end",
  "past_due",
  "incomplete",
  "unpaid",
];

const REQUESTED_PLAN_ALIASES = {
  investor_basic: ["investor_basic", "investor-basic"],
  investor_pro: ["investor_pro", "investor-pro"],
  investee: ["investee", "investee-basic", "investee-pro"],
  "investor-basic": ["investor-basic", "investor_basic"],
  "investor-pro": ["investor-pro", "investor_pro"],
  "investee-basic": ["investee-basic", "investee"],
  "investee-pro": ["investee-pro"],
};

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new AppError("Stripe is not configured. Set STRIPE_SECRET_KEY first.", 500);
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const normalizeText = (value) => String(value || "").trim();
const normalizeOptionalText = (value) => (value === undefined || value === null ? "" : normalizeText(value));
const fromAmountInCents = (amount) => Number((Number(amount || 0) / 100).toFixed(2));
const toAmountInCents = (amount) => Math.round(Number(amount || 0) * 100);
const toDate = (unixTimestamp) => (unixTimestamp ? new Date(unixTimestamp * 1000) : null);

const normalizeBillingCycle = (billingCycle) => {
  const normalized = normalizeText(billingCycle || "monthly");

  if (!billingCycles.includes(normalized)) {
    throw new AppError(`billingCycle must be one of: ${billingCycles.join(", ")}`, 400);
  }

  return normalized;
};

const getUserOrThrow = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

const getPlanAliases = (planType) => {
  const normalizedPlanType = normalizeText(planType);
  return REQUESTED_PLAN_ALIASES[normalizedPlanType] || [normalizedPlanType];
};

const getPricingPlanOrThrow = async (planType) => {
  const aliases = getPlanAliases(planType);
  const pricing = await Pricing.findOne({ planType: { $in: aliases } });

  if (!pricing) {
    throw new AppError("Pricing plan not found", 404);
  }

  if (!pricing.isActive) {
    throw new AppError("Selected plan is currently inactive", 400);
  }

  return pricing;
};

const assertPlanCanBeUsedByUser = (user, plan) => {
  if (!pricingAudienceRoles.includes(user.role)) {
    throw new AppError("Only investor or investee accounts can subscribe to plans", 403);
  }

  if (plan.audienceRole !== user.role) {
    throw new AppError("Selected plan is not valid for your account role", 400);
  }
};

const getStripePriceId = (plan, billingCycle) =>
  billingCycle === "annual" ? plan.stripeAnnualPriceId : plan.stripeMonthlyPriceId;

const getPlanAmountForBillingCycle = (plan, billingCycle) =>
  billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;

const ensureStripeProductForPlan = async (stripe, plan) => {
  if (plan.stripeProductId) {
    try {
      const product = await stripe.products.retrieve(plan.stripeProductId);

      if (product && !product.deleted) {
        return product.id;
      }
    } catch (_error) {
      // Recreate the product below if the saved one belongs to another key/account.
    }
  }

  const product = await stripe.products.create({
    name: plan.title,
    description: plan.description || undefined,
    metadata: {
      audienceRole: plan.audienceRole,
      planType: plan.planType,
      tier: plan.tier,
    },
  });

  plan.stripeProductId = product.id;
  await plan.save();

  return product.id;
};

const createStripeRecurringPriceForPlan = async ({ stripe, plan, billingCycle }) => {
  const amount = getPlanAmountForBillingCycle(plan, billingCycle);

  if (!Number.isFinite(Number(amount)) || Number(amount) < 0) {
    throw new AppError("Plan price is not configured correctly", 500);
  }

  const productId = await ensureStripeProductForPlan(stripe, plan);
  const price = await stripe.prices.create({
    currency: plan.currency || DEFAULT_CURRENCY,
    product: productId,
    unit_amount: toAmountInCents(amount),
    recurring: {
      interval: billingCycle === "annual" ? "year" : "month",
    },
    metadata: {
      billingCycle,
      planType: plan.planType,
    },
  });

  if (billingCycle === "annual") {
    plan.stripeAnnualPriceId = price.id;
  } else {
    plan.stripeMonthlyPriceId = price.id;
  }

  await plan.save();

  return price.id;
};

const ensureStripePriceForPlan = async ({ stripe, plan, billingCycle }) => {
  const savedPriceId = getStripePriceId(plan, billingCycle);

  if (savedPriceId) {
    try {
      const price = await stripe.prices.retrieve(savedPriceId);

      if (!price.deleted) {
        return price.id;
      }
    } catch (_error) {
      // Create a replacement price below if the saved one is missing for this key.
    }
  }

  return createStripeRecurringPriceForPlan({
    stripe,
    plan,
    billingCycle,
  });
};

const buildSubscriptionAmountSnapshot = ({ user, plan, billingCycle }) => {
  const subtotal = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
  const taxPercentage = Number(user.taxPercentage || 0);
  const taxAmount = Number(((subtotal * taxPercentage) / 100).toFixed(2));
  const total = Number((subtotal + taxAmount).toFixed(2));

  return {
    currency: plan.currency || DEFAULT_CURRENCY,
    subtotal,
    taxPercentage,
    taxAmount,
    total,
  };
};

const mapStripeStatusToLocalStatus = (stripeStatus, cancelAtPeriodEnd = false, existingLocalStatus = "") => {
  if (existingLocalStatus === "suspended" && stripeStatus === "canceled") {
    return "suspended";
  }

  switch (stripeStatus) {
    case "active":
    case "trialing":
      return cancelAtPeriodEnd ? "cancel_at_period_end" : "active";
    case "past_due":
      return "past_due";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    case "unpaid":
      return "unpaid";
    case "canceled":
      return "canceled";
    default:
      return "pending";
  }
};

const ensureStripeCustomer = async ({ stripe, user }) => {
  const payload = {
    name: user.name,
    email: user.email,
    phone: user.mobile || undefined,
    metadata: {
      userId: String(user._id),
      role: user.role,
    },
  };

  if (user.stripeCustomerId) {
    try {
      await stripe.customers.update(user.stripeCustomerId, payload);
      return user.stripeCustomerId;
    } catch (_error) {
      // Create a fresh customer below if the saved id is no longer usable.
    }
  }

  const customer = await stripe.customers.create(payload);
  user.stripeCustomerId = customer.id;
  await user.save();

  return customer.id;
};

const getCurrentActiveSubscription = async (userId) =>
  UserSubscription.findOne({
    user: userId,
    localStatus: { $in: ACTIVE_LOCAL_STATUSES },
  })
    .sort({ createdAt: -1 })
    .populate("user", PUBLIC_USER_FIELDS)
    .populate("pricing")
    .populate("latestInvoiceSummary.invoiceId");

const buildBillingAddressFromSession = (session = {}) => {
  const details = session.customer_details || {};
  const address = details.address || {};

  return {
    fullName: details.name || "",
    country: address.country || "",
    line1: address.line1 || "",
    line2: address.line2 || "",
    city: address.city || "",
    state: address.state || "",
    postalCode: address.postal_code || "",
  };
};

const serializeSubscription = (subscription) => {
  if (!subscription) {
    return null;
  }

  return {
    _id: subscription._id,
    user: subscription.user
      ? {
          _id: subscription.user._id,
          name: subscription.user.name,
          email: subscription.user.email,
          role: subscription.user.role,
          profileImage: subscription.user.profileImage || "",
          mobile: subscription.user.mobile || "",
          taxPercentage: subscription.user.taxPercentage || 0,
        }
      : null,
    role: subscription.role,
    planType: subscription.planType,
    planTier: subscription.planTier,
    planTitle: subscription.planTitle,
    billingCycle: subscription.billingCycle,
    subscriptionTopic: subscription.subscriptionTopic,
    featureSnapshot: subscription.featureSnapshot || [],
    topicSnapshot: subscription.topicSnapshot || [],
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    stripePriceId: subscription.stripePriceId,
    stripeStatus: subscription.stripeStatus,
    localStatus: subscription.localStatus,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    startedAt: subscription.startedAt,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    nextBillingDate: subscription.nextBillingDate,
    canceledAt: subscription.canceledAt,
    billingAddress: subscription.billingAddress || {},
    amountSnapshot: subscription.amountSnapshot || {},
    latestInvoiceSummary: subscription.latestInvoiceSummary || {},
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
};

const serializeInvoice = (invoice) => ({
  _id: invoice._id,
  subscription: invoice.subscription?._id || invoice.subscription,
  stripeInvoiceId: invoice.stripeInvoiceId,
  stripePaymentIntentId: invoice.stripePaymentIntentId || "",
  invoiceNumber: invoice.invoiceNumber,
  hostedInvoiceUrl: invoice.hostedInvoiceUrl,
  invoicePdfUrl: invoice.invoicePdfUrl,
  currency: invoice.currency,
  status: invoice.status,
  amountDue: invoice.amountDue,
  amountPaid: invoice.amountPaid,
  subtotal: invoice.subtotal,
  taxAmount: invoice.taxAmount,
  total: invoice.total,
  dueDate: invoice.dueDate,
  paidAt: invoice.paidAt,
  billingReason: invoice.billingReason,
  planType: invoice.planType,
  planTitle: invoice.planTitle,
  subscriptionTopic: invoice.subscriptionTopic,
  lines: invoice.lines,
  createdAt: invoice.createdAt,
  updatedAt: invoice.updatedAt,
});

const populateSubscription = (subscriptionId) =>
  UserSubscription.findById(subscriptionId)
    .populate("user", PUBLIC_USER_FIELDS)
    .populate("pricing")
    .populate("latestInvoiceSummary.invoiceId");

const upsertSubscriptionFromStripe = async ({
  user,
  pricing,
  stripeSubscription,
  billingCycle,
  billingAddress = {},
  subscriptionTopic,
  lastWebhookEvent = "",
  existingLocalStatus = "",
}) => {
  let subscription = await UserSubscription.findOne({
    stripeSubscriptionId: stripeSubscription.id,
  });

  if (!subscription) {
    subscription = new UserSubscription();
  }

  const amountSnapshot = buildSubscriptionAmountSnapshot({
    user,
    plan: pricing,
    billingCycle,
  });

  subscription.user = user._id;
  subscription.role = user.role;
  subscription.pricing = pricing._id;
  subscription.planType = pricing.planType;
  subscription.planTier = pricing.tier;
  subscription.planTitle = pricing.title;
  subscription.billingCycle = billingCycle;
  subscription.subscriptionTopic = subscriptionTopic || pricing.title;
  subscription.featureSnapshot = pricing.features || [];
  subscription.topicSnapshot = pricing.subscriptionTopics || [];
  subscription.stripeCustomerId =
    typeof stripeSubscription.customer === "string"
      ? stripeSubscription.customer
      : stripeSubscription.customer?.id || user.stripeCustomerId || "";
  subscription.stripeProductId = pricing.stripeProductId || "";
  subscription.stripePriceId =
    stripeSubscription.items?.data?.[0]?.price?.id ||
    (billingCycle === "annual" ? pricing.stripeAnnualPriceId : pricing.stripeMonthlyPriceId);
  subscription.stripeSubscriptionId = stripeSubscription.id;
  subscription.stripePaymentMethodId =
    typeof stripeSubscription.default_payment_method === "string"
      ? stripeSubscription.default_payment_method
      : stripeSubscription.default_payment_method?.id || subscription.stripePaymentMethodId || "";
  subscription.stripeLatestInvoiceId =
    typeof stripeSubscription.latest_invoice === "string"
      ? stripeSubscription.latest_invoice
      : stripeSubscription.latest_invoice?.id || subscription.stripeLatestInvoiceId || "";
  subscription.stripeStatus = stripeSubscription.status;
  subscription.localStatus = mapStripeStatusToLocalStatus(
    stripeSubscription.status,
    stripeSubscription.cancel_at_period_end,
    existingLocalStatus || subscription.localStatus
  );
  subscription.cancelAtPeriodEnd = Boolean(stripeSubscription.cancel_at_period_end);
  subscription.startedAt = toDate(stripeSubscription.start_date);
  subscription.currentPeriodStart = toDate(stripeSubscription.current_period_start);
  subscription.currentPeriodEnd = toDate(stripeSubscription.current_period_end);
  subscription.nextBillingDate = toDate(stripeSubscription.current_period_end);
  subscription.canceledAt = toDate(stripeSubscription.canceled_at);
  subscription.billingAddress = billingAddress;
  subscription.amountSnapshot = amountSnapshot;
  subscription.lastWebhookEvent = lastWebhookEvent;
  subscription.lastSyncedAt = new Date();

  await subscription.save();
  return populateSubscription(subscription._id);
};

const buildInvoiceStatus = (stripeInvoice) => {
  if (stripeInvoice.paid) {
    return "paid";
  }

  if (stripeInvoice.status === "open" && stripeInvoice.attempt_count > 0 && !stripeInvoice.paid) {
    return "failed";
  }

  return stripeInvoice.status || "pending";
};

const syncInvoiceRecord = async ({ localSubscription, stripeInvoice, user }) => {
  if (!stripeInvoice?.id || !localSubscription?._id) {
    return null;
  }

  const invoice = await SubscriptionInvoice.findOneAndUpdate(
    { stripeInvoiceId: stripeInvoice.id },
    {
      subscription: localSubscription._id,
      user: user._id,
      stripeCustomerId: localSubscription.stripeCustomerId,
      stripeSubscriptionId: localSubscription.stripeSubscriptionId,
      stripePaymentIntentId:
        typeof stripeInvoice.payment_intent === "string"
          ? stripeInvoice.payment_intent
          : stripeInvoice.payment_intent?.id || "",
      invoiceNumber: stripeInvoice.number || "",
      hostedInvoiceUrl: stripeInvoice.hosted_invoice_url || "",
      invoicePdfUrl: stripeInvoice.invoice_pdf || "",
      currency: stripeInvoice.currency || localSubscription.amountSnapshot.currency,
      status: buildInvoiceStatus(stripeInvoice),
      amountDue: fromAmountInCents(stripeInvoice.amount_due),
      amountPaid: fromAmountInCents(stripeInvoice.amount_paid),
      subtotal: fromAmountInCents(stripeInvoice.subtotal),
      taxAmount: fromAmountInCents(stripeInvoice.tax),
      total: fromAmountInCents(stripeInvoice.total),
      dueDate: toDate(stripeInvoice.due_date),
      paidAt: stripeInvoice.status_transitions?.paid_at
        ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
        : null,
      billingReason: stripeInvoice.billing_reason || "",
      planType: localSubscription.planType,
      planTitle: localSubscription.planTitle,
      subscriptionTopic: localSubscription.subscriptionTopic,
      lines: (stripeInvoice.lines?.data || []).map((line) => ({
        description: line.description || "",
        amount: fromAmountInCents(line.amount),
        currency: line.currency || stripeInvoice.currency || DEFAULT_CURRENCY,
        periodStart: toDate(line.period?.start),
        periodEnd: toDate(line.period?.end),
      })),
      rawInvoice: stripeInvoice,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  localSubscription.latestInvoiceSummary = {
    invoiceId: invoice._id,
    stripeInvoiceId: invoice.stripeInvoiceId,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    amountPaid: invoice.amountPaid,
    currency: invoice.currency,
    paidAt: invoice.paidAt,
  };
  localSubscription.stripeLatestInvoiceId = invoice.stripeInvoiceId;
  await localSubscription.save();

  if (invoice.status === "paid") {
    try {
      await notifyPaymentCreated({ invoice, user, subscription: localSubscription });
    } catch (error) {
      console.error("Payment notification failed:", error.message);
    }
  }

  return invoice;
};

const cancelPreviousSubscriptionAfterCheckout = async ({ stripe, previousSubscriptionId, replacementSubscriptionId }) => {
  if (!previousSubscriptionId || previousSubscriptionId === replacementSubscriptionId) {
    return;
  }

  try {
    const canceledStripeSubscription = await stripe.subscriptions.cancel(previousSubscriptionId);
    const previousLocalSubscription = await UserSubscription.findOne({
      stripeSubscriptionId: previousSubscriptionId,
    });

    if (previousLocalSubscription) {
      previousLocalSubscription.stripeStatus = canceledStripeSubscription.status;
      previousLocalSubscription.localStatus = "canceled";
      previousLocalSubscription.cancelAtPeriodEnd = false;
      previousLocalSubscription.canceledAt = toDate(canceledStripeSubscription.canceled_at) || new Date();
      previousLocalSubscription.lastWebhookEvent = "checkout.session.completed";
      previousLocalSubscription.lastSyncedAt = new Date();
      await previousLocalSubscription.save();
    }
  } catch (error) {
    console.error("Previous subscription cancellation failed:", error.message);
  }
};

export const createCheckoutSession = async (authUser, payload = {}) => {
  const user = await getUserOrThrow(authUser.userId);
  const plan = await getPricingPlanOrThrow(payload.planType);
  const billingCycle = normalizeBillingCycle(payload.billingCycle || payload.billing);
  const stripe = getStripeClient();

  assertPlanCanBeUsedByUser(user, plan);

  const stripePriceId = await ensureStripePriceForPlan({
    stripe,
    plan,
    billingCycle,
  });

  if (!stripePriceId) {
    throw new AppError("Stripe price is not configured for this plan yet", 500);
  }

  const existingSubscription = await getCurrentActiveSubscription(user._id);
  const isChangePlan = payload.changePlan === true || payload.mode === "change_plan";

  if (existingSubscription && !isChangePlan) {
    throw new AppError("You already have an active subscription. Use change plan instead.", 409);
  }

  if (!existingSubscription && isChangePlan) {
    throw new AppError("No active subscription found to change", 404);
  }

  if (existingSubscription && existingSubscription.stripePriceId === stripePriceId) {
    throw new AppError("You are already subscribed to this plan and billing cycle", 409);
  }

  const stripeCustomerId = await ensureStripeCustomer({ stripe, user });
  const subscriptionTopic = normalizeOptionalText(payload.subscriptionTopic || plan.title);
  const action = isChangePlan ? "change_plan" : "new_subscription";
  const metadata = {
    action,
    userId: String(user._id),
    role: user.role,
    pricingId: String(plan._id),
    planType: plan.planType,
    requestedPlanType: normalizeText(payload.planType),
    billingCycle,
    subscriptionTopic,
    planTitle: plan.title,
    previousSubscriptionId: existingSubscription?.stripeSubscriptionId || "",
  };

  let session;

  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded",
      payment_method_types: ["card"],
      redirect_on_completion: "never",
      customer: stripeCustomerId,
      client_reference_id: String(user._id),
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      billing_address_collection: "required",
      customer_update: {
        address: "auto",
        name: "auto",
      },
      metadata,
      subscription_data: {
        metadata,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    throw new AppError(`Stripe Checkout session failed: ${error.message}`, statusCode);
  }

  return {
    clientSecret: session.client_secret,
    sessionId: session.id,
    url: session.url,
    expiresAt: toDate(session.expires_at),
  };
};

export const getMySubscription = async (authUser) => {
  const subscription = await getCurrentActiveSubscription(authUser.userId);
  return serializeSubscription(subscription);
};

export const getMyPayments = async (authUser) => {
  const invoices = await SubscriptionInvoice.find({ user: authUser.userId }).sort({ createdAt: -1 });
  return invoices.map(serializeInvoice);
};

export const cancelMySubscription = async (authUser) => {
  const subscription = await getCurrentActiveSubscription(authUser.userId);

  if (!subscription) {
    throw new AppError("No active subscription found", 404);
  }

  const stripe = getStripeClient();
  const stripeSubscription = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  subscription.cancelAtPeriodEnd = true;
  subscription.stripeStatus = stripeSubscription.status;
  subscription.localStatus = mapStripeStatusToLocalStatus(
    stripeSubscription.status,
    true,
    subscription.localStatus
  );
  subscription.lastSyncedAt = new Date();
  await subscription.save();

  return serializeSubscription(await populateSubscription(subscription._id));
};

export const getMyUpcomingInvoice = async (authUser) => {
  const subscription = await getCurrentActiveSubscription(authUser.userId);

  if (!subscription) {
    throw new AppError("No active subscription found", 404);
  }

  const stripe = getStripeClient();
  const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
    customer: subscription.stripeCustomerId,
    subscription: subscription.stripeSubscriptionId,
  });

  return {
    subscriptionId: subscription._id,
    stripeInvoiceId: upcomingInvoice.id || "",
    currency: upcomingInvoice.currency || subscription.amountSnapshot.currency,
    subtotal: fromAmountInCents(upcomingInvoice.subtotal),
    taxAmount: fromAmountInCents(upcomingInvoice.tax),
    total: fromAmountInCents(upcomingInvoice.total),
    nextBillingDate: toDate(upcomingInvoice.period_end) || subscription.nextBillingDate,
    hostedInvoiceUrl: upcomingInvoice.hosted_invoice_url || "",
    invoicePdfUrl: upcomingInvoice.invoice_pdf || "",
    lines: (upcomingInvoice.lines?.data || []).map((line) => ({
      description: line.description || "",
      amount: fromAmountInCents(line.amount),
      currency: line.currency || upcomingInvoice.currency || DEFAULT_CURRENCY,
      periodStart: toDate(line.period?.start),
      periodEnd: toDate(line.period?.end),
    })),
  };
};

const syncCheckoutSessionCompleted = async ({ stripe, session, eventType }) => {
  const metadata = session.metadata || {};
  const user = await User.findById(metadata.userId);

  if (!user || !session.subscription) {
    return null;
  }

  const pricing = await Pricing.findOne({
    _id: metadata.pricingId,
  }).catch(() => null) || await getPricingPlanOrThrow(metadata.planType);

  const stripeSubscription = await stripe.subscriptions.retrieve(
    typeof session.subscription === "string" ? session.subscription : session.subscription.id,
    {
      expand: ["latest_invoice.payment_intent", "items.data.price", "default_payment_method"],
    }
  );

  const localSubscription = await upsertSubscriptionFromStripe({
    user,
    pricing,
    stripeSubscription,
    billingCycle: metadata.billingCycle || "monthly",
    billingAddress: buildBillingAddressFromSession(session),
    subscriptionTopic: metadata.subscriptionTopic || pricing.title,
    lastWebhookEvent: eventType,
  });

  if (stripeSubscription.latest_invoice && typeof stripeSubscription.latest_invoice !== "string") {
    await syncInvoiceRecord({
      localSubscription,
      stripeInvoice: stripeSubscription.latest_invoice,
      user,
    });
  }

  if (metadata.action === "change_plan") {
    await cancelPreviousSubscriptionAfterCheckout({
      stripe,
      previousSubscriptionId: metadata.previousSubscriptionId,
      replacementSubscriptionId: stripeSubscription.id,
    });
  }

  return localSubscription;
};

const syncSubscriptionEvent = async ({ stripeSubscription, eventType }) => {
  const metadata = stripeSubscription.metadata || {};
  const user = await User.findById(metadata.userId);

  if (!user) {
    return null;
  }

  const pricing = await getPricingPlanOrThrow(metadata.planType);
  const localSubscription = await upsertSubscriptionFromStripe({
    user,
    pricing,
    stripeSubscription,
    billingCycle: metadata.billingCycle || "monthly",
    billingAddress: {},
    subscriptionTopic: metadata.subscriptionTopic || pricing.title,
    lastWebhookEvent: eventType,
  });

  if (stripeSubscription.latest_invoice && typeof stripeSubscription.latest_invoice !== "string") {
    await syncInvoiceRecord({
      localSubscription,
      stripeInvoice: stripeSubscription.latest_invoice,
      user,
    });
  }

  return localSubscription;
};

const syncInvoiceEvent = async ({ stripe, stripeInvoice, eventType }) => {
  const stripeSubscriptionId =
    typeof stripeInvoice.subscription === "string"
      ? stripeInvoice.subscription
      : stripeInvoice.subscription?.id || "";

  let localSubscription = await UserSubscription.findOne({
    stripeSubscriptionId,
  }).populate("user", PUBLIC_USER_FIELDS);

  if (!localSubscription && stripeSubscriptionId) {
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ["latest_invoice.payment_intent", "items.data.price"],
    });
    localSubscription = await syncSubscriptionEvent({
      stripeSubscription,
      eventType,
    });
  }

  if (!localSubscription?.user) {
    return null;
  }

  await syncInvoiceRecord({
    localSubscription,
    stripeInvoice,
    user: localSubscription.user,
  });

  localSubscription.lastWebhookEvent = eventType;
  localSubscription.lastSyncedAt = new Date();
  await localSubscription.save();

  return localSubscription;
};

export const handleStripeWebhookEvent = async (signature, rawBody) => {
  const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new AppError("Stripe webhook secret is not configured", 500);
  }

  const stripe = getStripeClient();
  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  if (event.type === "checkout.session.completed") {
    await syncCheckoutSessionCompleted({
      stripe,
      session: event.data.object,
      eventType: event.type,
    });
  } else if (event.type.startsWith("customer.subscription.")) {
    await syncSubscriptionEvent({
      stripeSubscription: event.data.object,
      eventType: event.type,
    });
  } else if (event.type.startsWith("invoice.")) {
    await syncInvoiceEvent({
      stripe,
      stripeInvoice: event.data.object,
      eventType: event.type,
    });
  }

  return {
    received: true,
    type: event.type,
  };
};
