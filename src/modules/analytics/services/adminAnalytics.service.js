import User from "../../auth/models/user.model.js";
import UserSubscription from "../../pricing/models/subscription.model.js";
import SubscriptionInvoice from "../../pricing/models/subscriptionInvoice.model.js";

const PLAN_DEFINITIONS = {
  basic: { color: "#2F4463", label: "Investor Basic", statLabel: "Investor Basic Plan" },
  pro: { color: "#D2A3A3", label: "Investor Pro", statLabel: "Investor Pro Plan" },
  investee: { color: "#EB6A00", label: "Investee", statLabel: "Investee Plan" },
};

const ACTIVE_SUBSCRIPTION_STATUSES = ["pending", "active", "cancel_at_period_end", "past_due", "incomplete", "unpaid"];

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const shortDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const joinedDateFormatter = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" });
const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getPeriod = ({ endDate, range = "today", startDate } = {}) => {
  const now = new Date();
  let start = startOfDay(now);
  let end = endOfDay(now);
  let note = "Today";

  if (range === "7d") {
    start = startOfDay(addDays(now, -6));
    note = "Last 7 days";
  } else if (range === "30d") {
    start = startOfDay(addDays(now, -29));
    note = "Last 30 days";
  } else if (range === "custom") {
    const parsedStart = parseDate(startDate);
    const parsedEnd = parseDate(endDate);

    start = parsedStart ? startOfDay(parsedStart) : startOfDay(addDays(now, -29));
    end = parsedEnd ? endOfDay(parsedEnd) : end;

    if (start > end) {
      const previousStart = start;
      start = startOfDay(end);
      end = endOfDay(previousStart);
    }

    note = "Custom";
  }

  const duration = end.getTime() - start.getTime() + 1;
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration + 1);

  return { end, note, previousEnd, previousStart, start };
};

const createPlanTotals = () => ({ basic: 0, investee: 0, pro: 0 });
const roundMoney = (value) => Number(Number(value || 0).toFixed(2));
const getInvoiceDate = (invoice) => invoice.paidAt || invoice.createdAt;
const getInvoiceAmount = (invoice) => roundMoney(invoice.amountPaid || invoice.total || invoice.amountDue || 0);

const classifyPlan = (record = {}) => {
  const subscription = record.subscription || {};
  const role = record.role || subscription.role || record.user?.role || "";
  const tier = record.planTier || subscription.planTier || "";
  const text = [
    record.planType,
    record.planTitle,
    record.subscriptionTopic,
    subscription.planType,
    subscription.planTitle,
    subscription.subscriptionTopic,
    role,
    tier,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (role === "investee" || text.includes("investee")) return "investee";
  if (tier === "pro" || text.includes("pro")) return "pro";
  return "basic";
};

const getPaymentStatus = (subscription) => {
  const invoiceStatus = String(subscription.latestInvoiceSummary?.status || "").toLowerCase();
  const localStatus = String(subscription.localStatus || "").toLowerCase();

  if (invoiceStatus === "paid") return "Paid";
  if (["failed", "uncollectible", "void"].includes(invoiceStatus) || ["past_due", "unpaid", "canceled", "suspended"].includes(localStatus)) return "Failed";
  if (["pending", "open", "draft"].includes(invoiceStatus) || ["pending", "incomplete"].includes(localStatus)) return "Pending";
  return "Active";
};

const getInitials = (name = "") => {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "NA";
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
};

const formatChange = (current, previous) => {
  if (!previous && !current) return { accent: "green", change: "+ 0%" };
  if (!previous) return { accent: "green", change: "+ 100%" };

  const percentage = Math.round(((current - previous) / previous) * 100);
  return {
    accent: percentage < 0 ? "red" : "green",
    change: `${percentage >= 0 ? "+" : "-"} ${Math.abs(percentage)}%`,
  };
};

const buildStatCards = (currentTotals, previousTotals, note) => {
  const planCards = Object.entries(PLAN_DEFINITIONS).map(([key, definition]) => ({
    ...formatChange(currentTotals[key], previousTotals[key]),
    label: definition.statLabel,
    note: note === "Today" ? "vs yesterday" : note.toLowerCase(),
    value: currencyFormatter.format(currentTotals[key]),
  }));
  const currentTotal = Object.values(currentTotals).reduce((sum, value) => sum + value, 0);

  return [...planCards, { icon: "edit", label: "Total Revenue", note, value: currencyFormatter.format(currentTotal) }];
};

const buildBuckets = (start, end, count = 7) => {
  const duration = end.getTime() - start.getTime() + 1;
  const bucketDuration = duration / count;

  return Array.from({ length: count }, (_, index) => {
    const bucketStart = new Date(start.getTime() + bucketDuration * index);
    const bucketEnd = index === count - 1 ? end : new Date(start.getTime() + bucketDuration * (index + 1) - 1);
    const days = duration / 86400000;

    return {
      end: bucketEnd,
      label: days <= 8 ? dayFormatter.format(bucketStart) : shortDateFormatter.format(bucketStart),
      start: bucketStart,
    };
  });
};

const buildLineMetrics = (invoices, period) => {
  const buckets = buildBuckets(period.start, period.end, 7);
  const lines = { basic: Array(7).fill(0), investee: Array(7).fill(0), pro: Array(7).fill(0) };

  invoices.forEach((invoice) => {
    const invoiceDate = getInvoiceDate(invoice);
    const bucketIndex = buckets.findIndex((bucket) => invoiceDate >= bucket.start && invoiceDate <= bucket.end);
    if (bucketIndex < 0) return;

    const planKey = classifyPlan(invoice);
    lines[planKey][bucketIndex] = roundMoney(lines[planKey][bucketIndex] + getInvoiceAmount(invoice));
  });

  return { labels: buckets.map((bucket) => bucket.label), lines };
};

const buildUserMetrics = async () => {
  const now = new Date();
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - 9, 1);
  const users = await User.find({
    createdAt: { $gte: firstMonth, $lte: now },
    role: { $in: ["investor", "investee"] },
  }).select("createdAt");
  const months = Array.from({ length: 10 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 9 + index, 1);
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label: monthFormatter.format(date), value: 0 };
  });

  users.forEach((user) => {
    const createdAt = new Date(user.createdAt);
    const month = months.find((entry) => entry.key === `${createdAt.getFullYear()}-${createdAt.getMonth()}`);
    if (month) month.value += 1;
  });

  return { bars: months.map((month) => month.value), labels: months.map((month) => month.label) };
};

