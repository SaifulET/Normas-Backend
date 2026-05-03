import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import User from "../../auth/models/user.model.js";
import LegalContent from "../models/legalContent.model.js";

const allowedTypes = ["terms-and-conditions", "privacy-policy"];

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const validateType = (type) => {
  if (!allowedTypes.includes(type)) {
    throw new AppError("type must be terms-and-conditions or privacy-policy", 400);
  }
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

const getLegalContentByIdOrThrow = async (contentId) => {
  if (!isValidObjectId(contentId)) {
    throw new AppError("Invalid contentId", 400);
  }

  const content = await LegalContent.findById(contentId);

  if (!content) {
    throw new AppError("Legal content not found", 404);
  }

  return content;
};

export const createLegalContent = async (authUser, payload) => {
  await getUserOrThrow(authUser.userId);
  validateType(payload.type);

  const existingContent = await LegalContent.findOne({ type: payload.type });

  if (existingContent) {
    throw new AppError(`Content for ${payload.type} already exists`, 409);
  }

  const createdContent = await LegalContent.create({
    type: payload.type,
    title: payload.title || "",
    content: payload.content || "",
    lastModifiedBy: authUser.userId,
    lastModifiedAt: new Date(),
  });

  return LegalContent.findById(createdContent._id).populate(
    "lastModifiedBy",
    "name email role"
  );
};

export const updateLegalContent = async (authUser, contentId, payload) => {
  await getUserOrThrow(authUser.userId);
  const legalContent = await getLegalContentByIdOrThrow(contentId);

  if (typeof payload.title !== "undefined") {
    legalContent.title = payload.title;
  }

  if (typeof payload.content !== "undefined") {
    legalContent.content = payload.content;
  }

  if (typeof payload.type !== "undefined") {
    validateType(payload.type);

    const duplicateTypeContent = await LegalContent.findOne({
      type: payload.type,
      _id: { $ne: legalContent._id },
    });

    if (duplicateTypeContent) {
      throw new AppError(`Content for ${payload.type} already exists`, 409);
    }

    legalContent.type = payload.type;
  }

  legalContent.lastModifiedBy = authUser.userId;
  legalContent.lastModifiedAt = new Date();

  await legalContent.save();

  return LegalContent.findById(legalContent._id).populate("lastModifiedBy", "name email role");
};

export const getAllLegalContents = async () => {
  return LegalContent.find()
    .populate("lastModifiedBy", "name email role")
    .sort({ createdAt: -1 });
};

export const getLegalContentById = async (contentId) => {
  const legalContent = await getLegalContentByIdOrThrow(contentId);

  return LegalContent.findById(legalContent._id).populate("lastModifiedBy", "name email role");
};

export const getLegalContentByType = async (type) => {
  validateType(type);

  const legalContent = await LegalContent.findOne({ type }).populate(
    "lastModifiedBy",
    "name email role"
  );

  if (!legalContent) {
    throw new AppError("Legal content not found", 404);
  }

  return legalContent;
};

export const deleteLegalContent = async (contentId) => {
  const legalContent = await getLegalContentByIdOrThrow(contentId);

  await LegalContent.findByIdAndDelete(contentId);

  return {
    id: legalContent._id,
    message: "Legal content deleted successfully",
  };
};
