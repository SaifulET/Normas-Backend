import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import User from "../../auth/models/user.model.js";
import {
  createPostModerationAlert,
  moderatePost,
} from "../../moderation/services/moderation.service.js";
import {
  notifySuperadmins,
  notifyUsers,
} from "../../notification/services/notification.service.js";
import List from "../models/list.model.js";
import SavedList from "../models/savedList.model.js";

const allowedStatuses = ["pending", "activated", "deactivated", "suspended", "under_review"];
const editableContentFields = [
  "bannerImage",
  "title",
  "country",
  "stage",
  "sector",
  "fundingTarget",
  "keyword",
  "description",
  "additionalDetails",
];
const relatedListLimit = 5;
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

const buildCaseInsensitiveExactFilter = (value) => new RegExp(`^${escapeRegex(value)}$`, "i");

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

const getEntityId = (entity) => entity?._id || entity;

const toPlainObject = (document) => {
  if (!document) {
    return document;
  }

  return typeof document.toObject === "function"
    ? document.toObject()
    : { ...document };
};

const canViewPendingDraft = (list, authUser = null) => {
  if (!authUser || !list?.pendingDraft) {
    return false;
  }

  const ownerId = getEntityId(list.user)?.toString();
  return authUser.role === "superadmin" || ownerId === authUser.userId;
};

export const serializeListForViewer = (list, authUser = null) => {
  const plainList = toPlainObject(list);

  if (!plainList) {
    return plainList;
  }

  const pendingDraft = plainList.pendingDraft || null;
  const serializedList = {
    ...plainList,
  };

  if (!canViewPendingDraft(plainList, authUser)) {
    delete serializedList.pendingDraft;
    delete serializedList.hasPendingDraft;
    return serializedList;
  }

  const publishedContent = editableContentFields.reduce((content, field) => {
    content[field] = plainList[field];
    return content;
  }, {});

  for (const field of editableContentFields) {
    if (typeof pendingDraft[field] !== "undefined") {
      serializedList[field] = pendingDraft[field];
    }
  }

  return {
    ...serializedList,
    hasPendingDraft: Boolean(pendingDraft),
    pendingDraft,
    publishedContent,
  };
};

const serializeListCollectionForViewer = (lists, authUser = null) =>
  lists.map((list) => serializeListForViewer(list, authUser));

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

