import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import Kyc from "../../kyc/models/kyc.model.js";
import User from "../models/user.model.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const normalizeText = (value) => String(value || "").trim();

const profileProjection = "name email mobile profileImage accountStatus taxPercentage socialLinks role createdAt updatedAt";

const normalizeTaxPercentage = (value) => {
  if (typeof value === "undefined" || value === null || value === "") {
    return undefined;
  }

  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue) || normalizedValue < 0 || normalizedValue > 100) {
    throw new AppError("taxPercentage must be between 0 and 100", 400);
  }

  return normalizedValue;
};

const normalizeSocialLinks = (value) => {
  if (typeof value === "undefined") {
    return undefined;
  }

  const parsedValue = typeof value === "string" ? JSON.parse(value) : value;

  if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
    throw new AppError("socialLinks must be a valid object", 400);
  }

  return {
    whatsapp: normalizeText(parsedValue.whatsapp),
    facebook: normalizeText(parsedValue.facebook),
    instagram: normalizeText(parsedValue.instagram),
    youtube: normalizeText(parsedValue.youtube),
    x: normalizeText(parsedValue.x),
    tiktok: normalizeText(parsedValue.tiktok),
  };
};

const buildProfileResponse = (user, profileImage = user.profileImage) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  mobile: user.mobile,
  profileImage,
  accountStatus: user.accountStatus || "pending",
  taxPercentage: user.taxPercentage,
  socialLinks: user.socialLinks || {},
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const getUserOrThrow = async (userId, withPassword = false) => {
  if (!isValidObjectId(userId)) {
    throw new AppError("Invalid userId", 400);
  }

  const query = User.findById(userId);

  if (withPassword) {
    query.select("+password");
  }

  const user = await query;

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

const getProfileImageFromKyc = async (userId) => {
  const kyc = await Kyc.findOne({ user: userId })
    .select("faceVerification.facePhoto")
    .lean();

  return normalizeText(kyc?.faceVerification?.facePhoto);
};

const assertSuperadmin = (authUser) => {
  if (!authUser?.userId) {
    throw new AppError("Unauthorized", 401);
  }

  if (authUser.role !== "superadmin") {
    throw new AppError("Forbidden: only superadmin can access this profile", 403);
  }
};

const assertAuthenticatedUser = (authUser) => {
  if (!authUser?.userId) {
    throw new AppError("Unauthorized", 401);
  }
};

export const getSuperadminProfile = async (authUser) => {
  assertSuperadmin(authUser);

  if (!isValidObjectId(authUser.userId)) {
    throw new AppError("Invalid userId", 400);
  }

  const user = await User.findById(authUser.userId)
    .select(profileProjection)
    .lean();

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return buildProfileResponse(user);
};

export const getMyProfile = async (authUser) => {
  assertAuthenticatedUser(authUser);
  const user = await getUserOrThrow(authUser.userId);
  const profileImage =
    normalizeText(user.profileImage) || (await getProfileImageFromKyc(authUser.userId));
  return buildProfileResponse(user, profileImage);
};

export const updateMyProfile = async (authUser, payload = {}) => {
  assertAuthenticatedUser(authUser);

  if (typeof payload.email !== "undefined" || typeof payload.role !== "undefined") {
    throw new AppError("email and role cannot be changed from this API", 400);
  }

  const user = await getUserOrThrow(authUser.userId);

  if (typeof payload.name !== "undefined") {
    const name = normalizeText(payload.name);

    if (!name) {
      throw new AppError("name is required", 400);
    }

    user.name = name;
  }

  if (typeof payload.mobile !== "undefined" || typeof payload.phone !== "undefined") {
    user.mobile = normalizeText(payload.mobile ?? payload.phone);
  }

  await user.save();

  return buildProfileResponse(user);
};

export const updateSuperadminProfile = async (authUser, payload) => {
  assertSuperadmin(authUser);
  const user = await getUserOrThrow(authUser.userId, true);

  if (typeof payload.name !== "undefined") {
    const name = normalizeText(payload.name);

    if (!name) {
      throw new AppError("name is required", 400);
    }

    user.name = name;
  }

  if (typeof payload.email !== "undefined") {
    const email = normalizeEmail(payload.email);

    if (!email) {
      throw new AppError("email is required", 400);
    }

    const existingUser = await User.findOne({ email, _id: { $ne: user._id } });

    if (existingUser) {
      throw new AppError("User already exists with this email", 409);
    }

    user.email = email;
  }

  if (typeof payload.mobile !== "undefined") {
    user.mobile = normalizeText(payload.mobile);
  }

  if (typeof payload.profileImage === "string") {
    user.profileImage = normalizeText(payload.profileImage);
  }

  if (typeof payload.taxPercentage !== "undefined") {
    user.taxPercentage = normalizeTaxPercentage(payload.taxPercentage);
  }

  if (typeof payload.socialLinks !== "undefined") {
    user.socialLinks = normalizeSocialLinks(payload.socialLinks);
  }

  const currentPassword = typeof payload.currentPassword === "string" ? payload.currentPassword : "";
  const newPassword = typeof payload.newPassword === "string" ? payload.newPassword : "";

  if (currentPassword || newPassword) {
    if (!currentPassword || !newPassword) {
      throw new AppError("currentPassword and newPassword are required together", 400);
    }

    if (newPassword.length < 6) {
      throw new AppError("newPassword must be at least 6 characters", 400);
    }

    const isPasswordMatched = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordMatched) {
      throw new AppError("Current password is incorrect", 400);
    }

    user.password = await bcrypt.hash(newPassword, 10);
  }

  await user.save();

  return buildProfileResponse(await getUserOrThrow(user._id));
};
