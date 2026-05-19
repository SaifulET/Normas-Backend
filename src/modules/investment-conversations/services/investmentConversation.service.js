import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import AppError from "../../../utils/appError.js";
import User from "../../auth/models/user.model.js";
import List from "../../list/models/list.model.js";
import InvestmentConversation, {
  investmentConversationStatuses,
} from "../models/investmentConversation.model.js";
import MeetingRequest, { meetingRequestStatuses } from "../models/meetingRequest.model.js";

const allowedConversationRoles = ["investor", "investee", "superadmin"];
const allowedMeetingDecisionStatuses = ["accepted", "rejected", "cancelled"];
const listProjection =
  "title country stage sector fundingTarget bannerImage status viewCount user createdAt updatedAt";
const userProjection = "name email role profileImage";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const buildConversationRoom = (conversationId) => `investment:${conversationId}`;

const normalizeText = (value) => String(value || "").trim();

const normalizeOptionalText = (value) => {
  if (typeof value === "undefined" || value === null) {
    return "";
  }

  return normalizeText(value);
};

const validateObjectId = (value, fieldName) => {
  if (!isValidObjectId(value)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }

  return value;
};

const validateMessage = (message) => {
  const normalizedMessage = normalizeText(message);

  if (!normalizedMessage) {
    throw new AppError("message is required", 400);
  }

  if (normalizedMessage.length > 2000) {
    throw new AppError("message must not exceed 2000 characters", 400);
  }

  return normalizedMessage;
};

const validateMeetingStatus = (status, allowedStatuses = meetingRequestStatuses) => {
  if (!allowedStatuses.includes(status)) {
    throw new AppError(`status must be ${allowedStatuses.join(", ")}`, 400);
  }

  return status;
};

const parseDate = (value, fieldName) => {
  const parsedDate = new Date(value);

  if (!value || Number.isNaN(parsedDate.getTime())) {
    throw new AppError(`${fieldName} must be a valid ISO date`, 400);
  }

  return parsedDate;
};

const validateMeetingPayload = (payload = {}) => {
  const title = normalizeText(payload.title);
  const location = normalizeText(payload.location);
  const note = normalizeOptionalText(payload.note);
  const locationDetails = normalizeOptionalText(payload.locationDetails);
  const timeZone = normalizeText(payload.timeZone || "UTC");
  const startsAt = parseDate(payload.startsAt, "startsAt");
  const endsAt = parseDate(payload.endsAt, "endsAt");

  if (!title) {
    throw new AppError("title is required", 400);
  }

  if (!location) {
    throw new AppError("location is required", 400);
  }

  if (startsAt.getTime() >= endsAt.getTime()) {
    throw new AppError("endsAt must be later than startsAt", 400);
  }

  return {
    title,
    note,
    location,
    locationDetails,
    timeZone,
    startsAt,
    endsAt,
  };
};

const buildBaseConversationQuery = () =>
  InvestmentConversation.find()
    .populate("list", listProjection)
    .populate("investor", userProjection)
    .populate("investee", userProjection)
    .populate("createdBy", userProjection)
    .populate("messages.senderUser", userProjection);

const getSuperadmins = async () => User.find({ role: "superadmin" }).select(userProjection).sort({ name: 1 });

