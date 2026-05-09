import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import User from "../../auth/models/user.model.js";
import SupportConversation, {
  supportMessageStatuses,
  supportSenderTypes,
  supportStatuses,
} from "../models/supportConversation.model.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const normalizeText = (value) => String(value || "").trim();

const validateMessage = (message, fieldName = "message") => {
  const normalizedMessage = normalizeText(message);

  if (!normalizedMessage) {
    throw new AppError(`${fieldName} is required`, 400);
  }

  if (normalizedMessage.length > 1000) {
    throw new AppError(`${fieldName} must not exceed 1000 characters`, 400);
  }

  return normalizedMessage;
};

const validateSubject = (subject) => {
  const normalizedSubject = normalizeText(subject);

  if (!normalizedSubject) {
    throw new AppError("subject is required", 400);
  }

  if (normalizedSubject.length > 200) {
    throw new AppError("subject must not exceed 200 characters", 400);
  }

  return normalizedSubject;
};

const validateEmail = (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new AppError("email is required", 400);
  }

  return normalizedEmail;
};

const buildMessageResponse = (messageDoc) => ({
  _id: messageDoc._id,
  senderType: messageDoc.senderType,
  senderUser: messageDoc.senderUser,
  senderName: messageDoc.senderName,
  senderEmail: messageDoc.senderEmail,
  message: messageDoc.message,
  sentAt: messageDoc.sentAt,
  messageStatus: messageDoc.messageStatus,
  seenAt: messageDoc.seenAt,
});

const sortMessagesByTime = (messages = []) =>
  [...messages].sort((firstMessage, secondMessage) => {
    const firstTime = new Date(firstMessage.sentAt).getTime();
    const secondTime = new Date(secondMessage.sentAt).getTime();

    return firstTime - secondTime;
  });

const buildConversationRoom = (conversationId) => `support:${conversationId}`;

const getConversationOrThrow = async (conversationId, withGuestToken = false) => {
  if (!isValidObjectId(conversationId)) {
    throw new AppError("Invalid conversationId", 400);
  }

  const query = SupportConversation.findById(conversationId).populate("user", "name email role");

  if (withGuestToken) {
    query.select("+guestAccessToken");
  }

  const conversation = await query;

  if (!conversation) {
    throw new AppError("Support conversation not found", 404);
  }

  return conversation;
};

