import { createHash, randomUUID } from "crypto";
import { DeleteMessageCommand, ReceiveMessageCommand, SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import AppError from "../../../utils/appError.js";
import User from "../../auth/models/user.model.js";
import {
  getEmailFromHeader,
  getEmailReplyTo,
  getSmtpEnvelopeFrom,
  wrapBrandedEmail,
} from "../../email/services/emailBranding.service.js";
import Notification from "../../notification/models/notification.model.js";
import { notifyUsers } from "../../notification/services/notification.service.js";
import Notice, { noticeTargetTypes } from "../models/notice.model.js";
import NoticeEmailDelivery from "../models/noticeEmailDelivery.model.js";
import { deleteNoticeImageFromS3 } from "./noticeStorage.service.js";

const activeTargetStatuses = ["active", "pending"];
const recipientBatchSize = Number(process.env.NOTICE_RECIPIENT_BATCH_SIZE || 100);
const workerConcurrency = Math.min(Math.max(Number(process.env.NOTICE_WORKER_CONCURRENCY || 5), 1), 10);
const pendingRequeueAfterMs = Number(process.env.NOTICE_PENDING_REQUEUE_AFTER_MS || 120000);

let cachedSqsClient = null;
let cachedSesClient = null;
let cachedSmtpTransporter = null;
let noticeEmailDrainPromise = null;

const normalizeText = (value) => String(value || "").trim();
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parsePagination = ({ page = 1, limit = 20 } = {}) => {
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
  };
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stripHtml = (value) =>
  String(value || "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sanitizeNoticeHtml = (html) =>
  String(html || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|iframe|object|embed|link|meta|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|link|meta|style)\b[^>]*\/?>/gi, "")
    .replace(/\s(?:on[a-z]+)\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi, "");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const parseCustomRecipientEmails = (value) => {
  if (!value) {
    return [];
  }

  let items = value;

  if (typeof value === "string") {
    try {
      items = JSON.parse(value);
    } catch {
      items = value.split(/[\s,;]+/);
    }
  }

  if (!Array.isArray(items)) {
    throw new AppError("customRecipientEmails must be an array of email addresses", 400);
  }

  const emails = [...new Set(items.map(normalizeEmail).filter(Boolean))];
  const invalidEmail = emails.find((email) => !emailPattern.test(email));

  if (invalidEmail) {
    throw new AppError(`Invalid recipient email: ${invalidEmail}`, 400);
  }

  if (emails.length > 100) {
    throw new AppError("A notice can include up to 100 custom recipient emails", 400);
  }

  return emails;
};

const buildCustomRecipientUserId = (email) => {
  const hex = createHash("sha1").update(`notice-custom-recipient:${email}`).digest("hex").slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
};

const getNoticeFolderPrefix = () => `${(process.env.AWS_S3_NOTICE_FOLDER?.trim() || "notices").replace(/^\/+|\/+$/g, "")}/`;

const extractNoticeImageKeys = (html = "") => {
  const keys = new Set();
  const srcPattern = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = srcPattern.exec(String(html || ""))) !== null) {
    try {
      const parsedUrl = new URL(match[1]);
      const key = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));

      if (key.startsWith(getNoticeFolderPrefix())) {
        keys.add(key);
      }
    } catch {
      if (match[1].startsWith(getNoticeFolderPrefix())) {
        keys.add(match[1]);
      }
    }
  }

  return keys;
};

const deleteRemovedNoticeImages = async (previousHtml, nextHtml) => {
  const previousKeys = extractNoticeImageKeys(previousHtml);
  const nextKeys = extractNoticeImageKeys(nextHtml);
  const removedKeys = [...previousKeys].filter((key) => !nextKeys.has(key));

  await Promise.allSettled(removedKeys.map((key) => deleteNoticeImageFromS3(key)));

  return removedKeys;
};

const getAwsRegion = () => {
  const region = process.env.AWS_REGION?.trim();

  if (!region) {
    throw new AppError("AWS_REGION is not configured", 500);
  }

  return region;
};