const stripDescriptionClipboardArtifacts = (description) => {
  return String(description || "")
    .replace(/<span\b[^>]*(?:data-metadata|data-buffer)\s*=\s*(["'])[\s\S]*?\1[^>]*>\s*<\/span>/gi, "")
    .replace(/<!--\s*\(fig(?:ma|meta)\)[\s\S]*?\/fig(?:ma|meta)\s*-->/gi, "")
    .replace(/&lt;!--\s*\(fig(?:ma|meta)\)[\s\S]*?\/fig(?:ma|meta)\s*--&gt;/gi, "");
};

const replaceDescriptionImageSources = async (description, userId) => {
  const normalizedDescription = stripDescriptionClipboardArtifacts(description);
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
  filters.status = "activated";

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

const buildContentPayload = async (authUser, payload, fallback = {}) => {
  const fundingTarget = normalizeFundingTarget(payload.fundingTarget);
  const userId = getEntityId(fallback.user) || authUser.userId;
  const source = fallback.pendingDraft || fallback;
  const rawDescription = typeof payload.description === "undefined"
    ? source.description
    : payload.description;

  return {
    bannerImage: typeof payload.bannerImage === "string"
      ? payload.bannerImage
      : source.bannerImage || null,
    title: firstDefined(payload.title, source.title, ""),
    country: firstDefined(payload.country, source.country, ""),
    stage: firstDefined(payload.stage, source.stage, ""),
    sector: firstDefined(payload.sector, source.sector, ""),
    fundingTarget: typeof fundingTarget === "undefined"
      ? Number(source.fundingTarget) || 0
      : fundingTarget,
    keyword: firstDefined(payload.keyword, source.keyword, ""),
    description: await replaceDescriptionImageSources(rawDescription, userId),
    additionalDetails: typeof payload.additionalDetails === "undefined"
      ? normalizeAdditionalDetails(source.additionalDetails || [])
      : normalizeAdditionalDetails(payload.additionalDetails),
  };
};

const applyContentPayload = (list, content) => {
  for (const field of editableContentFields) {
    list[field] = content[field];
  }
};

const buildPendingDraft = (authUser, content) => ({
  ...content,
  submittedAt: new Date(),
  submittedBy: authUser.userId,
});

const getPendingActionLabel = (approvalStatus) =>
  approvalStatus === "pending_update" ? "updated" : "created";

const isCreateReviewStatus = (approvalStatus) =>
  ["pending_create", "rejected_create"].includes(approvalStatus);

const isUpdateReviewStatus = (approvalStatus) =>
  ["pending_update", "rejected_update"].includes(approvalStatus);

const notifyListSubmittedForReview = async (list, action) => {
  const title = list.pendingDraft?.title || list.title || "Untitled pitch";

  await notifySuperadmins({
    type: "pitch_submitted",
    title: action === "updated" ? "Pitch update awaiting approval" : "New pitch awaiting approval",
    message: `${title} was ${action} by an investee and is waiting for superadmin activation.`,
    referenceType: "list",
    referenceId: list._id,
    metadata: {
      action,
      listId: list._id,
      ownerId: getEntityId(list.user),
      approvalStatus: list.approvalStatus,
    },
  });
};

const notifyListActivated = async (list) => {
  await notifyUsers([getEntityId(list.user)], {
    type: "pitch_approved",
    title: "Pitch activated",
    message: `${list.title || "Your pitch"} has been activated by superadmin.`,
    referenceType: "list",
    referenceId: list._id,
    metadata: {
      action: "activated",
      listId: list._id,
      approvalStatus: list.approvalStatus,
    },
  });
};

const notifyListRejected = async (list, rejectedApprovalStatus) => {
  const title = list.pendingDraft?.title || list.title || "Your pitch";
  const isUpdate = rejectedApprovalStatus === "rejected_update";

  await notifyUsers([getEntityId(list.user)], {
    type: "pitch_rejected",
    title: isUpdate ? "Pitch update was not approved" : "Pitch was not approved",
    message: isUpdate
      ? `${title} was reviewed by superadmin. The update was not published, so the previous approved version remains live.`
      : `${title} was reviewed by superadmin and was not approved for publication.`,
    referenceType: "list",
    referenceId: list._id,
    metadata: {
      action: "rejected",
      listId: list._id,
      approvalStatus: rejectedApprovalStatus,
    },
  });
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

const assertInvestor = (authUser) => {
  if (authUser.role !== "investor") {
    throw new AppError("Only investors can save lists", 403);
  }
};

const populateSavedListQuery = (query) => {
  return query
    .populate("investor", "name email role")
    .populate({
      path: "list",
      populate: {
        path: "user",
        select: "name email role",
      },
    });
};

const populateListQuery = (query) => query.populate("user", "name email role");

const appendRelatedLists = async ({ results, excludedIds, filters, limit }) => {
  const remaining = limit - results.length;

  if (remaining <= 0) {
    return;
  }

  const lists = await populateListQuery(
    List.find({
      status: "activated",
      ...filters,
      _id: {
        $nin: Array.from(excludedIds),
      },
    })
      .sort({ createdAt: -1 })
      .limit(remaining)
  );

  for (const list of lists) {
    const listId = list._id.toString();
    results.push(list);
    excludedIds.add(listId);
  }
};

const appendRandomRelatedLists = async ({ results, excludedIds, limit }) => {
  const remaining = limit - results.length;

  if (remaining <= 0) {
    return;
  }

  const sampledLists = await List.aggregate([
    {
      $match: {
        status: "activated",
        _id: {
          $nin: Array.from(excludedIds).map((id) => new mongoose.Types.ObjectId(id)),
        },
      },
    },
    {
      $sample: {
        size: remaining,
      },
    },
    {
      $project: {
        _id: 1,
      },
    },
  ]);
  const sampledIds = sampledLists.map((list) => list._id);

  if (sampledIds.length === 0) {
    return;
  }

  const listsById = new Map(
    (
      await populateListQuery(
        List.find({
          _id: {
            $in: sampledIds,
          },
        })
      )
    ).map((list) => [list._id.toString(), list])
  );

  for (const sampledId of sampledIds) {
    const list = listsById.get(sampledId.toString());

    if (!list) {
      continue;
    }

    results.push(list);
    excludedIds.add(list._id.toString());
  }
};

const buildCreatePayload = async (authUser, payload) => {
  const content = await buildContentPayload(authUser, payload);
  const requestedStatus = normalizeText(payload.status);
  const defaultStatus = "deactivated";
  const status = authUser.role === "superadmin"
    ? allowedStatuses.includes(requestedStatus) ? requestedStatus : defaultStatus
    : "pending";

  return {
    user: authUser.userId,
    ...content,
    status,
    approvalStatus: authUser.role === "superadmin" ? "approved" : "pending_create",
    moderationStatus: authUser.role === "superadmin" ? "approved" : "manual_review",
    pendingDraft: authUser.role === "superadmin" ? null : buildPendingDraft(authUser, content),
  };
};

const applyPostModeration = async (list, authUser) => {
  if (authUser.role === "superadmin") {
    return list;
  }

  const moderationResult = moderatePost(list);

  list.moderationStatus = moderationResult.decision;
  list.moderationReasons = moderationResult.reasons;
  list.moderationReviewedBy = null;
  list.moderationReviewedAt = null;

  if (moderationResult.decision === "suspended") {
    list.status = "suspended";
  } else if (moderationResult.decision === "manual_review") {
    list.status = "under_review";
  }

  await list.save();

  if (moderationResult.decision !== "approved") {
    await createPostModerationAlert({ list, moderationResult });
  }

  return list;
};

export const createList = async (authUser, payload) => {
  await getUserOrThrow(authUser.userId);

  const createdList = await List.create(await buildCreatePayload(authUser, payload));
  if (authUser.role === "superadmin") {
    await applyPostModeration(createdList, authUser);
  } else {
    await notifyListSubmittedForReview(createdList, "created");
  }

  const list = await List.findById(createdList._id).populate("user", "name email role");
  return serializeListForViewer(list, authUser);
};

export const updateList = async (authUser, listId, payload) => {
  const list = await getListOrThrow(listId);
  assertOwnerOrSuperadmin(authUser, list);

  const content = await buildContentPayload(authUser, payload, list);

  if (authUser.role === "superadmin") {
    applyContentPayload(list, content);
    list.pendingDraft = null;
    list.approvalStatus = "approved";
    await list.save();
    await applyPostModeration(list, authUser);
  } else {
    const isPendingCreate = isCreateReviewStatus(list.approvalStatus) || list.status === "pending";

    if (isPendingCreate) {
      applyContentPayload(list, content);
      list.status = "pending";
      list.approvalStatus = "pending_create";
    } else {
      list.approvalStatus = "pending_update";
    }

    list.pendingDraft = buildPendingDraft(authUser, content);
    list.moderationStatus = "manual_review";
    list.moderationReasons = [];
    list.moderationReviewedBy = null;
    list.moderationReviewedAt = null;
    await list.save();
    await notifyListSubmittedForReview(list, getPendingActionLabel(list.approvalStatus));
  }

  const updatedList = await List.findById(list._id).populate("user", "name email role");
  return serializeListForViewer(updatedList, authUser);
};

export const getAllLists = async () => {
  const lists = await List.find({ status: "activated" }).populate("user", "name email role").sort({ createdAt: -1 });
  return serializeListCollectionForViewer(lists);
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
    lists: serializeListCollectionForViewer(lists),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getSectorListCounts = async (query = {}) => {
  const sectors = await List.aggregate([
    {
      $match: {
        status: "activated",
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

export const getListById = async (listId, authUser = null) => {
  const list = await getListOrThrow(listId);

  if (list.status !== "activated") {
    const isOwner = authUser?.userId && String(list.user) === String(authUser.userId);
    const isSuperadmin = authUser?.role === "superadmin";

    if (!isOwner && !isSuperadmin) {
      throw new AppError("List not found", 404);
    }
  }

  const populatedList = await populateListQuery(List.findById(list._id));
  return serializeListForViewer(populatedList, authUser);
};

export const getRelatedLists = async (listId) => {
  const referenceList = await getListOrThrow(listId);
  const referenceId = referenceList._id.toString();
  const excludedIds = new Set([referenceId]);
  const results = [];
  const sector = normalizeText(referenceList.sector);
  const stage = normalizeText(referenceList.stage);
  const sectorFilter = sector ? buildCaseInsensitiveExactFilter(sector) : null;
  const stageFilter = stage ? buildCaseInsensitiveExactFilter(stage) : null;

  if (sectorFilter && stageFilter) {
    await appendRelatedLists({
      results,
      excludedIds,
      filters: {
        sector: sectorFilter,
        stage: stageFilter,
      },
      limit: relatedListLimit,
    });
  }

  if (sectorFilter) {
    await appendRelatedLists({
      results,
      excludedIds,
      filters: {
        sector: sectorFilter,
      },
      limit: relatedListLimit,
    });
  }

  if (stageFilter) {
    await appendRelatedLists({
      results,
      excludedIds,
      filters: {
        stage: stageFilter,
      },
      limit: relatedListLimit,
    });
  }

  await appendRandomRelatedLists({
    results,
    excludedIds,
    limit: relatedListLimit,
  });

  return serializeListCollectionForViewer(results);
};

const ensureSuperadmin = (authUser) => {
  if (!authUser?.userId) {
    throw new AppError("Unauthorized", 401);
  }

  if (authUser.role !== "superadmin") {
    throw new AppError("Forbidden: only superadmin can review lists", 403);
  }
};

const buildAiReview = (list) => {
  const result = moderatePost(list);
  const reasons = result.reasons || [];
  const isNotRelevant = reasons.some((reason) =>
    /not clearly related|does not match|spam|random content/i.test(reason)
  );
  const isRelevant = result.decision === "approved" || !isNotRelevant;
  const label = isRelevant
    ? result.decision === "approved"
      ? "Relevant"
      : "Relevant, needs policy review"
    : "Not relevant";

  return {
    decision: result.decision,
    isRelevant,
    label,
    reasons,
    summary: isRelevant
      ? "AI found this pitch generally relevant to startup, funding, or business activity."
      : "AI found signals that this pitch may not be relevant for the investment marketplace.",
  };
};

const serializeListReview = (list) => {
  const serializedList = serializeListForViewer(list, { role: "superadmin" });

  return {
    ...serializedList,
    aiReview: buildAiReview(serializedList),
  };
};

const buildAdminListFilters = (query = {}) => {
  const filters = {};
  const status = normalizeText(query.status);
  const approvalStatus = normalizeText(query.approvalStatus);
  const search = normalizeText(query.search || query.keyword);

  if (status) {
    if (!allowedStatuses.includes(status)) {
      throw new AppError("status must be pending, activated, deactivated, suspended, or under_review", 400);
    }

    filters.status = status;
  }

  if (approvalStatus) {
    if (!["pending_create", "pending_update", "approved", "rejected_create", "rejected_update"].includes(approvalStatus)) {
      throw new AppError("approvalStatus must be pending_create, pending_update, approved, rejected_create, or rejected_update", 400);
    }

    filters.approvalStatus = approvalStatus;
  }

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");

    filters.$or = [
      { title: searchRegex },
      { keyword: searchRegex },
      { description: searchRegex },
      { "pendingDraft.title": searchRegex },
      { "pendingDraft.keyword": searchRegex },
      { "pendingDraft.description": searchRegex },
    ];
  }

  return filters;
};

export const getAdminReviewLists = async (authUser, query = {}) => {
  ensureSuperadmin(authUser);

  const filters = buildAdminListFilters(query);
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;

  const [lists, total, pendingCount] = await Promise.all([
    populateListQuery(
      List.find(filters)
        .sort({ approvalStatus: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ),
    List.countDocuments(filters),
    List.countDocuments({
      $or: [
        { status: "pending" },
        { approvalStatus: { $in: ["pending_create", "pending_update"] } },
      ],
    }),
  ]);

  return {
    lists: lists.map(serializeListReview),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    pendingCount,
  };
};

export const getAdminReviewListById = async (authUser, listId) => {
  ensureSuperadmin(authUser);

  const list = await populateListQuery(List.findById((await getListOrThrow(listId))._id));
  return serializeListReview(list);
};

export const getMyLists = async (authUser) => {
  await getUserOrThrow(authUser.userId);

  const lists = await List.find({ user: authUser.userId })
    .populate("user", "name email role")
    .sort({ createdAt: -1 });

  return serializeListCollectionForViewer(lists, authUser);
};

export const saveInvestorList = async (authUser, payload = {}) => {
  assertInvestor(authUser);
  await getUserOrThrow(authUser.userId);

  const list = await getListOrThrow(payload.listId);

  const savedList = await SavedList.findOneAndUpdate(
    {
      investor: authUser.userId,
      list: list._id,
    },
    {
      $setOnInsert: {
        investor: authUser.userId,
        list: list._id,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return populateSavedListQuery(SavedList.findById(savedList._id));
};

export const getMySavedLists = async (authUser) => {
  assertInvestor(authUser);
  await getUserOrThrow(authUser.userId);

  const savedLists = await populateSavedListQuery(
    SavedList.find({ investor: authUser.userId }).sort({ createdAt: -1 })
  );

  return savedLists
    .filter((savedList) => savedList.list?.status === "activated")
    .map((savedList) => {
      const serializedSavedList = toPlainObject(savedList);
      serializedSavedList.list = serializeListForViewer(savedList.list);
      return serializedSavedList;
    });
};

export const getInvestorSavedListStatus = async (authUser, listId) => {
  assertInvestor(authUser);
  await getUserOrThrow(authUser.userId);

  const list = await getListOrThrow(listId);
  const savedList = await SavedList.findOne({
    investor: authUser.userId,
    list: list._id,
  }).select("_id");

  return {
    list: list._id,
    isSaved: Boolean(savedList),
    savedListId: savedList?._id || null,
  };
};

export const removeInvestorSavedList = async (authUser, listId) => {
  assertInvestor(authUser);
  await getUserOrThrow(authUser.userId);

  const list = await getListOrThrow(listId);
  const deletedSavedList = await SavedList.findOneAndDelete({
    investor: authUser.userId,
    list: list._id,
  });

  if (!deletedSavedList) {
    throw new AppError("Saved list not found", 404);
  }

  return {
    id: deletedSavedList._id,
    list: list._id,
    message: "List removed from saved lists successfully",
  };
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

  const updatedList = await List.findById(list._id).populate("user", "name email role");
  return serializeListForViewer(updatedList);
};

export const changeListStatus = async (authUser, listId, status) => {
  const list = await getListOrThrow(listId);
  assertOwnerOrSuperadmin(authUser, list);
  const requestedStatus = normalizeText(status);

  if (requestedStatus === "rejected") {
    if (authUser.role !== "superadmin") {
      throw new AppError("Forbidden: only superadmin can reject submitted pitch changes", 403);
    }

    if (!list.pendingDraft || !["pending_create", "pending_update"].includes(list.approvalStatus)) {
      throw new AppError("This pitch does not have a pending submission to reject", 400);
    }

    const rejectedApprovalStatus = list.approvalStatus === "pending_update"
      ? "rejected_update"
      : "rejected_create";

    list.approvalStatus = rejectedApprovalStatus;

    if (rejectedApprovalStatus === "rejected_create") {
      list.status = "deactivated";
    }

    if (rejectedApprovalStatus === "rejected_update" && list.moderationStatus === "manual_review") {
      list.moderationStatus = "approved";
      list.moderationReasons = [];
    }

    list.moderationReviewedBy = authUser.userId;
    list.moderationReviewedAt = new Date();
    await list.save();
    await notifyListRejected(list, rejectedApprovalStatus);

    const updatedList = await List.findById(list._id).populate("user", "name email role");
    return serializeListForViewer(updatedList, authUser);
  }

  if (!allowedStatuses.includes(requestedStatus)) {
    throw new AppError("status must be pending, activated, deactivated, suspended, or under_review", 400);
  }

  if (authUser.role !== "superadmin") {
    if (!["activated", "deactivated"].includes(requestedStatus)) {
      throw new AppError("Investees can only activate or deactivate their own pitch", 403);
    }

    if (list.approvalStatus === "pending_create" || list.status === "pending") {
      throw new AppError("This pitch must be activated by superadmin before you can manage its public status.", 403);
    }

    if (["suspended", "under_review"].includes(list.status)) {
      throw new AppError("This pitch is suspended or under review. Please contact support center to restore it.", 403);
    }
  }

  list.status = requestedStatus;

  if (authUser.role === "superadmin") {
    if (requestedStatus === "activated") {
      if (list.pendingDraft) {
        applyContentPayload(list, list.pendingDraft);
        list.pendingDraft = null;
      }

      list.approvalStatus = "approved";
      list.moderationStatus = "approved";
      list.moderationReasons = [];
    } else if (requestedStatus === "suspended") {
      list.moderationStatus = "suspended";
    } else if (requestedStatus === "under_review") {
      list.moderationStatus = "manual_review";
    }

    list.moderationReviewedBy = authUser.userId;
    list.moderationReviewedAt = new Date();
  }

  await list.save();

  if (authUser.role === "superadmin" && requestedStatus === "activated") {
    await notifyListActivated(list);
  }

  const updatedList = await List.findById(list._id).populate("user", "name email role");
  return serializeListForViewer(updatedList, authUser);
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
