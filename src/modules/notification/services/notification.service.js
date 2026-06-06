import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import User from "../../auth/models/user.model.js";
import Schedule from "../../schedule/models/schedule.model.js";
import Notification from "../models/notification.model.js";

const userProjection = "name email role profileImage mobile";
const notificationRoomPrefix = "notification:user:";
const reminderPollMs = Number(process.env.NOTIFICATION_REMINDER_POLL_MS || 60_000);
const dueReminderLookbackMs = Number(process.env.NOTIFICATION_DUE_LOOKBACK_MS || 24 * 60 * 60 * 1000);
let notificationIo = null;
let reminderInterval = null;
let reminderRunInFlight = false;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeLimit = (value) => Math.min(Math.max(Number(value) || 20, 1), 100);

const getEntityId = (entity) => entity?._id || entity;

const getDedupeGroupExpression = () => ({
  $cond: [
    {
      $or: [
        { $eq: ["$dedupeKey", null] },
        { $eq: ["$dedupeKey", ""] },
      ],
    },
    { $toString: "$_id" },
    "$dedupeKey",
  ],
});

const buildNotificationGroupPipeline = (baseFilter, status) => {
  const pipeline = [
    { $match: baseFilter },
    {
      $addFields: {
        __dedupeGroup: getDedupeGroupExpression(),
        __isUnread: { $eq: ["$readAt", null] },
      },
    },
    { $sort: { __isUnread: -1, createdAt: -1 } },
    {
      $group: {
        _id: "$__dedupeGroup",
        hasUnread: { $max: { $cond: ["$__isUnread", 1, 0] } },
        notification: { $first: "$$ROOT" },
      },
    },
  ];

  if (status === "unread") {
    pipeline.push({ $match: { hasUnread: 1 } });
  }

  if (status === "read") {
    pipeline.push({ $match: { hasUnread: 0 } });
  }

  return pipeline;
};

const countGroupedNotifications = async (baseFilter, status) => {
  const [result] = await Notification.aggregate([
    ...buildNotificationGroupPipeline(baseFilter, status),
    { $count: "total" },
  ]);

  return result?.total || 0;
};

const getGroupedNotifications = async (baseFilter, status, skip, limit) =>
  Notification.aggregate([
    ...buildNotificationGroupPipeline(baseFilter, status),
    { $replaceRoot: { newRoot: "$notification" } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { __dedupeGroup: 0, __isUnread: 0 } },
  ]);

export const buildNotificationRoomName = (userId) => `${notificationRoomPrefix}${userId}`;

export const setNotificationSocketServer = (io) => {
  notificationIo = io;
};

const serializeNotification = (notification) => ({
  _id: notification._id,
  recipient: notification.recipient?._id || notification.recipient,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  referenceType: notification.referenceType || "",
  referenceId: notification.referenceId || null,
  metadata: notification.metadata || {},
  readAt: notification.readAt,
  isRead: Boolean(notification.readAt),
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
});

const emitNotification = (notification) => {
  if (!notificationIo || !notification?.recipient) {
    return;
  }

  notificationIo
    .to(buildNotificationRoomName(notification.recipient.toString()))
    .emit("notification:new", serializeNotification(notification));
};

const createNotification = async ({
  recipient,
  type,
  title,
  message,
  referenceType = "",
  referenceId = null,
  metadata = {},
  dedupeKey = "",
}) => {
  if (!recipient || !type || !title || !message) {
    throw new AppError("recipient, type, title and message are required", 400);
  }

  if (dedupeKey) {
    const existingNotification = await Notification.findOne({ dedupeKey });

    if (existingNotification) {
      return existingNotification;
    }
  }

  try {
    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      referenceType,
      referenceId,
      metadata,
      dedupeKey: dedupeKey || undefined,
    });

    emitNotification(notification);
    return notification;
  } catch (error) {
    if (error?.code === 11000 && dedupeKey) {
      return Notification.findOne({ dedupeKey });
    }

    throw error;
  }
};

const getSuperadminIds = async () => {
  const superadmins = await User.find({ role: "superadmin" }).select("_id");
  return superadmins.map((user) => user._id);
};

export const notifyUsers = async (userIds = [], payload = {}) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean).map(String))];

  return Promise.all(
    uniqueUserIds.map((userId) =>
      createNotification({
        ...payload,
        recipient: userId,
        dedupeKey: payload.dedupeKey ? `${payload.dedupeKey}:user:${userId}` : "",
      })
    )
  );
};

export const notifySuperadmins = async (payload = {}) => {
  const superadminIds = await getSuperadminIds();
  return notifyUsers(superadminIds, payload);
};

