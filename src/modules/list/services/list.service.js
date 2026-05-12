import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import User from "../../auth/models/user.model.js";
import List from "../models/list.model.js";

const allowedStatuses = ["activated", "deactivated", "suspended"];
const maxDescriptionImageSize = 5 * 1024 * 1024;
const maxDescriptionImageCount = 10;
const maxDescriptionImagesTotalSize = 10 * 1024 * 1024;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeText = (value) => String(value || "").trim();

const escapeRegex = (value) => normalizeText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseStringList = (value) => {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => parseStringList(item))
      .filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildCaseInsensitiveInFilter = (values) => ({
  $in: values.map((value) => new RegExp(`^${escapeRegex(value)}$`, "i")),
});

const parsePagination = ({ page = 1, limit = 12 } = {}) => {
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number(limit) || 12, 1), 100);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
  };
};

const parseOptionalNumber = (value, fieldName) => {
  if (typeof value === "undefined" || value === null || value === "") {
    return undefined;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new AppError(`${fieldName} must be a valid non-negative number`, 400);
  }

  return parsedValue;
};

const firstDefined = (...values) => values.find((value) => typeof value !== "undefined");

const getAwsConfig = () => {
  const region = process.env.AWS_REGION?.trim();
  const bucketName = process.env.AWS_BUCKET_NAME?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!region || !bucketName || !accessKeyId || !secretAccessKey) {
    throw new AppError("AWS S3 credentials are not configured", 500);
  }

  return {
    region,
    bucketName,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };
};

const buildDescriptionImageKey = (userId, extension) => {
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, "") || "image";
  return `lists/${userId}/description-${Date.now()}-${randomUUID()}.${safeExtension}`;
};

const getExtensionFromMimeType = (mimeType) => {
  const extension = mimeType.split("/")[1]?.toLowerCase() || "image";
  return extension === "jpeg" ? "jpg" : extension;
};

