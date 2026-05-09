import mongoose from "mongoose";
import Stripe from "stripe";
import AppError from "../../../utils/appError.js";
import User from "../../auth/models/user.model.js";
import Pricing, {
  billingCycles,
  pricingAudienceRoles,
  pricingPlanTiers,
  pricingPlanTypes,
} from "../models/pricing.model.js";
import UserSubscription from "../models/subscription.model.js";
import SubscriptionInvoice from "../models/subscriptionInvoice.model.js";

const DEFAULT_CURRENCY = "usd";
const ACTIVE_LOCAL_STATUSES = [
  "pending",
  "active",
  "cancel_at_period_end",
  "past_due",
  "incomplete",
  "unpaid",
];
const PUBLIC_USER_FIELDS = "name email role profileImage mobile taxPercentage stripeCustomerId";

const defaultPlanMap = {
  "investor-basic": {
    audienceRole: "investor",
    tier: "basic",
    title: "Investor Basic",
    description: "Essential access for investors",
    features: [],
    subscriptionTopics: ["Investor basic access"],
  },
  "investor-pro": {
    audienceRole: "investor",
    tier: "pro",
    title: "Investor Pro",
    description: "Advanced investor access",
    features: [],
    subscriptionTopics: ["Investor pro access"],
  },
  "investee-basic": {
    audienceRole: "investee",
    tier: "basic",
    title: "Investee Basic",
    description: "Essential access for investees",
    features: [],
    subscriptionTopics: ["Investee basic access"],
  },
  "investee-pro": {
    audienceRole: "investee",
    tier: "pro",
    title: "Investee Pro",
    description: "Advanced investee access",
    features: [],
    subscriptionTopics: ["Investee pro access"],
  },
};

const inferAudienceRoleFromPlanType = (planType = "") => {
  if (String(planType).startsWith("investor")) {
    return "investor";
  }

  return "investee";
};

const inferTierFromPlanType = (planType = "") => {
  if (String(planType).includes("pro")) {
    return "pro";
  }

  return "basic";
};

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new AppError("Stripe is not configured. Set STRIPE_SECRET_KEY first.", 500);
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const isStripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeText = (value) => String(value || "").trim();

const normalizeOptionalText = (value) => {
  if (typeof value === "undefined" || value === null) {
    return "";
  }

  return normalizeText(value);
};

const toAmountInCents = (amount) => {
  const number = Number(amount);

  if (!Number.isFinite(number) || number < 0) {
    throw new AppError("Amount must be a valid non-negative number", 400);
  }

  return Math.round(number * 100);
};

const fromAmountInCents = (amount) => Number(((Number(amount || 0)) / 100).toFixed(2));

const parseNumber = (value, fieldName) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new AppError(`${fieldName} must be a valid number`, 400);
  }

  return parsedValue;
};

const ensureRange = (value, fieldName, min, max) => {
  if (value < min || value > max) {
    throw new AppError(`${fieldName} must be between ${min} and ${max}`, 400);
  }
};

const parsePagination = ({ page = 1, limit = 10 } = {}) => {
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
  };
};

