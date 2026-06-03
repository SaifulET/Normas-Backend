import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import User from "../../auth/models/user.model.js";
import List from "../../list/models/list.model.js";
import { notifySuperadmins, notifyUsers } from "../../notification/services/notification.service.js";
import ModerationAlert from "../models/moderationAlert.model.js";

const userProjection = "name email role profileImage accountStatus";
const listProjection = "title country stage sector fundingTarget keyword description additionalDetails status moderationStatus moderationReasons user createdAt updatedAt";

const bangladeshLocationWords =
  "dhaka|mohakhali|gulshan|banani|uttara|mirpur|dhanmondi|bashundhara|baridhara|badda|tejgaon|farmgate|motijheel|wari|khilgaon|khilkhet|niketon|nikunja|shyamoli|mohammadpur|jatrabari|bashabo|airport|savar|narayanganj|gazipur|chattogram|chittagong|sylhet|khulna|rajshahi|barisal|rangpur|mymensingh|cumilla";

const contactPatterns = [
  ["Phone number", /(?:\+?\d[\d\s().-]{7,}\d)|(?:^\s*(?:number|phone|mobile|cell)\s*$)|(?:\b(?:call|phone|mobile|cell|number)\s*(?:me|us)?\s*(?:at|on)?\s*[:#-]?\s*\d{5,})|(?:\b(?:give|send|share|provide|drop)\s+(?:me|us\s+)?(?:your|you|ur)?\s*(?:phone|mobile|cell|number)\b)|(?:\b(?:your|you|ur)\s+(?:phone|mobile|cell|number)\b)/i],
  ["Email", /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i],
  ["WhatsApp", /\b(?:whats\s*app|whatsapp|wa\.me|api\.whatsapp\.com)\b/i],
  ["Telegram", /\b(?:telegram|t\.me|telegram\.me)\b/i],
  ["Facebook", /\b(?:facebook|fb\.com|facebook\.com|messenger\.com)\b/i],
  ["Instagram", /\b(?:instagram|insta|ig:|instagram\.com)\b/i],
  ["LinkedIn", /\b(?:linkedin|linkedin\.com)\b/i],
  ["Website link", /\b(?:https?:\/\/|www\.)[^\s<]+|\b[a-z0-9-]+\.(?:com|net|org|io|co|ai|app|dev|me|biz|info|bd|uk|us)\b/i],
  ["External handle", /(?:^|\s)@[a-z0-9_.-]{3,}\b/i],
  ["Google Maps link", /\b(?:maps\.app\.goo\.gl|goo\.gl\/maps|google\.com\/maps|maps\.google)\b/i],
  ["Address or location", new RegExp(`\\b(?:address|location|office|home|headquarters|hq|suite|floor|road|rd\\.?|street|st\\.?|avenue|ave\\.?|building|house|flat|apartment|postcode|zip code|area|place)\\b|\\b(?:${bangladeshLocationWords})\\b|\\b\\d{1,6}\\s*[,/-]\\s*(?:${bangladeshLocationWords})\\b`, "i")],
  ["Meeting place", /\b(?:meet|meeting|come to|visit us|drop by|outside the platform|off platform|offline|in person|coffee shop|restaurant|hotel lobby|our office)\b/i],
  ["External communication request", /\b(?:contact me|contact us|reach me|reach us|message me|dm me|text me|call me|email me|connect on|talk on|chat on|send me your|give me (?:your|you|ur)?\s*(?:contact|contacts|contact details|details)|share (?:your|you|ur)?\s*(?:contact|contacts|contact details|details)|send (?:your|you|ur)?\s*(?:contact|contacts|contact details|details))\b/i],
];

const businessKeywords = [
  "business",
  "startup",
  "company",
  "investment",
  "investor",
  "funding",
  "fundraise",
  "seed",
  "series",
  "revenue",
  "growth",
  "market",
  "product",
  "partnership",
  "venture",
  "equity",
  "saas",
  "fintech",
  "healthtech",
  "climate",
  "technology",
  "platform",
  "customers",
  "traction",
  "prototype",
  "mvp",
  "scale",
  "sector",
];

const spamSignals = [
  /\b(?:buy now|free money|guaranteed profit|click here|limited offer|crypto pump|casino|betting|loan approved)\b/i,
  /(.)\1{8,}/,
  /^[^a-z0-9]+$/i,
];

const normalizeText = (value) => String(value || "").trim();

const stripHtml = (value) =>
  normalizeText(value)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const unique = (values = []) => [...new Set(values.filter(Boolean))];

const tokenize = (value) =>
  stripHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);

const stopWords = new Set([
  "and",
  "for",
  "from",
  "into",
  "our",
  "the",
  "this",
  "with",
]);

const tokenizeTopicWords = (value) =>
  tokenize(value).filter((word) => !stopWords.has(word));

const overlapRatio = (firstValue, secondValue) => {
  const first = new Set(tokenizeTopicWords(firstValue));
  const second = new Set(tokenizeTopicWords(secondValue));

  if (first.size === 0 || second.size === 0) {
    return 0;
  }

  const overlap = [...first].filter((word) => second.has(word)).length;
  return overlap / Math.min(first.size, second.size);
};

const titleMatchesDescription = ({ description, title }) => {
  const titleWords = tokenizeTopicWords(title);

  if (titleWords.length === 0) {
    return false;
  }

  return overlapRatio(title, description) >= 0.15;
};

export const detectContactDetails = (value) => {
  const text = stripHtml(value);
  const reasons = contactPatterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([reason]) => reason);

  return {
    flagged: reasons.length > 0,
    reasons: unique(reasons),
  };
};

export const moderateChatMessage = (message) => {
  const contactResult = detectContactDetails(message);

  return {
    restricted: contactResult.flagged,
    reasons: contactResult.reasons,
    status: contactResult.flagged ? "restricted" : "approved",
  };
};

export const moderatePost = (payload = {}) => {
  const title = stripHtml(payload.title);
  const description = stripHtml(payload.description);
  const sector = stripHtml(payload.sector);
  const stage = stripHtml(payload.stage);
  const keyword = stripHtml(payload.keyword);
  const detailText = Array.isArray(payload.additionalDetails)
    ? payload.additionalDetails.map((detail) => `${detail?.key || ""} ${detail?.value || ""}`).join(" ")
    : "";
  const reviewText = [title, description, sector, stage, keyword, detailText].join(" ");
  const contactResult = detectContactDetails(reviewText);
  const reasons = [];

  if (!title || title.length < 6) {
    reasons.push("Title is too short or missing");
  }

  if (!description || description.length < 40) {
    reasons.push("Description is not meaningful enough");
  }

  const lowerText = reviewText.toLowerCase();
  const businessSignalCount = businessKeywords.reduce(
    (count, keywordValue) => count + (lowerText.includes(keywordValue) ? 1 : 0),
    0
  );

  if (businessSignalCount === 0) {
    reasons.push("Post is not clearly related to business, startup, investment, funding, partnership, or growth");
  }

  if (spamSignals.some((pattern) => pattern.test(reviewText))) {
    reasons.push("Post appears to be spam or random content");
  }

  if (title && description && !titleMatchesDescription({ description, title })) {
    reasons.push("Title does not match the description");
  }

  if (contactResult.flagged) {
    reasons.push(...contactResult.reasons.map((reason) => `Contains ${reason.toLowerCase()}`));
  }

  const severeReasons = reasons.filter((reason) =>
    /contact|address|location|meeting|spam|not clearly related|does not match/i.test(reason)
  );

  if (severeReasons.length > 0) {
    return {
      decision: "suspended",
      reasons: unique(reasons),
      alertType: contactResult.flagged ? "post_contact_or_location" : severeReasons.some((reason) => /does not match/i.test(reason))
        ? "post_title_description_mismatch"
        : severeReasons.some((reason) => /spam/i.test(reason))
          ? "post_irrelevant"
          : "post_misleading",
    };
  }

  if (reasons.length > 0 || businessSignalCount < 2) {
    return {
      decision: "manual_review",
      reasons: unique(reasons.length > 0 ? reasons : ["AI moderation is unsure whether this post is investment related"]),
      alertType: "post_manual_review",
    };
  }

  return {
    decision: "approved",
    reasons: [],
    alertType: "",
  };
};

const serializeUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    _id: user._id,
    accountStatus: user.accountStatus,
    email: user.email,
    name: user.name,
    profileImage: user.profileImage || "",
    role: user.role,
  };
};