const uploadDescriptionImageToS3 = async ({ buffer, mimeType, userId }) => {
  const awsConfig = getAwsConfig();
  const s3Client = new S3Client({
    region: awsConfig.region,
    credentials: awsConfig.credentials,
  });
  const key = buildDescriptionImageKey(userId, getExtensionFromMimeType(mimeType));

  await s3Client.send(
    new PutObjectCommand({
      Bucket: awsConfig.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  return `https://${awsConfig.bucketName}.s3.${awsConfig.region}.amazonaws.com/${key}`;
};

const parseBase64ImageDataUrl = (src) => {
  const match = normalizeText(src).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i);

  if (!match) {
    return null;
  }

  const mimeType = match[1].toLowerCase();
  const base64 = match[2].replace(/\s/g, "");
  const buffer = Buffer.from(base64, "base64");

  if (!buffer.length || buffer.length > maxDescriptionImageSize) {
    throw new AppError("description image must be a valid image up to 5MB", 400);
  }

  return {
    buffer,
    mimeType,
  };
};

const replaceDescriptionImageSources = async (description, userId) => {
  const normalizedDescription = String(description || "");
  const srcPattern = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(data:image\/[^"']+)\2/gi;
  const uploads = new Map();
  let totalImageSize = 0;
  let match;

  while ((match = srcPattern.exec(normalizedDescription)) !== null) {
    const src = match[3];

    if (!uploads.has(src)) {
      const image = parseBase64ImageDataUrl(src);

      if (image) {
        if (uploads.size >= maxDescriptionImageCount) {
          throw new AppError(`description can include up to ${maxDescriptionImageCount} inline images`, 400);
        }

        totalImageSize += image.buffer.length;

        if (totalImageSize > maxDescriptionImagesTotalSize) {
          throw new AppError("description images can be up to 10MB total", 400);
        }

        uploads.set(src, uploadDescriptionImageToS3({ ...image, userId }));
      }
    }
  }

  if (uploads.size === 0) {
    return normalizedDescription;
  }

  const uploadedUrls = new Map();

  for (const [src, uploadPromise] of uploads.entries()) {
    uploadedUrls.set(src, await uploadPromise);
  }

  return normalizedDescription.replace(srcPattern, (fullMatch, prefix, quote, src) => {
    const uploadedUrl = uploadedUrls.get(src);
    return uploadedUrl ? `${prefix}${quote}${uploadedUrl}${quote}` : fullMatch;
  });
};

const buildFilteredListsQuery = (query = {}) => {
  const filters = {};
  const status = normalizeText(query.status || "activated");

  if (!allowedStatuses.includes(status)) {
    throw new AppError("status must be activated, deactivated, or suspended", 400);
  }

  filters.status = status;

  const search = normalizeText(query.search || query.keyword);

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");

    filters.$or = [
      { title: searchRegex },
      { keyword: searchRegex },
      { description: searchRegex },
      { country: searchRegex },
      { stage: searchRegex },
      { sector: searchRegex },
    ];
  }

  const sectors = parseStringList(query.sector || query.sectors);

  if (sectors.length > 0) {
    filters.sector = buildCaseInsensitiveInFilter(sectors);
  }

  const stages = parseStringList(query.stage || query.stages || query.businessStage);

  if (stages.length > 0) {
    filters.stage = buildCaseInsensitiveInFilter(stages);
  }

  const countries = parseStringList(query.country || query.countries);

  if (countries.length > 0) {
    filters.country = buildCaseInsensitiveInFilter(countries);
  }

  const minFunding = parseOptionalNumber(
    firstDefined(query.minFundingTarget, query.minFunding, query.fundingMin),
    "minFundingTarget"
  );
  const maxFunding = parseOptionalNumber(
    firstDefined(query.maxFundingTarget, query.maxFunding, query.fundingMax),
    "maxFundingTarget"
  );

  if (
    typeof minFunding !== "undefined" &&
    typeof maxFunding !== "undefined" &&
    minFunding > maxFunding
  ) {
    throw new AppError("minFundingTarget cannot be greater than maxFundingTarget", 400);
  }

  if (typeof minFunding !== "undefined" || typeof maxFunding !== "undefined") {
    filters.fundingTarget = {};

    if (typeof minFunding !== "undefined") {
      filters.fundingTarget.$gte = minFunding;
    }

    if (typeof maxFunding !== "undefined") {
      filters.fundingTarget.$lte = maxFunding;
    }
  }

  return filters;
};

const normalizeAdditionalDetails = (details = []) => {
  if (!Array.isArray(details)) {
    throw new AppError("additionalDetails must be an array", 400);
  }

  return details.map((detail) => ({
    key: typeof detail?.key === "string" ? detail.key.trim() : "",
    value: typeof detail?.value === "string" ? detail.value.trim() : "",
  }));
};

const normalizeFundingTarget = (value) => {
  if (typeof value === "undefined" || value === null || value === "") {
    return undefined;
  }

  const normalizedValue = Number(value);

  if (Number.isNaN(normalizedValue) || normalizedValue < 0) {
    throw new AppError("fundingTarget must be a valid non-negative number", 400);
  }

  return normalizedValue;
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

const getListOrThrow = async (listId) => {
  if (!isValidObjectId(listId)) {
    throw new AppError("Invalid listId", 400);
  }

  const list = await List.findById(listId);

  if (!list) {
    throw new AppError("List not found", 404);
  }

  return list;
};

const assertOwnerOrSuperadmin = (authUser, list) => {
  const isOwner = list.user.toString() === authUser.userId;
  const isSuperadmin = authUser.role === "superadmin";

  if (!isOwner && !isSuperadmin) {
    throw new AppError("Forbidden: you can only manage your own list", 403);
  }
};

const buildCreatePayload = async (authUser, payload) => {
  const fundingTarget = normalizeFundingTarget(payload.fundingTarget);
  const description = await replaceDescriptionImageSources(payload.description, authUser.userId);

  return {
    user: authUser.userId,
    bannerImage: payload.bannerImage || null,
    title: payload.title || "",
    country: payload.country || "",
    stage: payload.stage || "",
    sector: payload.sector || "",
    fundingTarget: typeof fundingTarget === "undefined" ? 0 : fundingTarget,
    keyword: payload.keyword || "",
    description,
    additionalDetails: normalizeAdditionalDetails(payload.additionalDetails || []),
    status: allowedStatuses.includes(payload.status) ? payload.status : "deactivated",
  };
};

export const createList = async (authUser, payload) => {
  await getUserOrThrow(authUser.userId);

  const createdList = await List.create(await buildCreatePayload(authUser, payload));

  return List.findById(createdList._id).populate("user", "name email role");
};

export const updateList = async (authUser, listId, payload) => {
  const list = await getListOrThrow(listId);
  assertOwnerOrSuperadmin(authUser, list);

  if (typeof payload.bannerImage === "string") {
    list.bannerImage = payload.bannerImage;
  }

  if (typeof payload.title !== "undefined") {
    list.title = payload.title;
  }

  if (typeof payload.country !== "undefined") {
    list.country = payload.country;
  }

  if (typeof payload.stage !== "undefined") {
    list.stage = payload.stage;
  }

  if (typeof payload.sector !== "undefined") {
    list.sector = payload.sector;
  }

  if (typeof payload.keyword !== "undefined") {
    list.keyword = payload.keyword;
  }

  if (typeof payload.description !== "undefined") {
    list.description = await replaceDescriptionImageSources(payload.description, list.user);
  }

  if (typeof payload.fundingTarget !== "undefined") {
    list.fundingTarget = normalizeFundingTarget(payload.fundingTarget);
  }

  if (typeof payload.additionalDetails !== "undefined") {
    list.additionalDetails = normalizeAdditionalDetails(payload.additionalDetails);
  }

  await list.save();

  return List.findById(list._id).populate("user", "name email role");
};

export const getAllLists = async () => {
  return List.find().populate("user", "name email role").sort({ createdAt: -1 });
};

export const getFilteredLists = async (query = {}) => {
  const filters = buildFilteredListsQuery(query);
  const { page, limit } = parsePagination(query);

  const [lists, total] = await Promise.all([
    List.find(filters)
      .populate("user", "name email role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    List.countDocuments(filters),
  ]);

  return {
    lists,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getSectorListCounts = async (query = {}) => {
  const status = normalizeText(query.status || "activated");

  if (!allowedStatuses.includes(status)) {
    throw new AppError("status must be activated, deactivated, or suspended", 400);
  }

  const sectors = await List.aggregate([
    {
      $match: {
        status,
        sector: {
          $exists: true,
          $ne: "",
        },
      },
    },
    {
      $group: {
        _id: "$sector",
        listAmount: {
          $sum: 1,
        },
      },
    },
    {
      $project: {
        _id: 0,
        sector: "$_id",
        listAmount: 1,
      },
    },
    {
      $sort: {
        sector: 1,
      },
    },
  ]);

  return {
    sectors,
    totalSectors: sectors.length,
    totalLists: sectors.reduce((total, item) => total + item.listAmount, 0),
  };
};

export const getListById = async (listId) => {
  const list = await getListOrThrow(listId);
  return List.findById(list._id).populate("user", "name email role");
};

export const getMyLists = async (authUser) => {
  await getUserOrThrow(authUser.userId);

  return List.find({ user: authUser.userId })
    .populate("user", "name email role")
    .sort({ createdAt: -1 });
};

export const updateListViewCount = async (listId, payload) => {
  const list = await getListOrThrow(listId);
  const incrementBy =
    typeof payload?.incrementBy === "undefined" ? 1 : Number(payload.incrementBy);

  if (Number.isNaN(incrementBy) || incrementBy < 0) {
    throw new AppError("incrementBy must be a valid non-negative number", 400);
  }

  list.viewCount += incrementBy;
  await list.save();

  return List.findById(list._id).populate("user", "name email role");
};

export const changeListStatus = async (authUser, listId, status) => {
  console.log("changeListStatus called with:", { authUser, listId, status });
  const list = await getListOrThrow(listId);
  assertOwnerOrSuperadmin(authUser, list);

  if (!allowedStatuses.includes(status)) {
    throw new AppError("status must be activated, deactivated, or suspended", 400);
  }

  list.status = status;
  await list.save();

  return List.findById(list._id).populate("user", "name email role");
};

export const deleteList = async (authUser, listId) => {
  const list = await getListOrThrow(listId);
  assertOwnerOrSuperadmin(authUser, list);

  await List.findByIdAndDelete(listId);

  return {
    id: list._id,
    message: "List deleted successfully",
  };
};