const paginateArray = (items, { page, limit }) => {
  const total = items.length;
  const startIndex = (page - 1) * limit;
  const data = items.slice(startIndex, startIndex + limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

const buildDefaultPlans = () =>
  pricingPlanTypes.map((planType) => ({
    planType,
    audienceRole: defaultPlanMap[planType].audienceRole,
    tier: defaultPlanMap[planType].tier,
    title: defaultPlanMap[planType].title,
    description: defaultPlanMap[planType].description,
    currency: DEFAULT_CURRENCY,
    pricePerMonth: 0,
    discountMonthly: 0,
    discountAnnually: 0,
    monthlyPrice: 0,
    annualPrice: 0,
    features: defaultPlanMap[planType].features,
    subscriptionTopics: defaultPlanMap[planType].subscriptionTopics,
    isActive: true,
    stripeProductId: "",
    stripeMonthlyPriceId: "",
    stripeAnnualPriceId: "",
  }));

const validateObjectId = (value, fieldName) => {
  if (!isValidObjectId(value)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }

  return value;
};

const getUserOrThrow = async (userId) => {
  validateObjectId(userId, "userId");

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

const getPricingByIdOrThrow = async (pricingId) => {
  validateObjectId(pricingId, "pricingId");

  const pricing = await Pricing.findById(pricingId);

  if (!pricing) {
    throw new AppError("Pricing not found", 404);
  }

  return pricing;
};

const getPricingOrThrow = async () => {
  const pricing = await Pricing.findOne().populate("lastModifiedBy", "name email role");

  if (!pricing) {
    throw new AppError("Pricing is not configured yet", 404);
  }

  return pricing;
};

const getSubscriptionByIdOrThrow = async (subscriptionId) => {
  validateObjectId(subscriptionId, "subscriptionId");

  const subscription = await UserSubscription.findById(subscriptionId)
    .populate("user", PUBLIC_USER_FIELDS)
    .populate("pricing")
    .populate("latestInvoiceSummary.invoiceId");

  if (!subscription) {
    throw new AppError("Subscription not found", 404);
  }

  return subscription;
};

const getInvoiceByIdOrThrow = async (invoiceId) => {
  validateObjectId(invoiceId, "invoiceId");

  const invoice = await SubscriptionInvoice.findById(invoiceId)
    .populate("user", PUBLIC_USER_FIELDS)
    .populate("subscription");

  if (!invoice) {
    throw new AppError("Payment record not found", 404);
  }

  return invoice;
};

const mapStripeStatusToLocalStatus = (stripeStatus, cancelAtPeriodEnd = false, existingLocalStatus = "") => {
  if (existingLocalStatus === "suspended" && stripeStatus === "canceled") {
    return "suspended";
  }

  switch (stripeStatus) {
    case "active":
      return cancelAtPeriodEnd ? "cancel_at_period_end" : "active";
    case "trialing":
      return "active";
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

const sanitizeStringArray = (items, fieldName) => {
  if (!Array.isArray(items)) {
    throw new AppError(`${fieldName} must be an array`, 400);
  }

  return items
    .map((item) => normalizeText(item))
    .filter(Boolean);
};

const calculateDiscountedPrices = ({
  pricePerMonth,
  discountMonthly,
  discountAnnually,
}) => {
  const monthlyPrice = Number(
    (Number(pricePerMonth) * (1 - Number(discountMonthly) / 100)).toFixed(2)
  );
  const annualPrice = Number(
    (Number(pricePerMonth) * 12 * (1 - Number(discountAnnually) / 100)).toFixed(2)
  );

  return {
    monthlyPrice,
    annualPrice,
  };
};

const sanitizePlans = (plans) => {
  if (!Array.isArray(plans) || plans.length !== pricingPlanTypes.length) {
    throw new AppError(
      `plans must be an array with exactly ${pricingPlanTypes.length} items`,
      400
    );
  }

  const normalizedPlans = plans.map((plan, index) => {
    if (!plan || typeof plan !== "object") {
      throw new AppError(`plans[${index}] must be an object`, 400);
    }

    if (!pricingPlanTypes.includes(plan.planType)) {
      throw new AppError(
        `plans[${index}].planType must be one of: ${pricingPlanTypes.join(", ")}`,
        400
      );
    }

    const defaults = defaultPlanMap[plan.planType];
    const audienceRole = normalizeText(plan.audienceRole || defaults.audienceRole);
    const tier = normalizeText(plan.tier || defaults.tier);

    if (!pricingAudienceRoles.includes(audienceRole)) {
      throw new AppError(`plans[${index}].audienceRole must be investor or investee`, 400);
    }

    if (!pricingPlanTiers.includes(tier)) {
      throw new AppError(`plans[${index}].tier must be basic or pro`, 400);
    }

    const title = normalizeText(plan.title || defaults.title);
    const description = normalizeOptionalText(plan.description || defaults.description);
    const currency = normalizeText(plan.currency || DEFAULT_CURRENCY).toLowerCase();
    const pricePerMonth = parseNumber(plan.pricePerMonth, `plans[${index}].pricePerMonth`);
    const discountMonthly = parseNumber(
      plan.discountMonthly,
      `plans[${index}].discountMonthly`
    );
    const discountAnnually = parseNumber(
      plan.discountAnnually,
      `plans[${index}].discountAnnually`
    );
    const features = sanitizeStringArray(plan.features || [], `plans[${index}].features`);
    const subscriptionTopics = sanitizeStringArray(
      plan.subscriptionTopics || defaults.subscriptionTopics,
      `plans[${index}].subscriptionTopics`
    );

    ensureRange(pricePerMonth, `plans[${index}].pricePerMonth`, 0, Number.MAX_SAFE_INTEGER);
    ensureRange(discountMonthly, `plans[${index}].discountMonthly`, 0, 100);
    ensureRange(discountAnnually, `plans[${index}].discountAnnually`, 0, 100);
    const { monthlyPrice, annualPrice } = calculateDiscountedPrices({
      pricePerMonth,
      discountMonthly,
      discountAnnually,
    });

    return {
      planType: plan.planType,
      audienceRole,
      tier,
      title: title || defaults.title,
      description,
      currency: currency || DEFAULT_CURRENCY,
      pricePerMonth,
      discountMonthly,
      discountAnnually,
      monthlyPrice,
      annualPrice,
      features,
      subscriptionTopics,
      isActive: typeof plan.isActive === "boolean" ? plan.isActive : true,
      stripeProductId: normalizeOptionalText(plan.stripeProductId),
      stripeMonthlyPriceId: normalizeOptionalText(plan.stripeMonthlyPriceId),
      stripeAnnualPriceId: normalizeOptionalText(plan.stripeAnnualPriceId),
    };
  });

  const uniquePlanTypes = new Set(normalizedPlans.map((plan) => plan.planType));

  if (uniquePlanTypes.size !== pricingPlanTypes.length) {
    throw new AppError("plans must contain each supported planType exactly once", 400);
  }

  return pricingPlanTypes.map((planType) =>
    normalizedPlans.find((plan) => plan.planType === planType)
  );
};

const serializePricingPlan = (plan) => ({
  planType: plan.planType,
  audienceRole: plan.audienceRole || inferAudienceRoleFromPlanType(plan.planType),
  tier: plan.tier || inferTierFromPlanType(plan.planType),
  title: plan.title || defaultPlanMap[plan.planType]?.title || "",
  description: plan.description || "",
  currency: plan.currency || DEFAULT_CURRENCY,
  pricePerMonth: Number(
    typeof plan.pricePerMonth !== "undefined"
      ? plan.pricePerMonth
      : typeof plan.monthlyPrice !== "undefined"
        ? plan.monthlyPrice
        : 0
  ),
  discountMonthly: Number(plan.discountMonthly || 0),
  discountAnnually: Number(plan.discountAnnually || 0),
  monthlyPrice: Number(
    typeof plan.monthlyPrice !== "undefined"
      ? plan.monthlyPrice
      : typeof plan.pricePerMonth !== "undefined"
        ? plan.pricePerMonth
        : 0
  ),
  annualPrice: Number(
    typeof plan.annualPrice !== "undefined"
      ? plan.annualPrice
      : typeof plan.pricePerMonth !== "undefined"
        ? Number(plan.pricePerMonth) * 12
        : 0
  ),
  features: Array.isArray(plan.features) ? plan.features : [],
  subscriptionTopics: Array.isArray(plan.subscriptionTopics) ? plan.subscriptionTopics : [],
  isActive: typeof plan.isActive === "boolean" ? plan.isActive : true,
  stripeProductId: plan.stripeProductId || "",
  stripeMonthlyPriceId: plan.stripeMonthlyPriceId || "",
  stripeAnnualPriceId: plan.stripeAnnualPriceId || "",
});

const serializePricing = (pricing) => {
  if (!pricing) {
    return {
      _id: null,
      plans: buildDefaultPlans().map(serializePricingPlan),
      lastModifiedBy: null,
      lastModifiedAt: null,
      isConfigured: false,
      createdAt: null,
      updatedAt: null,
    };
  }

  return {
    _id: pricing._id,
    plans: pricing.plans.map(serializePricingPlan),
    lastModifiedBy: pricing.lastModifiedBy
      ? {
          _id: pricing.lastModifiedBy._id,
          name: pricing.lastModifiedBy.name,
          email: pricing.lastModifiedBy.email,
          role: pricing.lastModifiedBy.role,
        }
      : null,
    lastModifiedAt: pricing.lastModifiedAt,
    isConfigured: true,
    createdAt: pricing.createdAt,
    updatedAt: pricing.updatedAt,
  };
};

const serializeSubscription = (subscription) => ({
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
  featureSnapshot: subscription.featureSnapshot,
  topicSnapshot: subscription.topicSnapshot,
  stripeCustomerId: subscription.stripeCustomerId,
  stripeSubscriptionId: subscription.stripeSubscriptionId,
  stripePriceId: subscription.stripePriceId,
  stripePaymentMethodId: subscription.stripePaymentMethodId || "",
  stripeLatestInvoiceId: subscription.stripeLatestInvoiceId || "",
  stripeStatus: subscription.stripeStatus,
  localStatus: subscription.localStatus,
  cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  startedAt: subscription.startedAt,
  currentPeriodStart: subscription.currentPeriodStart,
  currentPeriodEnd: subscription.currentPeriodEnd,
  nextBillingDate: subscription.nextBillingDate,
  canceledAt: subscription.canceledAt,
  suspendedAt: subscription.suspendedAt,
  billingAddress: subscription.billingAddress || {},
  amountSnapshot: subscription.amountSnapshot || {},
  latestInvoiceSummary: subscription.latestInvoiceSummary || {},
  lastSyncedAt: subscription.lastSyncedAt,
  createdAt: subscription.createdAt,
  updatedAt: subscription.updatedAt,
});

const serializeInvoice = (invoice) => ({
  _id: invoice._id,
  subscription: invoice.subscription?._id || invoice.subscription,
  user: invoice.user
    ? {
        _id: invoice.user._id,
        name: invoice.user.name,
        email: invoice.user.email,
        role: invoice.user.role,
      }
    : null,
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

const ensureStripeProduct = async (stripe, plan) => {
  if (plan.stripeProductId) {
    try {
      const product = await stripe.products.retrieve(plan.stripeProductId);

      if (product && !product.deleted) {
        return product.id;
      }
    } catch (_error) {
      // Recreate below if retrieval fails
    }
  }

  const product = await stripe.products.create({
    name: plan.title,
    description: plan.description || undefined,
    metadata: {
      planType: plan.planType,
      audienceRole: plan.audienceRole,
      tier: plan.tier,
    },
  });

  return product.id;
};

const ensureStripeRecurringPrice = async ({
  stripe,
  existingPriceId,
  productId,
  currency,
  amount,
  interval,
  metadata,
}) => {
  const expectedAmount = toAmountInCents(amount);

  if (existingPriceId) {
    try {
      const price = await stripe.prices.retrieve(existingPriceId);

      if (
        price.product === productId &&
        price.currency === currency &&
        price.recurring?.interval === interval &&
        price.unit_amount === expectedAmount
      ) {
        return price.id;
      }
    } catch (_error) {
      // Recreate below if retrieval fails
    }
  }

  const price = await stripe.prices.create({
    currency,
    product: productId,
    unit_amount: expectedAmount,
    recurring: {
      interval,
    },
    metadata,
  });

  return price.id;
};

const syncPlansWithStripe = async (plans) => {
  if (!isStripeConfigured()) {
    return plans;
  }

  const stripe = getStripeClient();
  const syncedPlans = [];

  for (const plan of plans) {
    const stripeProductId = await ensureStripeProduct(stripe, plan);
    const stripeMonthlyPriceId = await ensureStripeRecurringPrice({
      stripe,
      existingPriceId: plan.stripeMonthlyPriceId,
      productId: stripeProductId,
      currency: plan.currency,
      amount: plan.monthlyPrice,
      interval: "month",
      metadata: {
        planType: plan.planType,
        billingCycle: "monthly",
      },
    });
    const stripeAnnualPriceId = await ensureStripeRecurringPrice({
      stripe,
      existingPriceId: plan.stripeAnnualPriceId,
      productId: stripeProductId,
      currency: plan.currency,
      amount: plan.annualPrice,
      interval: "year",
      metadata: {
        planType: plan.planType,
        billingCycle: "annual",
      },
    });

    syncedPlans.push({
      ...plan,
      stripeProductId,
      stripeMonthlyPriceId,
      stripeAnnualPriceId,
    });
  }

  return syncedPlans;
};

const getPlanFromPricing = (pricing, planType) => {
  const plan = pricing.plans.find((item) => item.planType === planType);

  if (!plan) {
    throw new AppError("Pricing plan not found", 404);
  }

  return plan;
};

const validateBillingCycle = (billingCycle) => {
  if (!billingCycles.includes(billingCycle)) {
    throw new AppError(`billingCycle must be one of: ${billingCycles.join(", ")}`, 400);
  }

  return billingCycle;
};

const assertPlanMatchesRole = (userRole, plan) => {
  if (plan.audienceRole !== userRole) {
    throw new AppError("Selected plan is not valid for your account role", 400);
  }

  if (!plan.isActive) {
    throw new AppError("Selected plan is currently inactive", 400);
  }
};

const validateBillingAddress = (billingAddress = {}) => {
  const fullName = normalizeText(billingAddress.fullName);
  const country = normalizeText(billingAddress.country);
  const line1 = normalizeText(billingAddress.line1);

  if (!fullName) {
    throw new AppError("billingAddress.fullName is required", 400);
  }

  if (!country) {
    throw new AppError("billingAddress.country is required", 400);
  }

  if (!line1) {
    throw new AppError("billingAddress.line1 is required", 400);
  }

  return {
    fullName,
    country,
    line1,
    line2: normalizeOptionalText(billingAddress.line2),
    city: normalizeOptionalText(billingAddress.city),
    state: normalizeOptionalText(billingAddress.state),
    postalCode: normalizeOptionalText(billingAddress.postalCode),
  };
};

const buildSubscriptionAmountSnapshot = ({ user, plan, billingCycle }) => {
  const subtotal = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
  const taxPercentage = Number(user.taxPercentage || 0);
  const taxAmount = Number(((subtotal * taxPercentage) / 100).toFixed(2));
  const total = Number((subtotal + taxAmount).toFixed(2));

  return {
    currency: plan.currency,
    subtotal,
    taxPercentage,
    taxAmount,
    total,
  };
};

const ensureStripeCustomer = async ({ stripe, user, billingAddress }) => {
  const customerPayload = {
    name: billingAddress.fullName || user.name,
    email: user.email,
    phone: user.mobile || undefined,
    address: {
      line1: billingAddress.line1,
      line2: billingAddress.line2 || undefined,
      city: billingAddress.city || undefined,
      state: billingAddress.state || undefined,
      postal_code: billingAddress.postalCode || undefined,
      country: billingAddress.country || undefined,
    },
    metadata: {
      userId: String(user._id),
      role: user.role,
    },
  };

  if (user.stripeCustomerId) {
    try {
      await stripe.customers.update(user.stripeCustomerId, customerPayload);
      return user.stripeCustomerId;
    } catch (_error) {
      // Create a fresh customer below if the saved one is unusable.
    }
  }

  const customer = await stripe.customers.create(customerPayload);
  user.stripeCustomerId = customer.id;
  await user.save();

  return customer.id;
};

const attachPaymentMethodToCustomer = async ({
  stripe,
  customerId,
  paymentMethodId,
  user,
}) => {
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });

  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  user.stripeDefaultPaymentMethodId = paymentMethodId;
  await user.save();
};

const toDate = (unixTimestamp) => (unixTimestamp ? new Date(unixTimestamp * 1000) : null);

const buildInvoiceStatus = (stripeInvoice) => {
  if (stripeInvoice.paid) {
    return "paid";
  }

  if (stripeInvoice.status === "open" && stripeInvoice.attempt_count > 0 && !stripeInvoice.paid) {
    return "failed";
  }

  if (stripeInvoice.status) {
    return stripeInvoice.status;
  }

  return "pending";
};

const syncInvoiceRecord = async ({ localSubscription, stripeInvoice, user }) => {
  if (!stripeInvoice?.id) {
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

  return invoice;
};

const populateSubscription = (subscriptionId) =>
  UserSubscription.findById(subscriptionId)
    .populate("user", PUBLIC_USER_FIELDS)
    .populate("pricing")
    .populate("latestInvoiceSummary.invoiceId");

const upsertLocalSubscriptionFromStripe = async ({
  user,
  pricing,
  plan,
  stripeSubscription,
  billingCycle,
  billingAddress,
  subscriptionTopic,
  paymentMethodId,
  existingLocalStatus,
  lastWebhookEvent = "",
}) => {
  let subscription =
    (await UserSubscription.findOne({ stripeSubscriptionId: stripeSubscription.id })) ||
    (await UserSubscription.findOne({
      user: user._id,
      stripeSubscriptionId: stripeSubscription.id,
    }));

  const amountSnapshot = buildSubscriptionAmountSnapshot({
    user,
    plan,
    billingCycle,
  });

  if (!subscription) {
    subscription = new UserSubscription();
  }

  subscription.user = user._id;
  subscription.role = user.role;
  subscription.pricing = pricing?._id || null;
  subscription.planType = plan.planType;
  subscription.planTier = plan.tier;
  subscription.planTitle = plan.title;
  subscription.billingCycle = billingCycle;
  subscription.subscriptionTopic = subscriptionTopic;
  subscription.featureSnapshot = plan.features;
  subscription.topicSnapshot = plan.subscriptionTopics;
  subscription.stripeCustomerId =
    typeof stripeSubscription.customer === "string"
      ? stripeSubscription.customer
      : stripeSubscription.customer?.id || user.stripeCustomerId || "";
  subscription.stripeProductId = plan.stripeProductId;
  subscription.stripePriceId =
    typeof stripeSubscription.items?.data?.[0]?.price === "string"
      ? stripeSubscription.items.data[0].price
      : stripeSubscription.items?.data?.[0]?.price?.id ||
        (billingCycle === "annual" ? plan.stripeAnnualPriceId : plan.stripeMonthlyPriceId);
  subscription.stripeSubscriptionId = stripeSubscription.id;
  subscription.stripePaymentMethodId =
    paymentMethodId ||
    stripeSubscription.default_payment_method ||
    subscription.stripePaymentMethodId ||
    "";
  subscription.stripeLatestInvoiceId =
    typeof stripeSubscription.latest_invoice === "string"
      ? stripeSubscription.latest_invoice
      : stripeSubscription.latest_invoice?.id || subscription.stripeLatestInvoiceId || "";
  subscription.stripeStatus = stripeSubscription.status;
  subscription.cancelAtPeriodEnd = Boolean(stripeSubscription.cancel_at_period_end);
  subscription.startedAt = toDate(stripeSubscription.start_date);
  subscription.currentPeriodStart = toDate(stripeSubscription.current_period_start);
  subscription.currentPeriodEnd = toDate(stripeSubscription.current_period_end);
  subscription.nextBillingDate = toDate(stripeSubscription.current_period_end);
  subscription.canceledAt = toDate(stripeSubscription.canceled_at);
  subscription.billingAddress = billingAddress;
  subscription.amountSnapshot = amountSnapshot;
  subscription.localStatus = mapStripeStatusToLocalStatus(
    stripeSubscription.status,
    stripeSubscription.cancel_at_period_end,
    existingLocalStatus || subscription.localStatus
  );
  subscription.lastWebhookEvent = lastWebhookEvent;
  subscription.lastSyncedAt = new Date();

  await subscription.save();

  return populateSubscription(subscription._id);
};

const syncStripeInvoicesForSubscription = async ({ stripe, localSubscription, user }) => {
  const invoices = await stripe.invoices.list({
    customer: localSubscription.stripeCustomerId,
    subscription: localSubscription.stripeSubscriptionId,
    limit: 20,
    expand: ["data.payment_intent"],
  });

  for (const stripeInvoice of invoices.data) {
    await syncInvoiceRecord({
      localSubscription,
      stripeInvoice,
      user,
    });
  }
};

const syncLocalSubscriptionWithStripe = async (subscription) => {
  if (!isStripeConfigured() || !subscription?.stripeSubscriptionId) {
    return subscription;
  }

  const stripe = getStripeClient();
  const user = await getUserOrThrow(subscription.user._id || subscription.user);
  const pricing = await Pricing.findOne();
  const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId, {
    expand: ["latest_invoice.payment_intent", "items.data.price"],
  });
  const plan = pricing
    ? getPlanFromPricing(pricing, subscription.planType)
    : {
        planType: subscription.planType,
        tier: subscription.planTier,
        title: subscription.planTitle,
        features: subscription.featureSnapshot,
        subscriptionTopics: subscription.topicSnapshot,
        stripeProductId: subscription.stripeProductId,
        stripeMonthlyPriceId: subscription.stripePriceId,
        stripeAnnualPriceId: subscription.stripePriceId,
        currency: subscription.amountSnapshot.currency || DEFAULT_CURRENCY,
        monthlyPrice: subscription.amountSnapshot.subtotal || 0,
        annualPrice: subscription.amountSnapshot.subtotal || 0,
      };

  const updatedSubscription = await upsertLocalSubscriptionFromStripe({
    user,
    pricing,
    plan,
    stripeSubscription,
    billingCycle: subscription.billingCycle,
    billingAddress: subscription.billingAddress,
    subscriptionTopic: subscription.subscriptionTopic,
    paymentMethodId: subscription.stripePaymentMethodId,
    existingLocalStatus: subscription.localStatus,
  });

  if (stripeSubscription.latest_invoice && typeof stripeSubscription.latest_invoice !== "string") {
    await syncInvoiceRecord({
      localSubscription: updatedSubscription,
      stripeInvoice: stripeSubscription.latest_invoice,
      user,
    });
  }

  await syncStripeInvoicesForSubscription({
    stripe,
    localSubscription: updatedSubscription,
    user,
  });

  return populateSubscription(updatedSubscription._id);
};

const getCurrentUserActiveSubscription = async (userId) =>
  UserSubscription.findOne({
    user: userId,
    localStatus: { $in: ACTIVE_LOCAL_STATUSES },
  })
    .sort({ createdAt: -1 })
    .populate("user", PUBLIC_USER_FIELDS)
    .populate("pricing")
    .populate("latestInvoiceSummary.invoiceId");

const computePlanPreview = ({ user, plan, billingCycle, subscriptionTopic }) => {
  const amountSnapshot = buildSubscriptionAmountSnapshot({
    user,
    plan,
    billingCycle,
  });

  return {
    planType: plan.planType,
    title: plan.title,
    role: plan.audienceRole,
    tier: plan.tier,
    billingCycle,
    subscriptionTopic: subscriptionTopic || plan.title,
    features: plan.features,
    topics: plan.subscriptionTopics,
    subtotal: amountSnapshot.subtotal,
    taxPercentage: amountSnapshot.taxPercentage,
    taxAmount: amountSnapshot.taxAmount,
    total: amountSnapshot.total,
    currency: amountSnapshot.currency,
  };
};

export const getPricing = async ({ role, includeInactive = false } = {}) => {
  const pricing = await Pricing.findOne().populate("lastModifiedBy", "name email role");
  const serializedPricing = serializePricing(pricing);
  const normalizedRole = normalizeOptionalText(role);

  if (!normalizedRole) {
    return serializedPricing;
  }

  return {
    ...serializedPricing,
    plans: serializedPricing.plans.filter((plan) => {
      if (plan.audienceRole !== normalizedRole) {
        return false;
      }

      if (!includeInactive && !plan.isActive) {
        return false;
      }

      return true;
    }),
  };
};

export const getPublicPlans = async ({ role, includeInactive = false } = {}) => {
  const pricing = await Pricing.findOne();
  const basePricing = pricing || { plans: buildDefaultPlans() };
  const normalizedRole = normalizeOptionalText(role);

  const plans = basePricing.plans.filter((plan) => {
    if (normalizedRole && plan.audienceRole !== normalizedRole) {
      return false;
    }

    if (!includeInactive && !plan.isActive) {
      return false;
    }

    return true;
  });

  return plans.map(serializePricingPlan);
};

export const getAdminPlanConfigs = async () => {
  const pricing = await Pricing.findOne().populate("lastModifiedBy", "name email role");
  const normalizedPricing = pricing || {
    _id: null,
    plans: buildDefaultPlans(),
    lastModifiedBy: null,
    lastModifiedAt: null,
  };

  return {
    pricingId: normalizedPricing._id || null,
    lastModifiedBy: normalizedPricing.lastModifiedBy
      ? {
          _id: normalizedPricing.lastModifiedBy._id,
          name: normalizedPricing.lastModifiedBy.name,
          email: normalizedPricing.lastModifiedBy.email,
          role: normalizedPricing.lastModifiedBy.role,
        }
      : null,
    lastModifiedAt: normalizedPricing.lastModifiedAt || null,
    plans: normalizedPricing.plans.map(serializePricingPlan),
  };
};

export const getAdminPlanConfigByType = async (planType) => {
  if (!pricingPlanTypes.includes(planType)) {
    throw new AppError(`planType must be one of: ${pricingPlanTypes.join(", ")}`, 400);
  }

  const planConfigs = await getAdminPlanConfigs();
  const plan = planConfigs.plans.find((item) => item.planType === planType);

  return {
    pricingId: planConfigs.pricingId,
    lastModifiedBy: planConfigs.lastModifiedBy,
    lastModifiedAt: planConfigs.lastModifiedAt,
    plan,
  };
};

export const updateAdminPlanConfig = async (authUser, planType, payload = {}) => {
  await getUserOrThrow(authUser.userId);

  if (!pricingPlanTypes.includes(planType)) {
    throw new AppError(`planType must be one of: ${pricingPlanTypes.join(", ")}`, 400);
  }

  const currentPricing = await Pricing.findOne();
  const basePlans = currentPricing?.plans?.length
    ? currentPricing.plans.map((plan) =>
        typeof plan.toObject === "function" ? plan.toObject() : { ...plan }
      )
    : buildDefaultPlans();
  const currentPlan =
    basePlans.find((item) => item.planType === planType) ||
    buildDefaultPlans().find((item) => item.planType === planType);

  const mergedPlan = {
    ...currentPlan,
    ...payload,
    planType,
  };

  const sanitizedUpdatedPlan = sanitizePlans(
    pricingPlanTypes.map((type) => (type === planType
      ? mergedPlan
      : basePlans.find((item) => item.planType === type) || buildDefaultPlans().find((item) => item.planType === type)))
  );

  const syncedPlans = await syncPlansWithStripe(sanitizedUpdatedPlan);

  let pricing;

  if (!currentPricing) {
    pricing = await Pricing.create({
      plans: syncedPlans,
      lastModifiedBy: authUser.userId,
      lastModifiedAt: new Date(),
    });
  } else {
    currentPricing.plans = syncedPlans;
    currentPricing.lastModifiedBy = authUser.userId;
    currentPricing.lastModifiedAt = new Date();
    await currentPricing.save();
    pricing = currentPricing;
  }

  const populatedPricing = await Pricing.findById(pricing._id).populate("lastModifiedBy", "name email role");
  const updatedPlan = populatedPricing.plans.find((item) => item.planType === planType);

  return {
    pricingId: populatedPricing._id,
    lastModifiedBy: populatedPricing.lastModifiedBy
      ? {
          _id: populatedPricing.lastModifiedBy._id,
          name: populatedPricing.lastModifiedBy.name,
          email: populatedPricing.lastModifiedBy.email,
          role: populatedPricing.lastModifiedBy.role,
        }
      : null,
    lastModifiedAt: populatedPricing.lastModifiedAt,
    plan: serializePricingPlan(updatedPlan),
  };
};

export const previewSubscription = async (authUser, payload = {}) => {
  const user = await getUserOrThrow(authUser.userId);
  const pricing = await getPricingOrThrow();
  const billingCycle = validateBillingCycle(payload.billingCycle);
  const plan = getPlanFromPricing(pricing, payload.planType);
  assertPlanMatchesRole(user.role, plan);

  return computePlanPreview({
    user,
    plan,
    billingCycle,
    subscriptionTopic: normalizeOptionalText(payload.subscriptionTopic),
  });
};

export const createPricing = async (authUser, payload) => {
  await getUserOrThrow(authUser.userId);

  const existingPricing = await Pricing.findOne();

  if (existingPricing) {
    throw new AppError("Pricing already exists. Use edit instead.", 409);
  }

  const sanitizedPlans = sanitizePlans(payload.plans);
  const syncedPlans = await syncPlansWithStripe(sanitizedPlans);

  const createdPricing = await Pricing.create({
    plans: syncedPlans,
    lastModifiedBy: authUser.userId,
    lastModifiedAt: new Date(),
  });

  return serializePricing(
    await Pricing.findById(createdPricing._id).populate("lastModifiedBy", "name email role")
  );
};

export const updatePricing = async (authUser, pricingId, payload) => {
  await getUserOrThrow(authUser.userId);
  const pricing = await getPricingByIdOrThrow(pricingId);

  if (typeof payload.plans === "undefined" && payload.planType) {
    return updateAdminPlanConfig(authUser, payload.planType, payload);
  }

  if (typeof payload.plans !== "undefined") {
    const sanitizedPlans = sanitizePlans(payload.plans);
    pricing.plans = await syncPlansWithStripe(sanitizedPlans);
  }

  pricing.lastModifiedBy = authUser.userId;
  pricing.lastModifiedAt = new Date();

  await pricing.save();

  return serializePricing(
    await Pricing.findById(pricing._id).populate("lastModifiedBy", "name email role")
  );
};

export const createSubscription = async (authUser, payload = {}) => {
  const user = await getUserOrThrow(authUser.userId);

  if (!pricingAudienceRoles.includes(user.role)) {
    throw new AppError("Only investor or investee can subscribe to plans", 403);
  }

  const pricing = await getPricingOrThrow();
  const plan = getPlanFromPricing(pricing, payload.planType);
  assertPlanMatchesRole(user.role, plan);
  const billingCycle = validateBillingCycle(payload.billingCycle);
  const billingAddress = validateBillingAddress(payload.billingAddress);
  const paymentMethodId = normalizeText(payload.paymentMethodId);

  if (!paymentMethodId) {
    throw new AppError("paymentMethodId is required", 400);
  }

  const existingSubscription = await getCurrentUserActiveSubscription(user._id);

  if (existingSubscription) {
    throw new AppError("You already have an active subscription. Use change plan instead.", 409);
  }

  const stripe = getStripeClient();
  const stripeCustomerId = await ensureStripeCustomer({
    stripe,
    user,
    billingAddress,
  });

  await attachPaymentMethodToCustomer({
    stripe,
    customerId: stripeCustomerId,
    paymentMethodId,
    user,
  });

  const stripePriceId =
    billingCycle === "annual" ? plan.stripeAnnualPriceId : plan.stripeMonthlyPriceId;

  if (!stripePriceId) {
    throw new AppError("Stripe price is not configured for this plan yet", 500);
  }

  const subscriptionTopic = normalizeOptionalText(payload.subscriptionTopic || plan.title);
  const stripeSubscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    default_payment_method: paymentMethodId,
    items: [
      {
        price: stripePriceId,
      },
    ],
    payment_behavior: "error_if_incomplete",
    payment_settings: {
      save_default_payment_method: "on_subscription",
      payment_method_types: ["card"],
    },
    metadata: {
      userId: String(user._id),
      role: user.role,
      pricingId: String(pricing._id),
      planType: plan.planType,
      billingCycle,
      subscriptionTopic,
      planTitle: plan.title,
    },
    expand: ["latest_invoice.payment_intent", "items.data.price"],
  });

  const localSubscription = await upsertLocalSubscriptionFromStripe({
    user,
    pricing,
    plan,
    stripeSubscription,
    billingCycle,
    billingAddress,
    subscriptionTopic,
    paymentMethodId,
  });

  if (stripeSubscription.latest_invoice && typeof stripeSubscription.latest_invoice !== "string") {
    await syncInvoiceRecord({
      localSubscription,
      stripeInvoice: stripeSubscription.latest_invoice,
      user,
    });
  }

  return {
    subscription: serializeSubscription(await populateSubscription(localSubscription._id)),
    latestInvoice:
      localSubscription.latestInvoiceSummary?.invoiceId
        ? serializeInvoice(
            await SubscriptionInvoice.findById(localSubscription.latestInvoiceSummary.invoiceId)
          )
        : null,
  };
};

export const changeMyPlan = async (authUser, payload = {}) => {
  const user = await getUserOrThrow(authUser.userId);
  const currentSubscription = await getCurrentUserActiveSubscription(user._id);

  if (!currentSubscription) {
    throw new AppError("No active subscription found", 404);
  }

  const pricing = await getPricingOrThrow();
  const plan = getPlanFromPricing(pricing, payload.planType);
  assertPlanMatchesRole(user.role, plan);
  const billingCycle = validateBillingCycle(payload.billingCycle);
  const stripe = getStripeClient();
  const stripePriceId =
    billingCycle === "annual" ? plan.stripeAnnualPriceId : plan.stripeMonthlyPriceId;

  if (!stripePriceId) {
    throw new AppError("Stripe price is not configured for this plan yet", 500);
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(currentSubscription.stripeSubscriptionId, {
    expand: ["items.data.price", "latest_invoice.payment_intent"],
  });

  const subscriptionItemId = stripeSubscription.items.data[0]?.id;

  if (!subscriptionItemId) {
    throw new AppError("Stripe subscription item not found", 500);
  }

  const subscriptionTopic = normalizeOptionalText(
    payload.subscriptionTopic || currentSubscription.subscriptionTopic || plan.title
  );

  const updatedStripeSubscription = await stripe.subscriptions.update(
    currentSubscription.stripeSubscriptionId,
    {
      cancel_at_period_end: false,
      items: [
        {
          id: subscriptionItemId,
          price: stripePriceId,
        },
      ],
      metadata: {
        ...stripeSubscription.metadata,
        pricingId: String(pricing._id),
        planType: plan.planType,
        billingCycle,
        subscriptionTopic,
        planTitle: plan.title,
      },
      proration_behavior: "create_prorations",
      expand: ["latest_invoice.payment_intent", "items.data.price"],
    }
  );

  const updatedLocalSubscription = await upsertLocalSubscriptionFromStripe({
    user,
    pricing,
    plan,
    stripeSubscription: updatedStripeSubscription,
    billingCycle,
    billingAddress: currentSubscription.billingAddress,
    subscriptionTopic,
    paymentMethodId: currentSubscription.stripePaymentMethodId,
    existingLocalStatus: currentSubscription.localStatus,
  });

  if (
    updatedStripeSubscription.latest_invoice &&
    typeof updatedStripeSubscription.latest_invoice !== "string"
  ) {
    await syncInvoiceRecord({
      localSubscription: updatedLocalSubscription,
      stripeInvoice: updatedStripeSubscription.latest_invoice,
      user,
    });
  }

  return serializeSubscription(await populateSubscription(updatedLocalSubscription._id));
};

export const cancelMySubscription = async (authUser) => {
  const currentSubscription = await getCurrentUserActiveSubscription(authUser.userId);

  if (!currentSubscription) {
    throw new AppError("No active subscription found", 404);
  }

  const stripe = getStripeClient();
  const stripeSubscription = await stripe.subscriptions.update(
    currentSubscription.stripeSubscriptionId,
    {
      cancel_at_period_end: true,
    }
  );

  currentSubscription.cancelAtPeriodEnd = true;
  currentSubscription.stripeStatus = stripeSubscription.status;
  currentSubscription.localStatus = mapStripeStatusToLocalStatus(
    stripeSubscription.status,
    true,
    currentSubscription.localStatus
  );
  currentSubscription.lastSyncedAt = new Date();
  await currentSubscription.save();

  return serializeSubscription(await populateSubscription(currentSubscription._id));
};

export const getMySubscription = async (authUser) => {
  const subscription = await getCurrentUserActiveSubscription(authUser.userId);

  if (!subscription) {
    return null;
  }

  const syncedSubscription = await syncLocalSubscriptionWithStripe(subscription);
  return serializeSubscription(syncedSubscription);
};

export const getMyUpcomingInvoice = async (authUser) => {
  const subscription = await getCurrentUserActiveSubscription(authUser.userId);

  if (!subscription) {
    throw new AppError("No active subscription found", 404);
  }

  if (!isStripeConfigured()) {
    return {
      subscriptionId: subscription._id,
      currency: subscription.amountSnapshot.currency,
      subtotal: subscription.amountSnapshot.subtotal,
      taxAmount: subscription.amountSnapshot.taxAmount,
      total: subscription.amountSnapshot.total,
      nextBillingDate: subscription.nextBillingDate,
      isPreview: true,
    };
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
    isPreview: true,
  };
};

export const getMyPayments = async (authUser, query = {}) => {
  const filters = {
    user: authUser.userId,
  };

  if (query.status) {
    filters.status = normalizeText(query.status);
  }

  const invoices = await SubscriptionInvoice.find(filters)
    .populate("user", PUBLIC_USER_FIELDS)
    .sort({ createdAt: -1 });

  return invoices.map(serializeInvoice);
};

export const getMyPaymentById = async (authUser, invoiceId) => {
  const invoice = await getInvoiceByIdOrThrow(invoiceId);

  if (String(invoice.user._id) !== String(authUser.userId) && authUser.role !== "superadmin") {
    throw new AppError("Forbidden: you cannot access this payment record", 403);
  }

  return serializeInvoice(invoice);
};

export const getAdminSubscriptions = async (query = {}) => {
  const subscriptions = await UserSubscription.find()
    .populate("user", PUBLIC_USER_FIELDS)
    .populate("latestInvoiceSummary.invoiceId")
    .sort({ createdAt: -1 });

  const search = normalizeOptionalText(query.search).toLowerCase();
  const normalizedStatus = normalizeOptionalText(query.status);
  const normalizedRole = normalizeOptionalText(query.role);
  const normalizedPlanType = normalizeOptionalText(query.planType);

  const filteredSubscriptions = subscriptions
    .filter((subscription) => {
      if (normalizedStatus && subscription.localStatus !== normalizedStatus) {
        return false;
      }

      if (normalizedRole && subscription.role !== normalizedRole) {
        return false;
      }

      if (normalizedPlanType && subscription.planType !== normalizedPlanType) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        subscription.user?.name,
        subscription.user?.email,
        subscription.planTitle,
        subscription.subscriptionTopic,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    })
    .map((subscription) => ({
      ...serializeSubscription(subscription),
      latestPaymentStatus: subscription.latestInvoiceSummary?.status || "",
      latestPaymentAmount: subscription.latestInvoiceSummary?.amountPaid || 0,
    }));

  const { page, limit } = parsePagination(query);
  return paginateArray(filteredSubscriptions, { page, limit });
};

export const getAdminSubscriptionById = async (subscriptionId) => {
  const subscription = await syncLocalSubscriptionWithStripe(await getSubscriptionByIdOrThrow(subscriptionId));
  const invoices = await SubscriptionInvoice.find({ subscription: subscription._id })
    .populate("user", PUBLIC_USER_FIELDS)
    .sort({ createdAt: -1 });

  let upcomingInvoice = null;

  if (
    isStripeConfigured() &&
    subscription.localStatus !== "canceled" &&
    subscription.localStatus !== "suspended"
  ) {
    try {
      const stripe = getStripeClient();
      const stripeUpcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: subscription.stripeCustomerId,
        subscription: subscription.stripeSubscriptionId,
      });

      upcomingInvoice = {
        subscriptionId: subscription._id,
        stripeInvoiceId: stripeUpcomingInvoice.id || "",
        currency: stripeUpcomingInvoice.currency || subscription.amountSnapshot.currency,
        subtotal: fromAmountInCents(stripeUpcomingInvoice.subtotal),
        taxAmount: fromAmountInCents(stripeUpcomingInvoice.tax),
        total: fromAmountInCents(stripeUpcomingInvoice.total),
        nextBillingDate: toDate(stripeUpcomingInvoice.period_end) || subscription.nextBillingDate,
      };
    } catch (_error) {
      upcomingInvoice = null;
    }
  }

  return {
    subscription: serializeSubscription(subscription),
    billingHistory: invoices.map(serializeInvoice),
    upcomingInvoice,
  };
};

export const suspendSubscriptionByAdmin = async (subscriptionId) => {
  const subscription = await getSubscriptionByIdOrThrow(subscriptionId);
  const stripe = getStripeClient();
  const canceledStripeSubscription = await stripe.subscriptions.cancel(
    subscription.stripeSubscriptionId
  );

  subscription.stripeStatus = canceledStripeSubscription.status;
  subscription.localStatus = "suspended";
  subscription.cancelAtPeriodEnd = false;
  subscription.canceledAt = toDate(canceledStripeSubscription.canceled_at) || new Date();
  subscription.suspendedAt = new Date();
  subscription.lastSyncedAt = new Date();
  await subscription.save();

  return serializeSubscription(await populateSubscription(subscription._id));
};

export const syncSubscriptionByAdmin = async (subscriptionId) => {
  const subscription = await getSubscriptionByIdOrThrow(subscriptionId);
  return serializeSubscription(await syncLocalSubscriptionWithStripe(subscription));
};

export const syncMySubscription = async (authUser) => {
  const subscription = await getCurrentUserActiveSubscription(authUser.userId);

  if (!subscription) {
    throw new AppError("No active subscription found", 404);
  }

  return serializeSubscription(await syncLocalSubscriptionWithStripe(subscription));
};

export const handleStripeWebhookEvent = async (signature, rawBody) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError("Stripe webhook secret is not configured", 500);
  }

  const stripe = getStripeClient();
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  if (event.type.startsWith("customer.subscription.")) {
    const stripeSubscription = event.data.object;
    const metadata = stripeSubscription.metadata || {};
    const user = await User.findById(metadata.userId);

    if (user) {
      const pricing = await Pricing.findOne();
      const matchingPlan = pricing?.plans.find((plan) => plan.planType === metadata.planType);

      if (matchingPlan) {
        const localSubscription = await upsertLocalSubscriptionFromStripe({
          user,
          pricing,
          plan: matchingPlan,
          stripeSubscription,
          billingCycle: metadata.billingCycle || "monthly",
          billingAddress: {},
          subscriptionTopic: metadata.subscriptionTopic || matchingPlan.title,
          paymentMethodId: "",
          lastWebhookEvent: event.type,
        });

        if (stripeSubscription.latest_invoice && typeof stripeSubscription.latest_invoice === "object") {
          await syncInvoiceRecord({
            localSubscription,
            stripeInvoice: stripeSubscription.latest_invoice,
            user,
          });
        }
      }
    }
  }

  if (event.type.startsWith("invoice.")) {
    const stripeInvoice = event.data.object;
    const localSubscription = await UserSubscription.findOne({
      stripeSubscriptionId:
        typeof stripeInvoice.subscription === "string"
          ? stripeInvoice.subscription
          : stripeInvoice.subscription?.id || "",
    }).populate("user", PUBLIC_USER_FIELDS);

    if (localSubscription?.user) {
      await syncInvoiceRecord({
        localSubscription,
        stripeInvoice,
        user: localSubscription.user,
      });

      localSubscription.lastWebhookEvent = event.type;
      localSubscription.lastSyncedAt = new Date();
      await localSubscription.save();
    }
  }

  return {
    received: true,
    type: event.type,
  };
};