const serializeList = (list) => {
  if (!list) {
    return null;
  }

  return {
    _id: list._id,
    additionalDetails: list.additionalDetails || [],
    country: list.country,
    createdAt: list.createdAt,
    description: list.description,
    fundingTarget: list.fundingTarget,
    keyword: list.keyword,
    moderationReasons: list.moderationReasons || [],
    moderationStatus: list.moderationStatus || "approved",
    sector: list.sector,
    stage: list.stage,
    status: list.status,
    title: list.title,
    updatedAt: list.updatedAt,
    user: serializeUser(list.user),
  };
};

const serializeAlert = (alert) => ({
  _id: alert._id,
  actions: alert.actions || [],
  conversation: alert.conversation?._id || alert.conversation || null,
  createdAt: alert.createdAt,
  decision: alert.decision || "",
  detectedReasons: alert.detectedReasons || [],
  list: serializeList(alert.list),
  message: alert.message || "",
  messageId: alert.messageId || null,
  metadata: alert.metadata || {},
  receiver: serializeUser(alert.receiver),
  reviewedAt: alert.reviewedAt,
  reviewedBy: serializeUser(alert.reviewedBy),
  sender: serializeUser(alert.sender),
  status: alert.status,
  type: alert.type,
  updatedAt: alert.updatedAt,
  user: serializeUser(alert.user),
});