const formatScheduleTime = (schedule) => {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: schedule.timeZone || "UTC",
    }).format(schedule.dateTime);
  } catch (_error) {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(schedule.dateTime);
  }
};

export const notifyScheduleCreated = async (schedule) => {
  const scheduleId = schedule._id.toString();
  const scheduledFor = formatScheduleTime(schedule);

  return notifyUsers([getEntityId(schedule.investor), getEntityId(schedule.investee)], {
    type: "schedule_created",
    title: "New schedule created",
    message: `${schedule.title} is scheduled for ${scheduledFor}.`,
    referenceType: "schedule",
    referenceId: schedule._id,
    metadata: {
      scheduleId,
      dateTime: schedule.dateTime,
      timeZone: schedule.timeZone,
      location: schedule.location,
    },
    dedupeKey: `schedule:${scheduleId}:created`,
  });
};

export const notifyScheduleReminder = async (schedule, reminderType) => {
  const scheduleId = schedule._id.toString();
  const isSoon = reminderType === "one_hour";
  const scheduledFor = formatScheduleTime(schedule);

  return notifyUsers([getEntityId(schedule.investor), getEntityId(schedule.investee)], {
    type: isSoon ? "schedule_starting_soon" : "schedule_due",
    title: isSoon ? "Schedule starts in one hour" : "Schedule time reached",
    message: isSoon
      ? `${schedule.title} starts in one hour at ${scheduledFor}.`
      : `${schedule.title} is scheduled for now.`,
    referenceType: "schedule",
    referenceId: schedule._id,
    metadata: {
      scheduleId,
      dateTime: schedule.dateTime,
      timeZone: schedule.timeZone,
      location: schedule.location,
    },
    dedupeKey: `schedule:${scheduleId}:${reminderType}`,
  });
};

export const notifyUserRegistered = async (user) => {
  if (!["investor", "investee"].includes(user.role)) {
    return [];
  }

  return notifySuperadmins({
    type: "user_registered",
    title: `New ${user.role} registered`,
    message: `${user.name} registered as an ${user.role}.`,
    referenceType: "user",
    referenceId: user._id,
    metadata: {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    dedupeKey: `user:${user._id}:registered`,
  });
};

export const notifyPaymentCreated = async ({ invoice, user, subscription } = {}) => {
  const invoiceId = invoice?._id || invoice?.id;

  if (!invoiceId) {
    return [];
  }

  return notifySuperadmins({
    type: "payment_created",
    title: "New payment received",
    message: `${user?.name || "A user"} paid ${invoice.amountPaid ?? invoice.total ?? 0} ${invoice.currency || "usd"}.`,
    referenceType: "payment",
    referenceId: invoiceId,
    metadata: {
      invoiceId,
      userId: user?._id || invoice.user,
      subscriptionId: subscription?._id || invoice.subscription,
      stripeInvoiceId: invoice.stripeInvoiceId || "",
      amountPaid: invoice.amountPaid ?? 0,
      currency: invoice.currency || "usd",
      status: invoice.status || "",
    },
    dedupeKey: `payment:${invoiceId}:created`,
  });
};

export const notifyReportCreated = async (report) => {
  return notifySuperadmins({
    type: "report_created",
    title: "New report created",
    message: `${report.user?.name || "A user"} created a report.`,
    referenceType: "report",
    referenceId: report._id,
    metadata: {
      reportId: report._id,
      listId: report.list?._id || report.list,
      userId: report.user?._id || report.user,
      status: report.status,
    },
    dedupeKey: `report:${report._id}:created`,
  });
};

export const notifyReportAction = async ({ action, reason = "", report } = {}) => {
  const list = report?.list && typeof report.list === "object" ? report.list : null;
  const reporter = getEntityId(report?.user);
  const owner = getEntityId(list?.user);
  const reportId = report?._id;
  const listId = getEntityId(list);
  const pitchTitle = list?.title || "the reported pitch";
  const restored = action === "restore";
  const reasonText = reason ? ` Reason: ${reason}` : "";
  const notifications = [];

  if (reporter) {
    notifications.push(
      ...await notifyUsers([reporter], {
        type: "report_action",
        title: restored ? "Reported pitch restored" : "Your report was reviewed",
        message: restored
          ? `${pitchTitle} was restored after review.${reasonText}`
          : `${pitchTitle} was suspended after your report.${reasonText}`,
        referenceType: "report",
        referenceId: reportId,
        metadata: {
          action,
          listId,
          reportId,
          reason,
        },
      })
    );
  }

  if (owner) {
    notifications.push(
      ...await notifyUsers([owner], {
        type: restored ? "pitch_restored" : "pitch_suspended",
        title: restored ? "Your pitch was restored" : "Your pitch was suspended",
        message: restored
          ? `${pitchTitle} is visible again after review.${reasonText}`
          : `${pitchTitle} was suspended by super admin.${reasonText}`,
        referenceType: "list",
        referenceId: listId,
        metadata: {
          action,
          listId,
          reportId,
          reason,
        },
      })
    );
  }

  return notifications;
};

export const getNotifications = async (authUser, query = {}) => {
  if (!authUser?.userId) {
    throw new AppError("Unauthorized", 401);
  }

  const recipient = isValidObjectId(authUser.userId)
    ? new mongoose.Types.ObjectId(authUser.userId)
    : authUser.userId;
  const baseFilter = { recipient };
  const status = query.unread === "true"
    ? "unread"
    : query.read === "true"
      ? "read"
      : "";

  if (query.type) {
    baseFilter.type = query.type;
  }

  const limit = normalizeLimit(query.limit);
  const page = Math.max(Number(query.page) || 1, 1);
  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount, readCount, totalCount] = await Promise.all([
    getGroupedNotifications(baseFilter, status, skip, limit),
    countGroupedNotifications(baseFilter, status),
    countGroupedNotifications(baseFilter, "unread"),
    countGroupedNotifications(baseFilter, "read"),
    countGroupedNotifications(baseFilter, ""),
  ]);

  return {
    data: notifications.map(serializeNotification),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    unreadCount,
    readCount,
    totalCount,
  };
};

