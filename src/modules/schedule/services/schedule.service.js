import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import User from "../../auth/models/user.model.js";
import InvestmentConversation from "../../investment-conversations/models/investmentConversation.model.js";
import { notifyScheduleCreated } from "../../notification/services/notification.service.js";
import Schedule from "../models/schedule.model.js";

const allowedRoles = ["investor", "investee", "superadmin"];
const userProjection = "name email role profileImage mobile";
const conversationProjection = "list investor investee status";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeText = (value) => String(value || "").trim();

const validateObjectId = (value, fieldName) => {
  if (!isValidObjectId(value)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }

  return value;
};

const parseDate = (value, fieldName) => {
  const parsedDate = new Date(value);

  if (!value || Number.isNaN(parsedDate.getTime())) {
    throw new AppError(`${fieldName} must be a valid ISO date`, 400);
  }

  return parsedDate;
};

const assertAuthenticatedUser = (authUser) => {
  if (!authUser?.userId) {
    throw new AppError("Unauthorized", 401);
  }
};

const assertAllowedRole = (role) => {
  if (!allowedRoles.includes(role)) {
    throw new AppError("Forbidden: invalid role for this action", 403);
  }
};

const assertSuperadmin = (authUser) => {
  assertAuthenticatedUser(authUser);

  if (authUser.role !== "superadmin") {
    throw new AppError("Forbidden: only superadmin can manage schedules", 403);
  }
};

const buildScheduleQuery = () =>
  Schedule.find()
    .populate("conversation", conversationProjection)
    .populate("investor", userProjection)
    .populate("investee", userProjection)
    .populate("createdBy", userProjection);

const serializeUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    profileImage: user.profileImage || "",
    mobile: user.mobile || "",
  };
};

const serializeSchedule = (schedule) => ({
  _id: schedule._id,
  conversation: schedule.conversation?._id || schedule.conversation || null,
  title: schedule.title,
  dateTime: schedule.dateTime,
  startsAt: schedule.dateTime,
  timeZone: schedule.timeZone,
  location: schedule.location,
  investor: serializeUser(schedule.investor),
  investee: serializeUser(schedule.investee),
  createdBy: serializeUser(schedule.createdBy),
  createdAt: schedule.createdAt,
  updatedAt: schedule.updatedAt,
});

const getUserByRoleOrThrow = async (userId, role, fieldName) => {
  validateObjectId(userId, fieldName);

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(`${fieldName} not found`, 404);
  }

  if (user.role !== role) {
    throw new AppError(`${fieldName} must be a ${role}`, 400);
  }

  return user;
};

const getConversationOrThrow = async (conversationId) => {
  validateObjectId(conversationId, "conversationId");

  const conversation = await InvestmentConversation.findById(conversationId);

  if (!conversation) {
    throw new AppError("Investment conversation not found", 404);
  }

  return conversation;
};

const getScheduleOrThrow = async (scheduleId) => {
  validateObjectId(scheduleId, "scheduleId");

  const schedule = await buildScheduleQuery().findOne({ _id: scheduleId });

  if (!schedule) {
    throw new AppError("Schedule not found", 404);
  }

  return schedule;
};

const validateSchedulePayload = async (payload = {}, options = {}) => {
  const title = normalizeText(payload.title);
  const location = normalizeText(payload.location);
  const timeZone = normalizeText(payload.timeZone || "UTC");
  const rawDateTime = payload.dateTime || payload.startsAt;
  const dateTime = rawDateTime ? parseDate(rawDateTime, "dateTime") : null;
  let conversation = null;
  let investorId = payload.investorId || payload.investor;
  let investeeId = payload.investeeId || payload.investee;

  if (!title) {
    throw new AppError("title is required", 400);
  }

  if (!dateTime) {
    throw new AppError("dateTime is required", 400);
  }

  if (!timeZone) {
    throw new AppError("timeZone is required", 400);
  }

  if (!location) {
    throw new AppError("location is required", 400);
  }

  if (payload.conversationId || payload.conversation) {
    conversation = await getConversationOrThrow(payload.conversationId || payload.conversation);
    investorId = investorId || conversation.investor;
    investeeId = investeeId || conversation.investee;
  }

  if (!investorId) {
    throw new AppError("investorId is required", 400);
  }

  if (!investeeId) {
    throw new AppError("investeeId is required", 400);
  }

  const investor = await getUserByRoleOrThrow(investorId, "investor", "investorId");
  const investee = await getUserByRoleOrThrow(investeeId, "investee", "investeeId");

  if (conversation) {
    const conversationInvestorId = String(conversation.investor);
    const conversationInvesteeId = String(conversation.investee);

    if (
      conversationInvestorId !== String(investor._id) ||
      conversationInvesteeId !== String(investee._id)
    ) {
      throw new AppError("Schedule participants must match the conversation participants", 400);
    }
  }

  if (options.existingSchedule) {
    const existingConversation = options.existingSchedule.conversation;

    if (!conversation && existingConversation) {
      conversation = await getConversationOrThrow(existingConversation._id || existingConversation);
    }
  }

  return {
    title,
    dateTime,
    timeZone,
    location,
    investor,
    investee,
    conversation,
  };
};

