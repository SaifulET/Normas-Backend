import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import SupportConversation from "../models/supportConversation.model.js";
import BlockedIp from "../models/blockedIp.model.js";

export const SUPPORT_IP_MESSAGE_LIMIT = 7;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeText = (value) => String(value || "").trim();

const escapeRegex = (value) => normalizeText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = ({ page = 1, limit = 8 } = {}) => {
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number(limit) || 8, 1), 100);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
  };
};

const serializeBlockedIp = (record) => ({
  id: record._id.toString(),
  ip: record.ip,
  reason: record.reason || "Exceeded 7 support messages",
  messageCount: record.messageCount || 0,
  blockedAt: record.blockedAt || record.createdAt,
  lastRequestAt: record.lastRequestAt || record.updatedAt,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const isIncomingSupportMessage = (message) => ["user", "guest"].includes(message.senderType);

export const countIncomingSupportMessagesForIp = async (ip, sinceDate) => {
  const normalizedIp = normalizeText(ip);

  if (!normalizedIp) {
    return 0;
  }

  const conversations = await SupportConversation.find({ clientIp: normalizedIp }).select(
    "messages.senderType messages.sentAt createdAt"
  );
  const sinceTime = sinceDate ? new Date(sinceDate).getTime() : 0;

  return conversations.reduce((total, conversation) => {
    const incomingCount = (conversation.messages || []).filter((message) => {
      if (!isIncomingSupportMessage(message)) {
        return false;
      }

      if (!sinceTime) {
        return true;
      }

      const sentTime = new Date(message.sentAt || conversation.createdAt).getTime();
      return sentTime > sinceTime;
    }).length;

    return total + incomingCount;
  }, 0);
};

export const blockIp = async ({ ip, messageCount, reason = "Exceeded 7 support messages" }) => {
  const normalizedIp = normalizeText(ip);

  if (!normalizedIp) {
    return null;
  }

  return BlockedIp.findOneAndUpdate(
    { ip: normalizedIp },
    {
      $set: {
        ip: normalizedIp,
        messageCount: messageCount || 0,
        reason,
        status: "blocked",
        lastRequestAt: new Date(),
        blockedAt: new Date(),
        unblockedAt: null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

export const getBlockedIp = async (ip) => {
  const normalizedIp = normalizeText(ip);

  if (!normalizedIp) {
    return null;
  }

  return BlockedIp.findOne({ ip: normalizedIp });
};

export const assertSupportIpAllowed = async (ip) => {
  const normalizedIp = normalizeText(ip);

  if (!normalizedIp) {
    return { ip: "", messageCount: 0 };
  }

  const existingRecord = await getBlockedIp(normalizedIp);
  const sinceDate = existingRecord?.status === "unblocked" ? existingRecord.unblockedAt : null;
  const messageCount = await countIncomingSupportMessagesForIp(normalizedIp, sinceDate);

  if (existingRecord?.status === "blocked") {
    existingRecord.lastRequestAt = new Date();
    existingRecord.messageCount = messageCount;
    await existingRecord.save();
    throw new AppError("This IP has been blocked from sending support messages.", 403);
  }

  if (messageCount >= SUPPORT_IP_MESSAGE_LIMIT) {
    await blockIp({
      ip: normalizedIp,
      messageCount,
      reason: "Exceeded 7 support messages",
    });
    throw new AppError("This IP has been blocked from sending support messages.", 403);
  }

  if (existingRecord) {
    existingRecord.lastRequestAt = new Date();
    existingRecord.messageCount = messageCount;
    await existingRecord.save();
  }

  return {
    ip: normalizedIp,
    messageCount,
  };
};

export const syncExceededSupportIps = async () => {
  const conversations = await SupportConversation.find({
    clientIp: {
      $nin: ["", null],
    },
  }).select("clientIp messages.senderType");

  const counts = new Map();

  conversations.forEach((conversation) => {
    const incomingCount = (conversation.messages || []).filter(isIncomingSupportMessage).length;
    counts.set(conversation.clientIp, (counts.get(conversation.clientIp) || 0) + incomingCount);
  });

  const existingRecords = await BlockedIp.find({
    ip: {
      $in: [...counts.keys()],
    },
  }).select("ip status");
  const skippedIps = new Set(
    existingRecords.filter((record) => record.status === "unblocked").map((record) => record.ip)
  );

  const exceeded = [...counts.entries()].filter(
    ([ip, messageCount]) => messageCount > SUPPORT_IP_MESSAGE_LIMIT && !skippedIps.has(ip)
  );

  await Promise.all(
    exceeded.map(([ip, messageCount]) =>
      blockIp({
        ip,
        messageCount,
        reason: "Exceeded 7 support messages",
      })
    )
  );
};

export const getBlockedIps = async (query = {}) => {
  await syncExceededSupportIps();

  const { page, limit } = parsePagination(query);
  const search = normalizeText(query.search);
  const filters = {
    status: "blocked",
  };

  if (search) {
    filters.ip = new RegExp(escapeRegex(search), "i");
  }

  const [records, total] = await Promise.all([
    BlockedIp.find(filters)
      .sort({ blockedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    BlockedIp.countDocuments(filters),
  ]);

  return {
    blockedIps: records.map(serializeBlockedIp),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const unblockIp = async (blockedIpId) => {
  if (!isValidObjectId(blockedIpId)) {
    throw new AppError("Invalid blocked IP id", 400);
  }

  const record = await BlockedIp.findById(blockedIpId);

  if (!record) {
    throw new AppError("Blocked IP not found", 404);
  }

  record.status = "unblocked";
  record.unblockedAt = new Date();
  record.lastRequestAt = new Date();
  await record.save();

  return {
    id: record._id.toString(),
    ip: record.ip,
    message: "IP unblocked successfully",
  };
};