const getUserOrThrow = async (userId) => {
  if (!isValidObjectId(userId)) {
    throw new AppError("Invalid userId", 400);
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

const assertAuthenticatedUser = (authUser) => {
  if (!authUser?.userId) {
    throw new AppError("Unauthorized", 401);
  }
};

const assertConversationAccess = (authUser, conversation) => {
  if (!authUser?.userId) {
    throw new AppError("Unauthorized", 401);
  }

  if (authUser.role === "superadmin") {
    return;
  }

  if (!conversation.user || conversation.user._id.toString() !== authUser.userId) {
    throw new AppError("Forbidden: you cannot access this conversation", 403);
  }
};

const buildActorFromAuthUser = (authUser) => {
  assertAuthenticatedUser(authUser);

  return {
    senderType: authUser.role === "superadmin" ? "superadmin" : "user",
    senderUser: authUser.userId,
    senderName: authUser.name,
    senderEmail: authUser.email,
    role: authUser.role,
  };
};

const shouldMarkMessageSeen = (viewer, message) => {
  if (message.messageStatus === "seen") {
    return false;
  }

  if (viewer.senderType === "superadmin") {
    return message.senderType !== "superadmin";
  }

  if (viewer.senderType === "user" || viewer.senderType === "guest") {
    return message.senderType === "superadmin";
  }

  return false;
};

const markConversationMessagesAsSeen = async (conversation, viewer) => {
  const seenMessageIds = [];

  conversation.messages.forEach((message) => {
    if (shouldMarkMessageSeen(viewer, message)) {
      message.messageStatus = supportMessageStatuses[1];
      message.seenAt = new Date();
      seenMessageIds.push(message._id.toString());
    }
  });

  if (seenMessageIds.length === 0) {
    return {
      conversation,
      seenMessageIds,
    };
  }

  await conversation.save();

  return {
    conversation: await getConversationOrThrow(conversation._id),
    seenMessageIds,
  };
};

const serializeConversation = (conversation, options = {}) => {
  const sortedMessages = sortMessagesByTime(conversation.messages).map(buildMessageResponse);

  const base = {
    _id: conversation._id,
    user: conversation.user,
    guestName: conversation.guestName,
    guestEmail: conversation.guestEmail,
    subject: conversation.subject,
    status: conversation.status,
    messages: sortedMessages,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };

  if (options.includeGuestToken) {
    base.guestAccessToken = conversation.guestAccessToken;
  }

  return base;
};

const buildParticipantSummary = (conversation) => {
  const hasUser = Boolean(conversation.user);

  return {
    name: hasUser ? conversation.user.name : conversation.guestName || "Guest User",
    email: hasUser ? conversation.user.email : conversation.guestEmail,
    role: hasUser ? conversation.user.role : "guest",
  };
};

const buildConversationListItem = (conversation) => {
  const participant = buildParticipantSummary(conversation);
  const lastMessage = conversation.messages[conversation.messages.length - 1] || null;

  return {
    _id: conversation._id,
    subject: conversation.subject,
    status: conversation.status,
    participant,
    lastMessage: lastMessage ? buildMessageResponse(lastMessage) : null,
    messageCount: conversation.messages.length,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

const createGuestToken = () => crypto.randomBytes(24).toString("hex");

export const verifySocketIdentity = async ({ token, guestToken, conversationId }) => {
  if (!conversationId) {
    throw new AppError("conversationId is required", 400);
  }

  const conversation = await getConversationOrThrow(conversationId, true);

  if (token) {
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

    const isSuperadmin = user.role === "superadmin";
    const isOwner = conversation.user && conversation.user._id.toString() === user._id.toString();

    if (!isSuperadmin && !isOwner) {
      throw new AppError("Forbidden: you cannot access this conversation", 403);
    }

    return {
      conversation,
      actor: {
        senderType: isSuperadmin ? "superadmin" : "user",
        senderUser: user._id,
        senderName: user.name,
        senderEmail: user.email,
        role: user.role,
      },
    };
  }

  if (guestToken) {
    if (conversation.guestAccessToken !== guestToken) {
      throw new AppError("Invalid guest access token", 401);
    }

    return {
      conversation,
      actor: {
        senderType: "guest",
        senderUser: null,
        senderName: conversation.guestName || "Guest User",
        senderEmail: conversation.guestEmail,
        role: "guest",
      },
    };
  }

  throw new AppError("Socket authentication is required", 401);
};

export const createSupportConversation = async (authUser, payload) => {
  const email = validateEmail(authUser?.email || payload.email);
  const subject = validateSubject(payload.subject);
  const message = validateMessage(payload.message);
  const guestName = normalizeText(payload.name);

  let linkedUser = null;

  if (authUser?.userId) {
    linkedUser = await getUserOrThrow(authUser.userId);
  }

  const guestAccessToken = createGuestToken();

  const createdConversation = await SupportConversation.create({
    user: linkedUser?._id || null,
    guestName: linkedUser ? linkedUser.name : guestName,
    guestEmail: linkedUser ? linkedUser.email : email,
    subject,
    status: "pending",
    guestAccessToken,
    messages: [
      {
        senderType: linkedUser ? "user" : "guest",
        senderUser: linkedUser?._id || null,
        senderName: linkedUser ? linkedUser.name : guestName || "Guest User",
        senderEmail: linkedUser ? linkedUser.email : email,
        message,
      },
    ],
    lastMessageAt: new Date(),
  });

  const conversation = await getConversationOrThrow(createdConversation._id, true);

  return serializeConversation(conversation, { includeGuestToken: true });
};

export const getAllSupportConversations = async ({ search, status, page = 1, limit = 10 }) => {
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const filters = {};

  if (status) {
    if (!supportStatuses.includes(status)) {
      throw new AppError("status must be pending, dismissed, or resolved", 400);
    }

    filters.status = status;
  }

  if (search) {
    const keyword = normalizeText(search);

    if (keyword) {
      filters.$or = [
        { guestName: { $regex: keyword, $options: "i" } },
        { guestEmail: { $regex: keyword, $options: "i" } },
        { subject: { $regex: keyword, $options: "i" } },
      ];
    }
  }

  const [conversations, total] = await Promise.all([
    SupportConversation.find(filters)
      .populate("user", "name email role")
      .sort({ lastMessageAt: -1 })
      .skip((normalizedPage - 1) * normalizedLimit)
      .limit(normalizedLimit),
    SupportConversation.countDocuments(filters),
  ]);

  return {
    conversations: conversations.map(buildConversationListItem),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages: Math.ceil(total / normalizedLimit) || 1,
    },
  };
};

export const getSupportConversationById = async (authUser, conversationId) => {
  const conversation = await getConversationOrThrow(conversationId);
  assertConversationAccess(authUser, conversation);
  const actor = buildActorFromAuthUser(authUser);
  const result = await markConversationMessagesAsSeen(conversation, actor);

  return {
    ...serializeConversation(result.conversation),
    seenMessageIds: result.seenMessageIds,
  };
};

export const getMySupportConversations = async (authUser) => {
  assertAuthenticatedUser(authUser);
  await getUserOrThrow(authUser.userId);

  const conversations = await SupportConversation.find({ user: authUser.userId })
    .populate("user", "name email role")
    .sort({ lastMessageAt: -1 });
  const actor = buildActorFromAuthUser(authUser);
  const results = [];

  for (const conversation of conversations) {
    const seenResult = await markConversationMessagesAsSeen(conversation, actor);

    results.push({
      ...serializeConversation(seenResult.conversation),
      seenMessageIds: seenResult.seenMessageIds,
    });
  }

  return results;
};

export const getMySupportConversationById = async (authUser, conversationId) => {
  assertAuthenticatedUser(authUser);

  const conversation = await getConversationOrThrow(conversationId);
  assertConversationAccess(authUser, conversation);

  const actor = buildActorFromAuthUser(authUser);
  const result = await markConversationMessagesAsSeen(conversation, actor);

  return {
    ...serializeConversation(result.conversation),
    seenMessageIds: result.seenMessageIds,
  };
};

export const updateSupportConversationStatus = async (conversationId, status) => {
  const conversation = await getConversationOrThrow(conversationId);

  if (!supportStatuses.includes(status)) {
    throw new AppError("status must be pending, dismissed, or resolved", 400);
  }

  conversation.status = status;
  await conversation.save();

  return serializeConversation(await getConversationOrThrow(conversation._id));
};

export const deleteSupportConversation = async (conversationId) => {
  const conversation = await getConversationOrThrow(conversationId);

  await SupportConversation.findByIdAndDelete(conversationId);

  return {
    id: conversation._id,
    message: "Support conversation deleted successfully",
  };
};

export const createSupportMessage = async ({ conversationId, actor, message }) => {
  const conversation = await getConversationOrThrow(conversationId);
  const normalizedMessage = validateMessage(message);

  if (!supportSenderTypes.includes(actor.senderType)) {
    throw new AppError("Invalid senderType", 400);
  }

  const newMessage = {
    senderType: actor.senderType,
    senderUser: actor.senderUser || null,
    senderName: actor.senderName || "",
    senderEmail: actor.senderEmail || "",
    message: normalizedMessage,
    sentAt: new Date(),
    messageStatus: "sent",
    seenAt: null,
  };

  conversation.messages.push(newMessage);
  conversation.lastMessageAt = new Date();

  if (conversation.status === "dismissed" || conversation.status === "resolved") {
    conversation.status = "pending";
  }

  await conversation.save();

  const savedConversation = await getConversationOrThrow(conversation._id);
  const savedMessage = savedConversation.messages[savedConversation.messages.length - 1];

  return {
    room: buildConversationRoom(conversationId),
    conversation: serializeConversation(savedConversation),
    message: buildMessageResponse(savedMessage),
  };
};

export const buildSocketRoomName = buildConversationRoom;

export const markSupportConversationAsSeen = async ({ conversationId, actor }) => {
  const conversation = await getConversationOrThrow(conversationId);

  if (actor.role !== "superadmin") {
    if (!conversation.user || conversation.user._id.toString() !== String(actor.senderUser || "")) {
      throw new AppError("Forbidden: you cannot access this conversation", 403);
    }
  }

  const result = await markConversationMessagesAsSeen(conversation, actor);

  return {
    room: buildConversationRoom(conversationId),
    conversation: serializeConversation(result.conversation),
    seenMessageIds: result.seenMessageIds,
  };
};