const populateAlertQuery = (query) =>
  query
    .populate("sender", userProjection)
    .populate("receiver", userProjection)
    .populate("user", userProjection)
    .populate("reviewedBy", userProjection)
    .populate({
      path: "list",
      select: listProjection,
      populate: {
        path: "user",
        select: userProjection,
      },
    });

const getAlertOrThrow = async (alertId) => {
  if (!mongoose.Types.ObjectId.isValid(alertId)) {
    throw new AppError("Invalid alertId", 400);
  }

  const alert = await populateAlertQuery(ModerationAlert.findById(alertId));

  if (!alert) {
    throw new AppError("Moderation alert not found", 404);
  }

  return alert;
};

const ensureSuperadmin = (authUser) => {
  if (!authUser?.userId) {
    throw new AppError("Unauthorized", 401);
  }

  if (authUser.role !== "superadmin") {
    throw new AppError("Forbidden: only superadmin can manage moderation", 403);
  }
};

export const createChatModerationAlert = async ({
  conversation,
  message,
  receiver,
  reasons = [],
  sender,
}) => {
  const alert = await ModerationAlert.create({
    type: "chat_contact_details",
    sender,
    receiver,
    conversation: conversation?._id || conversation,
    messageId: message?._id,
    message: message?.message || "",
    detectedReasons: reasons,
    decision: "restricted",
    metadata: {
      sentAt: message?.sentAt,
      senderRole: message?.senderRole,
    },
  });

  await notifySuperadmins({
    type: "moderation_alert",
    title: "Chat moderation alert",
    message: "A chat message was restricted for sharing contact or private communication details.",
    referenceType: "moderation_alert",
    referenceId: alert._id,
    metadata: {
      alertId: alert._id,
      conversationId: conversation?._id || conversation,
      messageId: message?._id,
      reasons,
    },
    dedupeKey: `moderation:chat:${conversation?._id || conversation}:${message?._id}`,
  }).catch(() => []);

  return alert;
};

export const createPostModerationAlert = async ({ list, moderationResult }) => {
  if (!moderationResult?.alertType || moderationResult.decision === "approved") {
    return null;
  }

  const alert = await ModerationAlert.create({
    type: moderationResult.alertType,
    user: list.user?._id || list.user,
    list: list._id,
    message: `${list.title || "Untitled pitch"}\n\n${stripHtml(list.description || "")}`,
    detectedReasons: moderationResult.reasons || [],
    decision: moderationResult.decision,
    metadata: {
      title: list.title,
      sector: list.sector,
      stage: list.stage,
      status: list.status,
    },
  });

  await notifySuperadmins({
    type: "moderation_alert",
    title: "Post moderation alert",
    message: `${list.title || "A pitch"} needs moderation review.`,
    referenceType: "moderation_alert",
    referenceId: alert._id,
    metadata: {
      alertId: alert._id,
      listId: list._id,
      decision: moderationResult.decision,
      reasons: moderationResult.reasons,
    },
    dedupeKey: `moderation:post:${list._id}:${moderationResult.decision}:${Date.now()}`,
  }).catch(() => []);

  return alert;
};