const buildPackageDistribution = async () => {
  const subscriptions = await UserSubscription.find({
    localStatus: { $in: ACTIVE_SUBSCRIPTION_STATUSES },
  }).select("role planType planTier planTitle subscriptionTopic localStatus");
  const counts = createPlanTotals();

  subscriptions.forEach((subscription) => {
    counts[classifyPlan(subscription)] += 1;
  });

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return {
    items: Object.entries(PLAN_DEFINITIONS).map(([key, definition]) => ({
      color: definition.color,
      count: counts[key],
      label: definition.label,
      value: total ? Math.round((counts[key] / total) * 100) : 0,
    })),
    total,
  };
};

const serializeSubscriber = (subscription) => {
  const user = subscription.user || {};
  const joinedAt = subscription.createdAt || user.createdAt;
  const planKey = classifyPlan(subscription);

  return {
    dateJoined: joinedAt ? joinedDateFormatter.format(new Date(joinedAt)) : "",
    id: String(subscription._id),
    initials: getInitials(user.name),
    joinedAt,
    name: user.name || user.email || "Unknown user",
    payment: getPaymentStatus(subscription),
    plan: PLAN_DEFINITIONS[planKey].label,
  };
};

const getRecentSubscribers = async (period) => {
  const subscriptions = await UserSubscription.find({ createdAt: { $gte: period.start, $lte: period.end } })
    .populate("user", "name email role profileImage createdAt")
    .sort({ createdAt: -1 })
    .limit(100);

  return subscriptions.map(serializeSubscriber);
};

const getRevenueInvoices = async (period) => {
  const invoices = await SubscriptionInvoice.find({
    $or: [
      { paidAt: { $gte: period.previousStart, $lte: period.end } },
      { createdAt: { $gte: period.previousStart, $lte: period.end }, paidAt: null },
    ],
    status: "paid",
  }).populate("subscription", "role planType planTier planTitle subscriptionTopic");

  return invoices.filter((invoice) => {
    const invoiceDate = getInvoiceDate(invoice);
    return invoiceDate >= period.previousStart && invoiceDate <= period.end;
  });
};

export const getAdminDashboardAnalytics = async (query = {}) => {
  const period = getPeriod(query);
  const invoices = await getRevenueInvoices(period);
  const currentTotals = createPlanTotals();
  const previousTotals = createPlanTotals();
  const currentInvoices = [];

  invoices.forEach((invoice) => {
    const invoiceDate = getInvoiceDate(invoice);
    const planKey = classifyPlan(invoice);
    const amount = getInvoiceAmount(invoice);

    if (invoiceDate >= period.start && invoiceDate <= period.end) {
      currentTotals[planKey] = roundMoney(currentTotals[planKey] + amount);
      currentInvoices.push(invoice);
    } else if (invoiceDate >= period.previousStart && invoiceDate <= period.previousEnd) {
      previousTotals[planKey] = roundMoney(previousTotals[planKey] + amount);
    }
  });

  const [userMetrics, packageDistribution, subscribers] = await Promise.all([
    buildUserMetrics(),
    buildPackageDistribution(),
    getRecentSubscribers(period),
  ]);
  const lineMetrics = buildLineMetrics(currentInvoices, period);

  return {
    bars: userMetrics.bars,
    barLabels: userMetrics.labels,
    lineLabels: lineMetrics.labels,
    lines: lineMetrics.lines,
    pie: packageDistribution.items,
    pieTotal: packageDistribution.total,
    stats: buildStatCards(currentTotals, previousTotals, period.note),
    subscribers,
  };
};