const getAwsCredentials = () => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;
};

const getSqsClient = () => {
  if (!cachedSqsClient) {
    cachedSqsClient = new SQSClient({
      region: getAwsRegion(),
      credentials: getAwsCredentials(),
    });
  }

  return cachedSqsClient;
};

const getSesClient = () => {
  if (!cachedSesClient) {
    cachedSesClient = new SESClient({
      region: getAwsRegion(),
      credentials: getAwsCredentials(),
    });
  }

  return cachedSesClient;
};

const getNoticeEmailQueueUrl = () => {
  const queueUrl = process.env.AWS_SQS_NOTICE_EMAIL_QUEUE_URL?.trim();

  if (!queueUrl) {
    throw new AppError("AWS_SQS_NOTICE_EMAIL_QUEUE_URL is not configured", 500);
  }

  return queueUrl;
};

const getNoticeEmailProvider = () => {
  const provider = (process.env.NOTICE_EMAIL_PROVIDER || "auto").trim().toLowerCase();

  return ["auto", "ses", "smtp"].includes(provider) ? provider : "auto";
};

const shouldAutoDrainNoticeEmailQueue = () => process.env.NOTICE_AUTO_DRAIN_EMAIL_QUEUE !== "false";

const isSmtpConfigured = () =>
  Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_PORT?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );

const getSmtpTransporter = () => {
  if (!isSmtpConfigured()) {
    throw new AppError("SMTP notice email is not configured", 500);
  }

  if (!cachedSmtpTransporter) {
    const port = Number(process.env.SMTP_PORT || 587);

    cachedSmtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return cachedSmtpTransporter;
};

const getTargetRoles = (targetType) => {
  if (targetType === "all") {
    return ["investor", "investee"];
  }

  if (targetType === "custom") {
    return [];
  }

  return [targetType];
};

const getVisibleTargetTypes = (role) => {
  if (role === "investor") {
    return ["investor", "all"];
  }

  if (role === "investee") {
    return ["investee", "all"];
  }

  return [];
};

const buildNoticeFilterForRole = (role) => ({
  status: { $ne: "archived" },
  targetType: { $in: getVisibleTargetTypes(role) },
});

const getNoticeByIdOrThrow = async (noticeId) => {
  if (!isValidObjectId(noticeId)) {
    throw new AppError("Invalid noticeId", 400);
  }

  const notice = await Notice.findById(noticeId).populate("createdBy", "name email role");

  if (!notice) {
    throw new AppError("Notice not found", 404);
  }

  return notice;
};

const serializeCreator = (creator) => {
  if (!creator || typeof creator !== "object") {
    return creator || null;
  }

  return {
    _id: creator._id,
    name: creator.name,
    email: creator.email,
    role: creator.role,
  };
};

const serializeNotice = (notice, options = {}) => {
  const plainNotice = typeof notice.toObject === "function" ? notice.toObject() : notice;

  return {
    ...plainNotice,
    createdBy: serializeCreator(plainNotice.createdBy),
    isRead: Boolean(options.readAt),
    readAt: options.readAt || null,
  };
};

const getNoticeReadAt = async (authUser, noticeId) => {
  const notification = await Notification.findOne({
    recipient: authUser.userId,
    referenceId: noticeId,
    referenceType: "Notice",
    type: "ADMIN_NOTICE",
  })
    .select("readAt")
    .lean();

  return notification?.readAt || null;
};

const countDeliveryStats = async (noticeId) => {
  const rows = await NoticeEmailDelivery.aggregate([
    { $match: { notice: new mongoose.Types.ObjectId(noticeId) } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const stats = {
    pending: 0,
    queued: 0,
    sent: 0,
    failed: 0,
    total: 0,
  };

  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(stats, row._id)) {
      stats[row._id] = row.count;
      stats.total += row.count;
    }
  }

  return stats;
};

const refreshNoticeEmailStats = async (noticeId) => {
  const stats = await countDeliveryStats(noticeId);
  await Notice.findByIdAndUpdate(noticeId, { emailStats: stats });
  return stats;
};

const queueNoticeEmailDelivery = async ({ notice, user = null, recipientEmail = "", recipientType = "user" }) => {
  const normalizedRecipientEmail = normalizeEmail(recipientEmail || user?.email);

  if (!normalizedRecipientEmail || !emailPattern.test(normalizedRecipientEmail)) {
    throw new AppError("A valid recipient email is required", 400);
  }

  const deliveryUserId = user?._id || buildCustomRecipientUserId(normalizedRecipientEmail);
  const normalizedRecipientType = user?._id ? "user" : recipientType;

  const delivery = await NoticeEmailDelivery.findOneAndUpdate(
    {
      notice: notice._id,
      recipientEmail: normalizedRecipientEmail,
    },
    {
      $setOnInsert: {
        jobId: randomUUID(),
        notice: notice._id,
        recipientEmail: normalizedRecipientEmail,
        recipientType: normalizedRecipientType,
        status: "pending",
        user: deliveryUserId,
      },
    },
    {
      new: true,
      setDefaultsOnInsert: true,
      upsert: true,
    }
  );

  if (delivery.status === "queued" || delivery.status === "sent") {
    return delivery;
  }

  try {
    await getSqsClient().send(
      new SendMessageCommand({
        QueueUrl: getNoticeEmailQueueUrl(),
        MessageBody: JSON.stringify({
          jobId: delivery.jobId,
          noticeId: notice._id.toString(),
          recipientEmail: normalizedRecipientEmail,
          recipientType: normalizedRecipientType,
          userId: deliveryUserId.toString(),
        }),
      })
    );
  } catch (error) {
    delivery.status = "failed";
    delivery.failedAt = new Date();
    delivery.attempts += 1;
    delivery.lastError = error.message || "SQS queue failed";
    await delivery.save();
    throw error;
  }

  delivery.status = "queued";
  delivery.queuedAt = delivery.queuedAt || new Date();
  delivery.failedAt = null;
  delivery.lastError = "";
  await delivery.save();

  return delivery;
};

const createNoticeNotificationBatch = async (notice, users) => {
  const notificationMessage = stripHtml(notice.message).slice(0, 500) || notice.title;

  await notifyUsers(users.map((user) => user._id), {
    type: "ADMIN_NOTICE",
    title: notice.title,
    message: notificationMessage,
    referenceId: notice._id,
    referenceType: "Notice",
    metadata: {
      imageUrl: notice.image?.url || "",
      noticeId: notice._id.toString(),
      targetType: notice.targetType,
    },
    dedupeKey: `admin_notice:${notice._id}`,
  });
};

export const processNoticeRecipients = async (noticeId) => {
  const notice = await Notice.findById(noticeId);

  if (!notice || notice.status === "archived") {
    return null;
  }

  const roles = getTargetRoles(notice.targetType);
  let lastId = null;
  let failedCount = 0;

  while (true) {
    const filters = {
      accountStatus: { $in: activeTargetStatuses },
      role: { $in: roles },
    };

    if (lastId) {
      filters._id = { $gt: lastId };
    }

    const users = await User.find(filters)
      .select("_id email role accountStatus")
      .sort({ _id: 1 })
      .limit(recipientBatchSize)
      .lean();

    if (users.length === 0) {
      break;
    }

    lastId = users[users.length - 1]._id;

    try {
      await createNoticeNotificationBatch(notice, users);
    } catch (error) {
      failedCount += users.length;
      console.error("Notice dashboard notification batch failed:", error.message);
    }

    const deliveryResults = await Promise.allSettled(
      users.map((user) => queueNoticeEmailDelivery({ notice, user }))
    );

    failedCount += deliveryResults.filter((result) => result.status === "rejected").length;
  }

  const customRecipients = (notice.customRecipients || []).map((recipient) => recipient.email).filter(Boolean);

  if (customRecipients.length > 0) {
    const customDeliveryResults = await Promise.allSettled(
      customRecipients.map((email) => queueNoticeEmailDelivery({ notice, recipientEmail: email, recipientType: "custom" }))
    );

    failedCount += customDeliveryResults.filter((result) => result.status === "rejected").length;
  }

  const emailStats = await refreshNoticeEmailStats(notice._id);
  notice.status = failedCount > 0 || emailStats.failed > 0 ? "partially_failed" : "published";
  notice.emailStats = emailStats;
  await notice.save();

  return serializeNotice(notice);
};

const autoDrainNoticeEmailQueue = () => {
  if (!shouldAutoDrainNoticeEmailQueue() || noticeEmailDrainPromise) {
    return;
  }

  noticeEmailDrainPromise = drainNoticeEmailQueue()
    .then((result) => {
      console.log("Notice email auto drain complete:", JSON.stringify(result));
    })
    .catch((error) => {
      console.error("Notice email auto drain failed:", error.message);
    })
    .finally(() => {
      noticeEmailDrainPromise = null;
    });
};

export const recoverNoticeDispatches = async () => {
  const processingNotices = await Notice.find({
    status: "processing",
  })
    .sort({ createdAt: 1 })
    .limit(25);

  let processedNotices = 0;
  let failedNotices = 0;

  for (const notice of processingNotices) {
    try {
      await processNoticeRecipients(notice._id);
      processedNotices += 1;
    } catch (error) {
      failedNotices += 1;
      console.error(`Notice dispatch recovery failed for ${notice._id}:`, error.message);
    }
  }

  const stalePendingDate = new Date(Date.now() - pendingRequeueAfterMs);
  const pendingDeliveries = await NoticeEmailDelivery.find({
    status: "pending",
    updatedAt: { $lte: stalePendingDate },
  })
    .sort({ updatedAt: 1 })
    .limit(500);

  let requeuedPendingEmails = 0;
  let failedPendingEmails = 0;

  for (const delivery of pendingDeliveries) {
    try {
      const notice = await Notice.findById(delivery.notice);

      if (!notice || notice.status === "archived") {
        delivery.status = "failed";
        delivery.failedAt = new Date();
        delivery.lastError = "Notice is no longer eligible";
        await delivery.save();
        failedPendingEmails += 1;
        continue;
      }

      if (delivery.recipientType === "custom") {
        await queueNoticeEmailDelivery({ notice, recipientEmail: delivery.recipientEmail, recipientType: "custom" });
        requeuedPendingEmails += 1;
        continue;
      }

      const user = await User.findOne({
        _id: delivery.user,
        accountStatus: { $in: activeTargetStatuses },
      }).select("_id email role accountStatus");

      if (!user || !getTargetRoles(notice.targetType).includes(user.role)) {
        delivery.status = "failed";
        delivery.failedAt = new Date();
        delivery.lastError = "Recipient is no longer eligible";
        await delivery.save();
        failedPendingEmails += 1;
        continue;
      }

      await queueNoticeEmailDelivery({ notice, user });
      requeuedPendingEmails += 1;
    } catch (error) {
      failedPendingEmails += 1;
      console.error(`Pending notice email recovery failed for ${delivery._id}:`, error.message);
    }
  }

  return {
    processedNotices,
    failedNotices,
    scannedPendingEmails: pendingDeliveries.length,
    requeuedPendingEmails,
    failedPendingEmails,
  };
};

export const createNotice = async (authUser, payload = {}) => {
  const title = normalizeText(payload.title);
  const message = sanitizeNoticeHtml(normalizeText(payload.message));
  const targetType = normalizeText(payload.targetType);
  const customRecipientEmails = parseCustomRecipientEmails(payload.customRecipientEmails);

  if (!title) {
    throw new AppError("title is required", 400);
  }

  if (!message) {
    throw new AppError("message is required", 400);
  }

  if (!noticeTargetTypes.includes(targetType)) {
    throw new AppError("targetType must be investor, investee, all, or custom", 400);
  }

  if (targetType === "custom" && customRecipientEmails.length === 0) {
    throw new AppError("At least one additional email recipient is required when no audience is selected", 400);
  }

  const notice = await Notice.create({
    title,
    message,
    targetType,
    image: payload.image || null,
    customRecipients: customRecipientEmails.map((email) => ({ email })),
    createdBy: authUser.userId,
    status: "processing",
    publishedAt: new Date(),
  });

  setImmediate(() => {
    processNoticeRecipients(notice._id)
      .then(() => {
        autoDrainNoticeEmailQueue();
      })
      .catch((error) => {
        console.error("Notice recipient processing failed:", error.message);
        Notice.findByIdAndUpdate(notice._id, { status: "partially_failed" }).catch(() => undefined);
      });
  });

  return serializeNotice(notice);
};

export const updateNotice = async (noticeId, payload = {}) => {
  const notice = await getNoticeByIdOrThrow(noticeId);
  const previousMessage = notice.message;
  const title = normalizeText(payload.title);
  const message = sanitizeNoticeHtml(normalizeText(payload.message));

  if (!title) {
    throw new AppError("title is required", 400);
  }

  if (!stripHtml(message) && extractNoticeImageKeys(message).size === 0) {
    throw new AppError("message is required", 400);
  }

  notice.title = title;
  notice.message = message;
  await notice.save();

  await deleteRemovedNoticeImages(previousMessage, message);

  await Notification.updateMany(
    {
      referenceId: notice._id,
      referenceType: "Notice",
      type: "ADMIN_NOTICE",
    },
    {
      $set: {
        title: notice.title,
        message: stripHtml(notice.message).slice(0, 500) || notice.title,
      },
    }
  );

  return serializeNotice(notice);
};

export const getSuperadminNotices = async (query = {}) => {
  const { page, limit } = parsePagination(query);
  const status = normalizeText(query.status);
  const targetType = normalizeText(query.targetType);
  const filters = {};

  if (status) {
    filters.status = status;
  }

  if (targetType) {
    if (!noticeTargetTypes.includes(targetType)) {
      throw new AppError("targetType must be investor, investee, all, or custom", 400);
    }

    filters.targetType = targetType;
  }

  const [notices, total] = await Promise.all([
    Notice.find(filters)
      .populate("createdBy", "name email role")
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notice.countDocuments(filters),
  ]);

  return {
    notices: notices.map((notice) => serializeNotice(notice)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getSuperadminNoticeById = async (noticeId) => {
  const notice = await getNoticeByIdOrThrow(noticeId);
  const recentFailures = await NoticeEmailDelivery.find({
    notice: notice._id,
    status: "failed",
  })
    .select("recipientEmail attempts lastError failedAt updatedAt")
    .sort({ updatedAt: -1 })
    .limit(25)
    .lean();

  return {
    ...serializeNotice(notice),
    failedEmails: recentFailures,
  };
};

export const archiveNotice = async (noticeId) => {
  const notice = await getNoticeByIdOrThrow(noticeId);
  notice.status = "archived";
  await notice.save();
  return serializeNotice(notice);
};

export const deleteNotice = async (noticeId) => {
  const notice = await getNoticeByIdOrThrow(noticeId);
  const imageKeys = new Set(extractNoticeImageKeys(notice.message));

  if (notice.image?.key) {
    imageKeys.add(notice.image.key);
  }

  await Promise.allSettled([...imageKeys].map((key) => deleteNoticeImageFromS3(key)));

  await Promise.all([
    NoticeEmailDelivery.deleteMany({ notice: notice._id }),
    Notification.deleteMany({
      referenceId: notice._id,
      referenceType: "Notice",
      type: "ADMIN_NOTICE",
    }),
    Notice.deleteOne({ _id: notice._id }),
  ]);

  return {
    id: notice._id,
  };
};

export const retryFailedNoticeEmails = async (noticeId) => {
  const notice = await getNoticeByIdOrThrow(noticeId);
  let queued = 0;
  let failed = 0;
  let lastId = null;

  while (true) {
    const filters = {
      notice: notice._id,
      status: "failed",
    };

    if (lastId) {
      filters._id = { $gt: lastId };
    }

    const deliveries = await NoticeEmailDelivery.find(filters)
      .sort({ _id: 1 })
      .limit(recipientBatchSize);

    if (deliveries.length === 0) {
      break;
    }

    lastId = deliveries[deliveries.length - 1]._id;

    const userDeliveries = deliveries.filter((delivery) => delivery.recipientType !== "custom");
    const users = await User.find({
      _id: { $in: userDeliveries.map((delivery) => delivery.user) },
      accountStatus: { $in: activeTargetStatuses },
      role: { $in: getTargetRoles(notice.targetType) },
    })
      .select("_id email role accountStatus")
      .lean();
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));

    const results = await Promise.allSettled(
      deliveries.map((delivery) => {
        if (delivery.recipientType === "custom") {
          delivery.status = "pending";
          return delivery
            .save()
            .then(() =>
              queueNoticeEmailDelivery({
                notice,
                recipientEmail: delivery.recipientEmail,
                recipientType: "custom",
              })
            );
        }

        const user = usersById.get(delivery.user.toString());

        if (!user) {
          return Promise.reject(new Error("Recipient is no longer eligible"));
        }

        delivery.status = "pending";
        return delivery.save().then(() => queueNoticeEmailDelivery({ notice, user }));
      })
    );

    queued += results.filter((result) => result.status === "fulfilled").length;
    failed += results.filter((result) => result.status === "rejected").length;
  }

  const emailStats = await refreshNoticeEmailStats(notice._id);
  notice.emailStats = emailStats;

  if (notice.status !== "archived") {
    notice.status = emailStats.failed > 0 ? "partially_failed" : "published";
    await notice.save();
  }

  return {
    failed,
    queued,
    emailStats,
  };
};

export const getRoleNotices = async (authUser, query = {}) => {
  const { page, limit } = parsePagination(query);
  const filter = buildNoticeFilterForRole(authUser.role);

  if (filter.targetType.$in.length === 0) {
    throw new AppError("Forbidden", 403);
  }

  const [notices, total, notifications] = await Promise.all([
    Notice.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notice.countDocuments(filter),
    Notification.find({
      recipient: authUser.userId,
      referenceType: "Notice",
      type: "ADMIN_NOTICE",
    })
      .select("referenceId readAt")
      .lean(),
  ]);
  const readAtByNoticeId = new Map(notifications.map((item) => [item.referenceId?.toString(), item.readAt || null]));

  return {
    notices: notices.map((notice) =>
      serializeNotice(notice, { readAt: readAtByNoticeId.get(notice._id.toString()) || null })
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getRoleNoticeById = async (authUser, noticeId) => {
  const notice = await getNoticeByIdOrThrow(noticeId);
  const visibleTargetTypes = getVisibleTargetTypes(authUser.role);

  if (notice.status === "archived" || !visibleTargetTypes.includes(notice.targetType)) {
    throw new AppError("Notice not found", 404);
  }

  return serializeNotice(notice, {
    readAt: await getNoticeReadAt(authUser, notice._id),
  });
};

export const markRoleNoticeAsRead = async (authUser, noticeId) => {
  const notice = await getRoleNoticeById(authUser, noticeId);
  const readAt = new Date();

  await Notification.updateMany(
    {
      recipient: authUser.userId,
      referenceId: notice._id,
      referenceType: "Notice",
      type: "ADMIN_NOTICE",
      readAt: null,
    },
    {
      $set: { readAt },
    }
  );

  return {
    ...notice,
    isRead: true,
    readAt,
  };
};

const buildDashboardPath = (user, noticeId) => {
  const dashboardPath = user.role === "investee" ? "investee-dashboard" : "dashboard";
  return `/${dashboardPath}/notices/${noticeId}`;
};

const buildDashboardUrl = (user, noticeId) => {
  const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${frontendUrl}${buildDashboardPath(user, noticeId)}`;
};

const buildNoticeLoginUrl = (user, noticeId) => {
  const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${frontendUrl}/login?redirect=${encodeURIComponent(buildDashboardPath(user, noticeId))}`;
};

const buildNoticeEmail = ({ notice, user }) => {
  const canOpenDashboardNotice = Boolean(user?.role);
  const dashboardUrl = canOpenDashboardNotice ? buildDashboardUrl(user, notice._id) : "";
  const noticeEntryUrl = canOpenDashboardNotice ? buildNoticeLoginUrl(user, notice._id) : "";
  const title = escapeHtml(notice.title);
  const message = sanitizeNoticeHtml(notice.message);
  const textMessage = stripHtml(notice.message);
  const imageHtml = notice.image?.url
    ? `<img src="${escapeHtml(notice.image.url)}" alt="" style="display:block;width:100%;max-width:456px;border-radius:8px;margin:20px 0;border:1px solid #D8E0EC;" />`
    : "";
  const actionHtml = canOpenDashboardNotice
    ? `
      <p style="margin:24px 0 0 0;">
        <a href="${escapeHtml(noticeEntryUrl)}" style="display:inline-block;background:#314B6B;color:#FFFFFF;text-decoration:none;border-radius:8px;padding:11px 18px;font-size:13px;font-weight:700;">Open notice</a>
      </p>
    `
    : "";

  const bodyHtml = `
    <p style="margin:0 0 14px 0;font-size:12px;line-height:1.5;color:#51627C;">Hello ${escapeHtml(user.name || "there")},</p>
    <h1 style="margin:0 0 14px 0;font-size:20px;line-height:1.25;color:#17213F;font-weight:800;">${title}</h1>
    ${imageHtml}
    <div style="font-size:13px;line-height:1.7;color:#344054;">${message}</div>
    ${actionHtml}
  `;

  return {
    html: wrapBrandedEmail({
      title: notice.title,
      previewText: textMessage || notice.title,
      bodyHtml,
    }),
    text: [
      `Hello ${user.name || "there"},`,
      "",
      notice.title,
      "",
      textMessage,
      ...(canOpenDashboardNotice ? ["", `Open notice: ${noticeEntryUrl}`, "", `Direct notice link: ${dashboardUrl}`] : []),
    ].join("\n"),
  };
};

const sendNoticeEmailWithSes = async ({ delivery, email, notice }) => {
  const response = await getSesClient().send(
    new SendEmailCommand({
      Source: getEmailFromHeader(),
      Destination: {
        ToAddresses: [delivery.recipientEmail],
      },
      ReplyToAddresses: getEmailReplyTo() ? [getEmailReplyTo()] : undefined,
      Message: {
        Subject: {
          Charset: "UTF-8",
          Data: notice.title,
        },
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: email.html,
          },
          Text: {
            Charset: "UTF-8",
            Data: email.text,
          },
        },
      },
    })
  );

  return response.MessageId || "";
};

const sendNoticeEmailWithSmtp = async ({ delivery, email, notice }) => {
  const replyTo = getEmailReplyTo();
  const envelopeFrom = getSmtpEnvelopeFrom();
  const response = await getSmtpTransporter().sendMail({
    from: getEmailFromHeader(),
    to: delivery.recipientEmail,
    ...(replyTo ? { replyTo } : {}),
    ...(envelopeFrom ? { envelope: { from: envelopeFrom, to: delivery.recipientEmail } } : {}),
    subject: notice.title,
    html: email.html,
    text: email.text,
  });

  return response.messageId || "";
};

const sendNoticeEmail = async ({ delivery, email, notice }) => {
  const provider = getNoticeEmailProvider();

  if (provider === "smtp") {
    return sendNoticeEmailWithSmtp({ delivery, email, notice });
  }

  if (provider === "ses") {
    return sendNoticeEmailWithSes({ delivery, email, notice });
  }

  try {
    return await sendNoticeEmailWithSes({ delivery, email, notice });
  } catch (error) {
    if (!isSmtpConfigured()) {
      throw error;
    }

    console.error("SES notice email failed; falling back to SMTP:", error.message);
    return sendNoticeEmailWithSmtp({ delivery, email, notice });
  }
};

export const deleteUploadedNoticeImage = async (key) => {
  const normalizedKey = normalizeText(key);

  if (!normalizedKey.startsWith(getNoticeFolderPrefix())) {
    throw new AppError("Invalid notice image key", 400);
  }

  await deleteNoticeImageFromS3(normalizedKey);

  return {
    key: normalizedKey,
  };
};

export const processNoticeEmailJob = async (job) => {
  const jobId = normalizeText(job?.jobId);

  if (!jobId) {
    throw new AppError("Notice email jobId is required", 400);
  }

  const delivery = await NoticeEmailDelivery.findOne({ jobId });

  if (!delivery) {
    throw new AppError("Notice email delivery job not found", 404);
  }

  if (delivery.status === "sent") {
    return delivery;
  }

  const [notice, user] = await Promise.all([
    Notice.findById(delivery.notice),
    delivery.recipientType === "custom"
      ? Promise.resolve(null)
      : User.findById(delivery.user).select("name email role accountStatus"),
  ]);

  if (!notice) {
    throw new AppError("Notice not found", 404);
  }

  if (delivery.recipientType !== "custom" && (!user || !activeTargetStatuses.includes(user.accountStatus) || !getTargetRoles(notice.targetType).includes(user.role))) {
    throw new AppError("Recipient is no longer eligible", 400);
  }

  const email = buildNoticeEmail({
    notice,
    user: user || {
      email: delivery.recipientEmail,
      name: "",
      role: "",
    },
  });

  try {
    const providerMessageId = await sendNoticeEmail({ delivery, email, notice });

    delivery.status = "sent";
    delivery.sentAt = new Date();
    delivery.failedAt = null;
    delivery.lastError = "";
    delivery.providerMessageId = providerMessageId;
    await delivery.save();
    await refreshNoticeEmailStats(notice._id);
    return delivery;
  } catch (error) {
    delivery.status = "failed";
    delivery.failedAt = new Date();
    delivery.attempts += 1;
    delivery.lastError = error.message || "Notice email delivery failed";
    await delivery.save();
    await refreshNoticeEmailStats(notice._id);
    throw error;
  }
};

const parseSqsBody = (message) => {
  try {
    return JSON.parse(message.Body || "{}");
  } catch {
    throw new AppError("Invalid SQS notice email body", 400);
  }
};

export const pollNoticeEmailQueueOnce = async ({ waitTimeSeconds = 20, visibilityTimeout = 60 } = {}) => {
  const queueUrl = getNoticeEmailQueueUrl();
  const response = await getSqsClient().send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: workerConcurrency,
      WaitTimeSeconds: waitTimeSeconds,
      VisibilityTimeout: visibilityTimeout,
    })
  );
  const messages = response.Messages || [];

  const results = await Promise.allSettled(
    messages.map(async (message) => {
      await processNoticeEmailJob(parseSqsBody(message));
      await getSqsClient().send(
        new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        })
      );
    })
  );

  results
    .filter((result) => result.status === "rejected")
    .forEach((result) => {
      console.error("Notice email message failed:", result.reason?.message || result.reason);
    });

  return messages.length;
};

export const drainNoticeEmailQueue = async ({ idleCycles = 1, maxCycles = 100, waitTimeSeconds = 2 } = {}) => {
  let emptyCycles = 0;
  let cycles = 0;
  let processedMessages = 0;

  while (cycles < maxCycles && emptyCycles < idleCycles) {
    cycles += 1;
    const messageCount = await pollNoticeEmailQueueOnce({
      waitTimeSeconds,
      visibilityTimeout: 60,
    });

    processedMessages += messageCount;
    emptyCycles = messageCount === 0 ? emptyCycles + 1 : 0;
  }

  return {
    cycles,
    processedMessages,
    stoppedBecause: emptyCycles >= idleCycles ? "idle" : "max_cycles",
  };
};

export const startNoticeEmailWorker = async () => {
  if (getNoticeEmailProvider() === "smtp") {
    getSmtpTransporter();
  } else {
    getEmailFromHeader();
  }

  while (true) {
    try {
      await pollNoticeEmailQueueOnce();
    } catch (error) {
      console.error("Notice email worker cycle failed:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};
