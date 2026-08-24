import path from "path";
import { randomUUID } from "crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import AppError from "../../../utils/appError.js";

let cachedS3Client = null;

const getAwsConfig = () => {
  const region = process.env.AWS_REGION?.trim();
  const bucketName = process.env.AWS_S3_BUCKET?.trim() || process.env.AWS_BUCKET_NAME?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!region || !bucketName) {
    throw new AppError("AWS S3 chat attachment storage is not configured", 500);
  }

  return {
    region,
    bucketName,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  };
};

const getS3Client = () => {
  if (!cachedS3Client) {
    const awsConfig = getAwsConfig();
    cachedS3Client = new S3Client({
      region: awsConfig.region,
      credentials: awsConfig.credentials,
    });
  }

  return cachedS3Client;
};

const getChatAttachmentFolder = () =>
  (process.env.AWS_S3_CHAT_ATTACHMENT_FOLDER?.trim() || "chat-attachments").replace(/^\/+|\/+$/g, "");

const sanitizePathSegment = (value, fallback = "file") =>
  String(value || fallback)
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "-")
    .replace(/-+/g, "-") || fallback;

const sanitizeFileName = (value) => {
  const parsed = path.parse(String(value || "attachment"));
  const name = sanitizePathSegment(parsed.name, "attachment");
  const extension = sanitizePathSegment(parsed.ext.replace(/^\./, ""), "bin");

  return `${name}.${extension}`;
};

export const isChatAttachmentKey = (key) => {
  const normalizedKey = String(key || "").trim();
  const folder = getChatAttachmentFolder();

  return Boolean(normalizedKey && normalizedKey.startsWith(`${folder}/`));
};

export const getChatAttachmentPrefix = ({ channel, conversationId }) => {
  const safeChannel = sanitizePathSegment(channel || "chat", "chat");
  const safeConversationId = sanitizePathSegment(conversationId, "conversation");

  return `${getChatAttachmentFolder()}/${safeChannel}/${safeConversationId}/`;
};

export const isChatAttachmentKeyForConversation = (key, options) => {
  const normalizedKey = String(key || "").trim();

  return isChatAttachmentKey(normalizedKey) && normalizedKey.startsWith(getChatAttachmentPrefix(options));
};

export const uploadChatAttachmentToS3 = async (file, { conversationId, channel }) => {
  if (!file?.buffer) {
    throw new AppError("file is required", 400);
  }

  const awsConfig = getAwsConfig();
  const fileName = sanitizeFileName(file.originalname);
  const key = `${getChatAttachmentPrefix({ channel, conversationId })}${Date.now()}-${randomUUID()}-${fileName}`;

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: awsConfig.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype || "application/octet-stream",
    })
  );

  return {
    key,
    url: `https://${awsConfig.bucketName}.s3.${awsConfig.region}.amazonaws.com/${key}`,
    originalName: file.originalname || fileName,
    mimeType: file.mimetype || "application/octet-stream",
    size: file.size || file.buffer.length,
  };
};

export const deleteChatAttachmentFromS3 = async (key) => {
  const normalizedKey = String(key || "").trim();

  if (!normalizedKey) {
    return false;
  }

  if (!isChatAttachmentKey(normalizedKey)) {
    throw new AppError("Invalid chat attachment key", 400);
  }

  const awsConfig = getAwsConfig();

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: awsConfig.bucketName,
      Key: normalizedKey,
    })
  );

  return true;
};

export const normalizeChatAttachments = (attachments = []) => {
  let parsedAttachments = attachments;

  if (typeof attachments === "string") {
    try {
      parsedAttachments = JSON.parse(attachments || "[]");
    } catch (_error) {
      throw new AppError("attachments must be valid JSON", 400);
    }
  }

  if (!Array.isArray(parsedAttachments)) {
    throw new AppError("attachments must be an array", 400);
  }

  if (parsedAttachments.length > 10) {
    throw new AppError("attachments must not exceed 10 files", 400);
  }

  return parsedAttachments.map((attachment) => {
    const key = String(attachment?.key || "").trim();
    const url = String(attachment?.url || "").trim();
    const originalName = String(attachment?.originalName || "Attachment").trim();
    const mimeType = String(attachment?.mimeType || "application/octet-stream").trim();
    const size = Number(attachment?.size || 0);

    if (!key || !url || !isChatAttachmentKey(key)) {
      throw new AppError("Invalid chat attachment", 400);
    }

    return {
      key,
      url,
      originalName: originalName.slice(0, 255),
      mimeType: mimeType.slice(0, 100),
      size: Number.isFinite(size) && size >= 0 ? size : 0,
    };
  });
};