const buildScheduleFilters = (authUser, query = {}) => {
  const filters = {};

  if (authUser.role === "investor") {
    filters.investor = authUser.userId;
  } else if (authUser.role === "investee") {
    filters.investee = authUser.userId;
  }

  if (query.conversationId) {
    filters.conversation = validateObjectId(query.conversationId, "conversationId");
  }

  if (query.investorId) {
    filters.investor = validateObjectId(query.investorId, "investorId");
  }

  if (query.investeeId) {
    filters.investee = validateObjectId(query.investeeId, "investeeId");
  }

  if (authUser.role === "investor") {
    filters.investor = authUser.userId;
  }

  if (authUser.role === "investee") {
    filters.investee = authUser.userId;
  }

  if (query.from || query.to) {
    filters.dateTime = {};

    if (query.from) {
      filters.dateTime.$gte = parseDate(query.from, "from");
    }

    if (query.to) {
      filters.dateTime.$lte = parseDate(query.to, "to");
    }
  }

  return filters;
};

const assertScheduleAccess = (authUser, schedule) => {
  assertAuthenticatedUser(authUser);
  assertAllowedRole(authUser.role);

  if (authUser.role === "superadmin") {
    return;
  }

  const userId = String(authUser.userId);
  const isInvestor = String(schedule.investor?._id || schedule.investor) === userId;
  const isInvestee = String(schedule.investee?._id || schedule.investee) === userId;

  if (!isInvestor && !isInvestee) {
    throw new AppError("Forbidden: you cannot access this schedule", 403);
  }
};

export const createSchedule = async (authUser, payload = {}) => {
  assertSuperadmin(authUser);

  const schedulePayload = await validateSchedulePayload(payload);
  const createdSchedule = await Schedule.create({
    title: schedulePayload.title,
    dateTime: schedulePayload.dateTime,
    timeZone: schedulePayload.timeZone,
    location: schedulePayload.location,
    investor: schedulePayload.investor._id,
    investee: schedulePayload.investee._id,
    conversation: schedulePayload.conversation?._id || null,
    createdBy: authUser.userId,
  });

  const schedule = await getScheduleOrThrow(createdSchedule._id);
  await notifyScheduleCreated(schedule);

  return serializeSchedule(schedule);
};

export const getSchedules = async (authUser, query = {}) => {
  assertAuthenticatedUser(authUser);
  assertAllowedRole(authUser.role);

  const schedules = await buildScheduleQuery()
    .find(buildScheduleFilters(authUser, query))
    .sort({ dateTime: 1, createdAt: -1 });

  return schedules.map(serializeSchedule);
};

export const getScheduleById = async (authUser, scheduleId) => {
  const schedule = await getScheduleOrThrow(scheduleId);
  assertScheduleAccess(authUser, schedule);

  return serializeSchedule(schedule);
};

export const updateSchedule = async (authUser, scheduleId, payload = {}) => {
  assertSuperadmin(authUser);

  const schedule = await getScheduleOrThrow(scheduleId);
  const mergedPayload = {
    title: payload.title ?? schedule.title,
    dateTime: payload.dateTime ?? payload.startsAt ?? schedule.dateTime,
    timeZone: payload.timeZone ?? schedule.timeZone,
    location: payload.location ?? schedule.location,
    investorId: payload.investorId ?? payload.investor ?? schedule.investor?._id ?? schedule.investor,
    investeeId: payload.investeeId ?? payload.investee ?? schedule.investee?._id ?? schedule.investee,
    conversationId:
      payload.conversationId ??
      payload.conversation ??
      schedule.conversation?._id ??
      schedule.conversation,
  };
  const schedulePayload = await validateSchedulePayload(mergedPayload, {
    existingSchedule: schedule,
  });

  schedule.title = schedulePayload.title;
  schedule.dateTime = schedulePayload.dateTime;
  schedule.timeZone = schedulePayload.timeZone;
  schedule.location = schedulePayload.location;
  schedule.investor = schedulePayload.investor._id;
  schedule.investee = schedulePayload.investee._id;
  schedule.conversation = schedulePayload.conversation?._id || null;
  await schedule.save();

  return serializeSchedule(await getScheduleOrThrow(schedule._id));
};

export const deleteSchedule = async (authUser, scheduleId) => {
  assertSuperadmin(authUser);

  const schedule = await getScheduleOrThrow(scheduleId);
  await Schedule.findByIdAndDelete(schedule._id);

  return {
    id: schedule._id,
    message: "Schedule deleted successfully",
  };
};
