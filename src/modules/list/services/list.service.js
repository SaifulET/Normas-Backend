import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import User from "../../auth/models/user.model.js";
import List from "../models/list.model.js";

const allowedStatuses = ["activated", "deactivated", "suspended"];

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

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

const buildCreatePayload = (authUser, payload) => {
  const fundingTarget = normalizeFundingTarget(payload.fundingTarget);

  return {
    user: authUser.userId,
    bannerImage: payload.bannerImage || null,
    title: payload.title || "",
    country: payload.country || "",
    stage: payload.stage || "",
    sector: payload.sector || "",
    fundingTarget: typeof fundingTarget === "undefined" ? 0 : fundingTarget,
    keyword: payload.keyword || "",
    description: payload.description || "",
    additionalDetails: normalizeAdditionalDetails(payload.additionalDetails || []),
    status: allowedStatuses.includes(payload.status) ? payload.status : "deactivated",
  };
};

export const createList = async (authUser, payload) => {
  await getUserOrThrow(authUser.userId);

  const createdList = await List.create(buildCreatePayload(authUser, payload));

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
    list.description = payload.description;
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