export const getModerationAlerts = async (authUser, query = {}) => {
  ensureSuperadmin(authUser);

  const filters = {};

  if (query.status) {
    filters.status = query.status;
  }

  if (query.type) {
    filters.type = query.type;
  }

  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const [alerts, total, pendingCount] = await Promise.all([
    populateAlertQuery(ModerationAlert.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit)),
    ModerationAlert.countDocuments(filters),
    ModerationAlert.countDocuments({ status: "pending" }),
  ]);

  return {
    alerts: alerts.map(serializeAlert),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    pendingCount,
  };
};

export const getModerationAlertById = async (authUser, alertId) => {
  ensureSuperadmin(authUser);
  return serializeAlert(await getAlertOrThrow(alertId));
};

export const markAlertReviewed = async (authUser, alertId, note = "") => {
  ensureSuperadmin(authUser);

  const alert = await getAlertOrThrow(alertId);
  alert.status = "reviewed";
  alert.reviewedBy = authUser.userId;
  alert.reviewedAt = new Date();
  alert.actions.push({
    action: "mark_reviewed",
    actor: authUser.userId,
    note: normalizeText(note),
  });
  await alert.save();

  return serializeAlert(await getAlertOrThrow(alert._id));
};

const updateAlertAfterAction = async (authUser, alert, action, note = "") => {
  alert.status = "reviewed";
  alert.reviewedBy = authUser.userId;
  alert.reviewedAt = new Date();
  alert.actions.push({
    action,
    actor: authUser.userId,
    note: normalizeText(note),
  });
  await alert.save();
  return getAlertOrThrow(alert._id);
};

export const approveAlertPost = async (authUser, alertId, note = "") => {
  ensureSuperadmin(authUser);

  const alert = await getAlertOrThrow(alertId);

  if (!alert.list?._id) {
    throw new AppError("This alert is not linked to a post", 400);
  }

  await List.findByIdAndUpdate(alert.list._id, {
    status: "activated",
    moderationStatus: "approved",
    moderationReasons: [],
    moderationReviewedBy: authUser.userId,
    moderationReviewedAt: new Date(),
  });

  return serializeAlert(await updateAlertAfterAction(authUser, alert, "approve_post", note));
};

export const keepAlertPostSuspended = async (authUser, alertId, note = "") => {
  ensureSuperadmin(authUser);

  const alert = await getAlertOrThrow(alertId);

  if (!alert.list?._id) {
    throw new AppError("This alert is not linked to a post", 400);
  }

  await List.findByIdAndUpdate(alert.list._id, {
    status: "suspended",
    moderationStatus: "suspended",
    moderationReviewedBy: authUser.userId,
    moderationReviewedAt: new Date(),
  });

  return serializeAlert(await updateAlertAfterAction(authUser, alert, "keep_post_suspended", note));
};

export const deleteAlertPost = async (authUser, alertId, note = "") => {
  ensureSuperadmin(authUser);

  const alert = await getAlertOrThrow(alertId);

  if (!alert.list?._id) {
    throw new AppError("This alert is not linked to a post", 400);
  }

  await List.findByIdAndDelete(alert.list._id);

  return serializeAlert(await updateAlertAfterAction(authUser, alert, "delete_post", note));
};

export const warnAlertUser = async (authUser, alertId, note = "") => {
  ensureSuperadmin(authUser);

  const alert = await getAlertOrThrow(alertId);
  const targetUserId = alert.user?._id || alert.sender?._id;

  if (!targetUserId) {
    throw new AppError("This alert is not linked to a user", 400);
  }

  await notifyUsers([targetUserId], {
    type: "moderation_warning",
    title: "Moderation warning",
    message: normalizeText(note) || "A superadmin reviewed your content and issued a moderation warning.",
    referenceType: "moderation_alert",
    referenceId: alert._id,
    metadata: {
      alertId: alert._id,
    },
  }).catch(() => []);

  return serializeAlert(await updateAlertAfterAction(authUser, alert, "warn_user", note));
};

export const suspendAlertUser = async (authUser, alertId, note = "") => {
  ensureSuperadmin(authUser);

  const alert = await getAlertOrThrow(alertId);
  const targetUserId = alert.user?._id || alert.sender?._id;

  if (!targetUserId) {
    throw new AppError("This alert is not linked to a user", 400);
  }

  await User.findByIdAndUpdate(targetUserId, { accountStatus: "inactive" });

  return serializeAlert(await updateAlertAfterAction(authUser, alert, "suspend_user", note));
};