const getUserOrThrow = async (userId) => {
  validateObjectId(userId, "userId");

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

const getListOrThrow = async (listId) => {
  validateObjectId(listId, "listId");

  const list = await List.findById(listId).populate("user", userProjection);

  if (!list) {
    throw new AppError("List not found", 404);
  }

  return list;
};

const getConversationOrThrow = async (conversationId) => {
  validateObjectId(conversationId, "conversationId");

  const conversation = await buildBaseConversationQuery().findOne({ _id: conversationId });

  if (!conversation) {
    throw new AppError("Investment conversation not found", 404);
  }

  return conversation;
};

const getMeetingRequestOrThrow = async (meetingRequestId) => {
  validateObjectId(meetingRequestId, "meetingRequestId");

  const meetingRequest = await MeetingRequest.findById(meetingRequestId)
    .populate("conversation")
    .populate("list", listProjection)
    .populate("investor", userProjection)
    .populate("investee", userProjection)
    .populate("requestedBy", userProjection)
    .populate("respondedBy", userProjection);

  if (!meetingRequest) {
    throw new AppError("Meeting request not found", 404);
  }

  return meetingRequest;
};

const assertAuthenticatedUser = (authUser) => {
  if (!authUser?.userId) {
    throw new AppError("Unauthorized", 401);
  }
};

const assertAllowedRole = (role) => {
  if (!allowedConversationRoles.includes(role)) {
    throw new AppError("Forbidden: invalid role for this action", 403);
  }
};

const hasSeenMessage = (message, userId) =>
  message.seenBy.some((entry) => String(entry.user) === String(userId));

const countUnreadMessages = (messages = [], userId) =>
  messages.reduce((count, message) => {
    if (!message.senderUser || String(message.senderUser._id || message.senderUser) === String(userId)) {
      return count;
    }

    return hasSeenMessage(message, userId) ? count : count + 1;
  }, 0);

const getMessageSenderId = (message) => String(message.senderUser?._id || message.senderUser);

const sortMessagesBySentAt = (messages = []) =>
  [...messages].sort(
    (firstMessage, secondMessage) => new Date(firstMessage.sentAt) - new Date(secondMessage.sentAt)
  );

const getLastIncomingMessage = (messages = [], currentUserId) => {
  const incomingMessages = sortMessagesBySentAt(messages).filter(
    (message) => getMessageSenderId(message) !== String(currentUserId)
  );

  return incomingMessages[incomingMessages.length - 1] || null;
};

const getConversationOtherUser = (conversation, currentUserId) => {
  const viewerId = String(currentUserId);

  if (String(conversation.investor?._id || conversation.investor) === viewerId) {
    return conversation.investee;
  }

  if (String(conversation.investee?._id || conversation.investee) === viewerId) {
    return conversation.investor;
  }

  return conversation.investor;
};

const getRelativeTimeLabel = (date) => {
  if (!date) {
    return "";
  }

  const diffInSeconds = Math.max(Math.floor((Date.now() - new Date(date).getTime()) / 1000), 0);

  if (diffInSeconds < 60) {
    return "now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);

  if (diffInMinutes < 60) {
    return `${diffInMinutes}m`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);

  if (diffInHours < 24) {
    return `${diffInHours}h`;
  }

  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays < 7) {
    return `${diffInDays}d`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);

  if (diffInWeeks < 5) {
    return `${diffInWeeks}w`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);

  if (diffInMonths < 12) {
    return `${diffInMonths}mo`;
  }

  return `${Math.floor(diffInDays / 365)}y`;
};

const validateConversationStatus = (status) => {
  if (!investmentConversationStatuses.includes(status)) {
    throw new AppError(`status must be ${investmentConversationStatuses.join(", ")}`, 400);
  }

  return status;
};

const parsePositiveInteger = (value, defaultValue, fieldName, maxValue = 100) => {
  const parsedValue = Number(value || defaultValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new AppError(`${fieldName} must be a positive integer`, 400);
  }

  return Math.min(parsedValue, maxValue);
};

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
  };
};

const serializeList = (list) => {
  if (!list) {
    return null;
  }

  return {
    _id: list._id,
    title: list.title,
    country: list.country,
    stage: list.stage,
    sector: list.sector,
    fundingTarget: list.fundingTarget,
    bannerImage: list.bannerImage,
    status: list.status,
    viewCount: list.viewCount,
    user: list.user ? serializeUser(list.user) : null,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  };
};

const serializeMessage = (message) => ({
  _id: message._id,
  senderUser: serializeUser(message.senderUser),
  senderRole: message.senderRole,
  message: message.message,
  sentAt: message.sentAt,
  seenBy: message.seenBy.map((entry) => ({
    user: typeof entry.user === "object" && entry.user !== null
      ? {
          _id: entry.user._id,
          name: entry.user.name,
          email: entry.user.email,
          role: entry.user.role,
        }
      : entry.user,
    seenAt: entry.seenAt,
  })),
});

const serializeMessageForViewer = (message, currentUserId) => ({
  ...serializeMessage(message),
  direction: getMessageSenderId(message) === String(currentUserId) ? "outgoing" : "incoming",
  isSeen: hasSeenMessage(message, currentUserId),
});