export const getUnreadCount = async (authUser) => {
  if (!authUser?.userId) {
    throw new AppError("Unauthorized", 401);
  }

  const recipient = isValidObjectId(authUser.userId)
    ? new mongoose.Types.ObjectId(authUser.userId)
    : authUser.userId;
  const unreadCount = await countGroupedNotifications({ recipient }, "unread");

  return { unreadCount };
};

export const markNotificationAsRead = async (authUser, notificationId) => {
  if (!authUser?.userId) {
    throw new AppError("Unauthorized", 401);
  }

  if (!isValidObjectId(notificationId)) {
    throw new AppError("Invalid notificationId", 400);
  }

  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: authUser.userId,
  });

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  if (!notification.readAt) {
    const readAt = new Date();

    if (notification.dedupeKey) {
      await Notification.updateMany(
        { recipient: authUser.userId, dedupeKey: notification.dedupeKey, readAt: null },
        { $set: { readAt } }
      );
    } else {
      notification.readAt = readAt;
      await notification.save();
    }

    notification.readAt = readAt;
  }

  return serializeNotification(notification);
};

export const markAllNotificationsAsRead = async (authUser) => {
  if (!authUser?.userId) {
    throw new AppError("Unauthorized", 401);
  }

  const result = await Notification.updateMany(
    { recipient: authUser.userId, readAt: null },
    { $set: { readAt: new Date() } }
  );

  return {
    modifiedCount: result.modifiedCount || 0,
  };
};

export const verifyNotificationSocketIdentity = async ({ token }) => {
  if (!token) {
    throw new AppError("Authorization token is missing", 401);
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch (_error) {
    throw new AppError("Invalid or expired access token", 401);
  }

  const user = await User.findById(decoded.userId).select(userProjection);

  if (!user) {
    throw new AppError("User not found", 401);
  }

  return {
    authUser: {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

export const processScheduleReminderNotifications = async (now = new Date()) => {
  const oneHourWindowEnd = new Date(now.getTime() + 60 * 60 * 1000);
  const dueWindowStart = new Date(now.getTime() - dueReminderLookbackMs);

  const [startingSoonSchedules, dueSchedules] = await Promise.all([
    Schedule.find({
      dateTime: {
        $gt: now,
        $lte: oneHourWindowEnd,
      },
    }),
    Schedule.find({
      dateTime: {
        $gte: dueWindowStart,
        $lte: now,
      },
    }),
  ]);

  await Promise.all([
    ...startingSoonSchedules.map((schedule) => notifyScheduleReminder(schedule, "one_hour")),
    ...dueSchedules.map((schedule) => notifyScheduleReminder(schedule, "due")),
  ]);
};

export const startScheduleNotificationWorker = () => {
  if (reminderInterval) {
    return reminderInterval;
  }

  const run = async () => {
    if (reminderRunInFlight) {
      return;
    }

    reminderRunInFlight = true;

    try {
      await processScheduleReminderNotifications();
    } catch (error) {
      console.error("Schedule notification worker failed:", error.message);
    } finally {
      reminderRunInFlight = false;
    }
  };

  run();
  reminderInterval = setInterval(run, reminderPollMs);

  return reminderInterval;
};