const serializeConversation = (conversation, options = {}) => {
  const currentUserId = options.currentUserId ? String(options.currentUserId) : null;
  const messages = sortMessagesBySentAt(conversation.messages);
  const lastMessage = messages[messages.length - 1] || null;

  return {
    _id: conversation._id,
    conversationStatus: conversation.status || "pending",
    status: conversation.status || "pending",
    list: serializeList(conversation.list),
    investor: serializeUser(conversation.investor),
    investee: serializeUser(conversation.investee),
    otherUserInfo: currentUserId ? serializeUser(getConversationOtherUser(conversation, currentUserId)) : null,
    superadmins: (options.superadmins || []).map(serializeUser),
    createdBy: serializeUser(conversation.createdBy),
    messages: currentUserId
      ? messages.map((message) => serializeMessageForViewer(message, currentUserId))
      : messages.map(serializeMessage),
    messageCount: messages.length,
    unreadCount: currentUserId ? countUnreadMessages(messages, currentUserId) : 0,
    lastMessage: lastMessage
      ? currentUserId
        ? serializeMessageForViewer(lastMessage, currentUserId)
        : serializeMessage(lastMessage)
      : null,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

const serializeConversationInboxItem = (conversation, currentUserId) => {
  const viewerId = String(currentUserId);
  const messages = sortMessagesBySentAt(conversation.messages);
  const lastMessage = messages[messages.length - 1] || null;
  const lastIncomingMessage = getLastIncomingMessage(messages, viewerId);
  const otherUserInfo = getConversationOtherUser(conversation, viewerId);
  const lastActivityAt = conversation.lastMessageAt || lastMessage?.sentAt || conversation.updatedAt;
  const unseenMessageCount = countUnreadMessages(messages, currentUserId);
  const latestIncomingAt = lastIncomingMessage?.sentAt || null;

  return {
    conversationId: conversation._id,
    otherUserInfo: serializeUser(otherUserInfo),
    oppositeUser: serializeUser(otherUserInfo),
    listInfo: serializeList(conversation.list),
    list: serializeList(conversation.list),
    lastMessage: lastMessage ? serializeMessageForViewer(lastMessage, currentUserId) : null,
    lastMessagePreview: lastMessage?.message || "",
    lastIncomingMessage: lastIncomingMessage
      ? serializeMessageForViewer(lastIncomingMessage, currentUserId)
      : null,
    lastIncomingMessagePreview: lastIncomingMessage?.message || "",
    unseenMessageCount,
    unreadCount: unseenMessageCount,
    conversationStatus: conversation.status || "pending",
    lastMessageAt: lastActivityAt,
    lastMessageTime: lastActivityAt,
    lastMessageTimeAgo: getRelativeTimeLabel(lastActivityAt),
    timeAgo: getRelativeTimeLabel(latestIncomingAt || lastActivityAt),
    lastIncomingMessageAt: latestIncomingAt,
    lastIncomingMessageTimeAgo: getRelativeTimeLabel(latestIncomingAt),
  };
};

const serializeMeetingRequest = (meetingRequest) => ({
  _id: meetingRequest._id,
  conversation: meetingRequest.conversation?._id || meetingRequest.conversation,
  list: serializeList(meetingRequest.list),
  investor: serializeUser(meetingRequest.investor),
  investee: serializeUser(meetingRequest.investee),
  requestedBy: serializeUser(meetingRequest.requestedBy),
  requestedByRole: meetingRequest.requestedByRole,
  title: meetingRequest.title,
  note: meetingRequest.note,
  location: meetingRequest.location,
  locationDetails: meetingRequest.locationDetails,
  timeZone: meetingRequest.timeZone,
  startsAt: meetingRequest.startsAt,
  endsAt: meetingRequest.endsAt,
  status: meetingRequest.status,
  respondedBy: serializeUser(meetingRequest.respondedBy),
  respondedAt: meetingRequest.respondedAt,
  responseNote: meetingRequest.responseNote,
  createdAt: meetingRequest.createdAt,
  updatedAt: meetingRequest.updatedAt,
});

const assertConversationAccess = (authUser, conversation) => {
  assertAuthenticatedUser(authUser);

  if (authUser.role === "superadmin") {
    return;
  }

  const userId = String(authUser.userId);
  const isInvestor = String(conversation.investor._id) === userId;
  const isInvestee = String(conversation.investee._id) === userId;

  if (!isInvestor && !isInvestee) {
    throw new AppError("Forbidden: you cannot access this conversation", 403);
  }
};

const assertMeetingRequestAccess = (authUser, meetingRequest) => {
  assertAuthenticatedUser(authUser);

  if (authUser.role === "superadmin") {
    return;
  }

  const userId = String(authUser.userId);
  const isInvestor = String(meetingRequest.investor._id || meetingRequest.investor) === userId;
  const isInvestee = String(meetingRequest.investee._id || meetingRequest.investee) === userId;

  if (!isInvestor && !isInvestee) {
    throw new AppError("Forbidden: you cannot access this meeting request", 403);
  }
};

const markMessagesSeen = async (conversation, viewerId, options = {}) => {
  const seenMessageIds = [];

  conversation.messages.forEach((message) => {
    if (!message.senderUser || String(message.senderUser._id || message.senderUser) === String(viewerId)) {
      return;
    }

    if (!hasSeenMessage(message, viewerId)) {
      message.seenBy.push({
        user: viewerId,
        seenAt: new Date(),
      });
      seenMessageIds.push(message._id.toString());
    }
  });

  const previousStatus = conversation.status || "pending";
  const shouldActivate = options.activatePending && previousStatus === "pending";

  if (shouldActivate) {
    conversation.status = "active";
  }

  if (seenMessageIds.length === 0 && !shouldActivate) {
    return {
      conversation,
      seenMessageIds,
      previousStatus,
    };
  }

  await conversation.save();

  return {
    conversation: await getConversationOrThrow(conversation._id),
    seenMessageIds,
    previousStatus,
  };
};

const buildConversationFilters = (authUser) => {
  if (authUser.role === "superadmin") {
    return {};
  }

  if (authUser.role === "investor") {
    return { investor: authUser.userId };
  }

  return { investee: authUser.userId };
};

const buildConversationListFilters = (authUser, query = {}) => {
  const filters = buildConversationFilters(authUser);

  if (query.status) {
    const status = validateConversationStatus(query.status);

    if (status === "pending") {
      filters.$or = [
        { status },
        { status: { $exists: false } },
        { status: null },
      ];
    } else {
      filters.status = status;
    }
  }

  return filters;
};

const getPaginatedMessages = (messages = [], query = {}, currentUserId) => {
  const page = parsePositiveInteger(query.page, 1, "page", 10000);
  const limitPairs = parsePositiveInteger(query.limitPairs, 5, "limitPairs", 50);
  const limitMessages = limitPairs * 2;
  const sortedMessages = sortMessagesBySentAt(messages);
  const totalMessages = sortedMessages.length;
  const endIndex = Math.max(totalMessages - (page - 1) * limitMessages, 0);
  const startIndex = Math.max(endIndex - limitMessages, 0);
  const selectedMessages = sortedMessages.slice(startIndex, endIndex);

  return {
    messages: selectedMessages.map((message) => serializeMessageForViewer(message, currentUserId)),
    pagination: {
      page,
      limitPairs,
      limitMessages,
      totalMessages,
      loadedMessages: selectedMessages.length,
      hasMore: startIndex > 0,
      nextPage: startIndex > 0 ? page + 1 : null,
    },
  };
};

const buildMeetingFilters = (authUser, query = {}, defaultStatus) => {
  const filters = {};

  if (authUser.role !== "superadmin") {
    filters.$or = [{ investor: authUser.userId }, { investee: authUser.userId }];
  }

  if (query.conversationId) {
    filters.conversation = validateObjectId(query.conversationId, "conversationId");
  }

  if (query.listId) {
    filters.list = validateObjectId(query.listId, "listId");
  }

  const selectedStatus = query.status || defaultStatus;

  if (selectedStatus) {
    filters.status = validateMeetingStatus(selectedStatus);
  }

  if (query.from || query.to) {
    filters.startsAt = {};

    if (query.from) {
      filters.startsAt.$gte = parseDate(query.from, "from");
    }

    if (query.to) {
      filters.startsAt.$lte = parseDate(query.to, "to");
    }
  }

  return filters;
};

export const createOrGetConversation = async (authUser, payload = {}) => {
  assertAuthenticatedUser(authUser);
  assertAllowedRole(authUser.role);

  const list = await getListOrThrow(payload.listId);
  const listOwnerId = list.user?._id || list.user;

  if (!listOwnerId) {
    throw new AppError("List owner not found", 404);
  }

  const investorId =
    authUser.role === "investor"
      ? authUser.userId
      : validateObjectId(payload.investorId, "investorId");
  const investor = await getUserOrThrow(investorId);
  const investeeId =
    authUser.role === "investor"
      ? listOwnerId
      : authUser.role === "investee"
        ? authUser.userId
        : payload.investeeId
          ? validateObjectId(payload.investeeId, "investeeId")
          : listOwnerId;

  if (authUser.role === "investor" && String(investor._id) === String(investeeId)) {
    throw new AppError("You cannot start a conversation with yourself", 400);
  }

  if (authUser.role === "investor" && normalizeText(payload.initialMessage) === "") {
    throw new AppError("initialMessage is required", 400);
  }

  const investee = await getUserOrThrow(investeeId);
  const canSetInitialMessage =
    String(authUser.userId) === String(investor._id) ||
    String(authUser.userId) === String(investee._id) ||
    authUser.role === "superadmin";
  const initialMessage = canSetInitialMessage ? normalizeOptionalText(payload.initialMessage) : "";

  let conversation = await buildBaseConversationQuery().findOne({
    list: list._id,
    investor: investor._id,
    investee: investee._id,
  });
  let created = false;

  if (!conversation) {
    const sentAt = new Date();
    const messages = initialMessage
      ? [
          {
            senderUser: authUser.userId,
            senderRole: authUser.role,
            message: validateMessage(initialMessage),
            sentAt,
            seenBy: [
              {
                user: authUser.userId,
                seenAt: sentAt,
              },
            ],
          },
        ]
      : [];

    const createdConversation = await InvestmentConversation.create({
      list: list._id,
      investor: investor._id,
      investee: investee._id,
      createdBy: authUser.userId,
      messages,
      lastMessageAt: messages.length > 0 ? sentAt : null,
      status: "pending",
    });

    conversation = await getConversationOrThrow(createdConversation._id);
    created = true;
  } else if (initialMessage && conversation.messages.length === 0) {
    const sentAt = new Date();

    conversation.messages.push({
      senderUser: authUser.userId,
      senderRole: authUser.role,
      message: validateMessage(initialMessage),
      sentAt,
      seenBy: [
        {
          user: authUser.userId,
          seenAt: sentAt,
        },
      ],
    });
    conversation.lastMessageAt = sentAt;
    await conversation.save();
    conversation = await getConversationOrThrow(conversation._id);
  }

  const superadmins = await getSuperadmins();

  return {
    created,
    conversation: serializeConversation(conversation, {
      currentUserId: authUser.userId,
      superadmins,
    }),
  };
};

export const getMyConversations = async (authUser, query = {}) => {
  assertAuthenticatedUser(authUser);
  assertAllowedRole(authUser.role);

  const conversations = await buildBaseConversationQuery()
    .find(buildConversationListFilters(authUser, query))
    .sort({ lastMessageAt: -1, updatedAt: -1 });
  const superadmins = await getSuperadmins();

  return conversations.map((conversation) =>
    serializeConversation(conversation, {
      currentUserId: authUser.userId,
      superadmins,
    })
  );
};

export const getMyConversationInbox = async (authUser, query = {}) => {
  assertAuthenticatedUser(authUser);
  assertAllowedRole(authUser.role);

  const conversations = await buildBaseConversationQuery()
    .find({
      ...buildConversationListFilters(authUser, query),
      "messages.0": {
        $exists: true,
      },
    })
    .sort({ lastMessageAt: -1, updatedAt: -1 });

  return conversations.map((conversation) =>
    serializeConversationInboxItem(conversation, authUser.userId)
  );
};

export const getConversationRequests = async (authUser) => {
  return getMyConversationInbox(authUser, { status: "pending" });
};

export const getConversationById = async (authUser, conversationId) => {
  const conversation = await getConversationOrThrow(conversationId);
  assertConversationAccess(authUser, conversation);

  const seenResult = await markMessagesSeen(conversation, authUser.userId, {
    activatePending: true,
  });
  const superadmins = await getSuperadmins();

  return {
    ...serializeConversation(seenResult.conversation, {
      currentUserId: authUser.userId,
      superadmins,
    }),
    seenMessageIds: seenResult.seenMessageIds,
    previousConversationStatus: seenResult.previousStatus,
  };
};

export const markConversationAsSeen = async (authUser, conversationId) => {
  const conversation = await getConversationOrThrow(conversationId);
  assertConversationAccess(authUser, conversation);

  const seenResult = await markMessagesSeen(conversation, authUser.userId);
  const superadmins = await getSuperadmins();

  return {
    ...serializeConversation(seenResult.conversation, {
      currentUserId: authUser.userId,
      superadmins,
    }),
    seenMessageIds: seenResult.seenMessageIds,
  };
};

export const getConversationMessages = async (authUser, conversationId, query = {}) => {
  const conversation = await getConversationOrThrow(conversationId);
  assertConversationAccess(authUser, conversation);

  return {
    conversationId: conversation._id,
    conversationStatus: conversation.status || "pending",
    ...getPaginatedMessages(conversation.messages, query, authUser.userId),
  };
};

export const createConversationMessage = async (authUser, conversationId, payload = {}) => {
  const conversation = await getConversationOrThrow(conversationId);
  assertConversationAccess(authUser, conversation);

  const message = validateMessage(payload.message);
  const sentAt = new Date();

  conversation.messages.push({
    senderUser: authUser.userId,
    senderRole: authUser.role,
    message,
    sentAt,
    seenBy: [
      {
        user: authUser.userId,
        seenAt: sentAt,
      },
    ],
  });
  conversation.lastMessageAt = sentAt;
  conversation.status = "active";

  await conversation.save();

  const savedConversation = await getConversationOrThrow(conversation._id);
  const savedMessage = savedConversation.messages[savedConversation.messages.length - 1];
  const superadmins = await getSuperadmins();
  const receiverUser = getConversationOtherUser(savedConversation, authUser.userId);
  const receiverUnseenMessageCount = receiverUser
    ? countUnreadMessages(savedConversation.messages, receiverUser._id)
    : 0;

  return {
    room: buildConversationRoom(conversationId),
    messageId: savedMessage._id,
    conversation: serializeConversation(savedConversation, {
      currentUserId: authUser.userId,
      superadmins,
    }),
    message: serializeMessageForViewer(savedMessage, authUser.userId),
    senderUser: serializeUser(savedMessage.senderUser),
    receiverUser: serializeUser(receiverUser),
    receiverUnseenMessageCount,
  };
};

export const createMeetingRequest = async (authUser, conversationId, payload = {}) => {
  const conversation = await getConversationOrThrow(conversationId);
  assertConversationAccess(authUser, conversation);

  const meetingPayload = validateMeetingPayload(payload);
  const isSuperadmin = authUser.role === "superadmin";

  const createdMeetingRequest = await MeetingRequest.create({
    conversation: conversation._id,
    list: conversation.list._id,
    investor: conversation.investor._id,
    investee: conversation.investee._id,
    requestedBy: authUser.userId,
    requestedByRole: authUser.role,
    ...meetingPayload,
    status: isSuperadmin ? "accepted" : "pending",
    respondedBy: isSuperadmin ? authUser.userId : null,
    respondedAt: isSuperadmin ? new Date() : null,
    responseNote: isSuperadmin ? normalizeOptionalText(payload.responseNote || "Created by superadmin") : "",
  });

  const meetingRequest = await getMeetingRequestOrThrow(createdMeetingRequest._id);

  return serializeMeetingRequest(meetingRequest);
};

export const buildSocketRoomName = buildConversationRoom;

export const buildMessageEventPayloadForViewer = async (authUser, conversationId, messageId) => {
  const conversation = await getConversationOrThrow(conversationId);
  assertConversationAccess(authUser, conversation);

  const message = conversation.messages.id(messageId);

  if (!message) {
    throw new AppError("Conversation message not found", 404);
  }

  const superadmins = await getSuperadmins();
  const senderId = getMessageSenderId(message);
  const receiverUser = getConversationOtherUser(conversation, senderId);
  const receiverUnseenMessageCount = receiverUser
    ? countUnreadMessages(conversation.messages, receiverUser._id)
    : 0;

  return {
    conversationId: conversation._id,
    message: serializeMessageForViewer(message, authUser.userId),
    conversation: serializeConversation(conversation, {
      currentUserId: authUser.userId,
      superadmins,
    }),
    senderUser: serializeUser(message.senderUser),
    receiverUser: serializeUser(receiverUser),
    receiverUnseenMessageCount,
  };
};

export const buildSeenEventPayloadForViewer = async (authUser, conversationId, seenMessageIds) => {
  const conversation = await getConversationOrThrow(conversationId);
  assertConversationAccess(authUser, conversation);

  const superadmins = await getSuperadmins();
  const serializedConversation = serializeConversation(conversation, {
    currentUserId: authUser.userId,
    superadmins,
  });

  return {
    conversationId: conversation._id,
    seenMessageIds,
    conversation: {
      ...serializedConversation,
      seenMessageIds,
    },
  };
};

export const verifySocketIdentity = async ({ token, conversationId }) => {
  if (!conversationId) {
    throw new AppError("conversationId is required", 400);
  }

  const conversation = await getConversationOrThrow(conversationId);

  if (!token) {
    throw new AppError("Socket authentication is required", 401);
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch (_error) {
    throw new AppError("Invalid or expired socket token", 401);
  }

  const user = await User.findById(decoded.userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const authUser = {
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };

  assertAllowedRole(authUser.role);
  assertConversationAccess(authUser, conversation);

  return {
    conversation,
    authUser,
  };
};

export const getConversationMeetingRequests = async (authUser, conversationId, query = {}) => {
  const conversation = await getConversationOrThrow(conversationId);
  assertConversationAccess(authUser, conversation);

  const filters = buildMeetingFilters(authUser, { ...query, conversationId });
  const meetingRequests = await MeetingRequest.find(filters)
    .populate("conversation")
    .populate("list", listProjection)
    .populate("investor", userProjection)
    .populate("investee", userProjection)
    .populate("requestedBy", userProjection)
    .populate("respondedBy", userProjection)
    .sort({ startsAt: 1, createdAt: -1 });

  return meetingRequests.map(serializeMeetingRequest);
};

export const getMeetingRequests = async (authUser, query = {}) => {
  assertAuthenticatedUser(authUser);
  assertAllowedRole(authUser.role);

  const filters = buildMeetingFilters(authUser, query);
  const meetingRequests = await MeetingRequest.find(filters)
    .populate("conversation")
    .populate("list", listProjection)
    .populate("investor", userProjection)
    .populate("investee", userProjection)
    .populate("requestedBy", userProjection)
    .populate("respondedBy", userProjection)
    .sort({ createdAt: -1, startsAt: 1 });

  return meetingRequests.map(serializeMeetingRequest);
};

export const updateMeetingRequestStatus = async (authUser, meetingRequestId, payload = {}) => {
  assertAuthenticatedUser(authUser);

  if (authUser.role !== "superadmin") {
    throw new AppError("Forbidden: only superadmin can update meeting request status", 403);
  }

  const meetingRequest = await getMeetingRequestOrThrow(meetingRequestId);
  const status = validateMeetingStatus(payload.status, allowedMeetingDecisionStatuses);

  meetingRequest.status = status;
  meetingRequest.respondedBy = authUser.userId;
  meetingRequest.respondedAt = new Date();
  meetingRequest.responseNote = normalizeOptionalText(payload.responseNote);
  await meetingRequest.save();

  return serializeMeetingRequest(await getMeetingRequestOrThrow(meetingRequest._id));
};

export const getMySchedules = async (authUser, query = {}) => {
  assertAuthenticatedUser(authUser);
  assertAllowedRole(authUser.role);

  const filters = buildMeetingFilters(authUser, query, "accepted");
  const schedules = await MeetingRequest.find(filters)
    .populate("conversation")
    .populate("list", listProjection)
    .populate("investor", userProjection)
    .populate("investee", userProjection)
    .populate("requestedBy", userProjection)
    .populate("respondedBy", userProjection)
    .sort({ startsAt: 1, createdAt: -1 });

  return schedules.map(serializeMeetingRequest);
};

export const getMeetingRequestById = async (authUser, meetingRequestId) => {
  const meetingRequest = await getMeetingRequestOrThrow(meetingRequestId);
  assertMeetingRequestAccess(authUser, meetingRequest);

  return serializeMeetingRequest(meetingRequest);
};

export const getScheduleById = async (authUser, meetingRequestId) => {
  const meetingRequest = await getMeetingRequestOrThrow(meetingRequestId);
  assertMeetingRequestAccess(authUser, meetingRequest);

  if (meetingRequest.status !== "accepted") {
    throw new AppError("Schedule not found", 404);
  }

  return serializeMeetingRequest(meetingRequest);
};
