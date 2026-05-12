import mongoose from "mongoose";
import Kyc from "../models/kyc.model.js";
import User from "../../auth/models/user.model.js";
import AppError from "../../../utils/appError.js";

const allowedApplicantRoles = ["investor", "investee"];
const allowedStatuses = ["draft", "pending", "approved", "rejected"];

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const validateCreatePayload = (payload) => {
  const { currentStep } = payload;

  if (currentStep && ![1, 2, 3, 4].includes(Number(currentStep))) {
    throw new AppError("currentStep must be between 1 and 4", 400);
  }
};

const validateFileUrlsOnUpdate = (payload) => {
  const fileFields = [
    ["personalIdentity", "identityDocument"],
    ["addressVerification", "utilityBill"],
    ["addressVerification", "bankStatement"],
    ["faceVerification", "facePhoto"],
    ["faceVerification", "verificationVideo"],
    ["sourceOfFunds", "salarySlip"],
    ["sourceOfFunds", "businessDocument"],
    ["sourceOfFunds", "taxReturns"],
  ];

  for (const [section, field] of fileFields) {
    if (
      Object.prototype.hasOwnProperty.call(payload?.[section] || {}, field) &&
      typeof payload[section][field] !== "string"
    ) {
      throw new AppError(`${section}.${field} must be a file URL`, 400);
    }
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

const buildUserDetailsResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  mobile: user.mobile,
  profileImage: user.profileImage,
  taxPercentage: user.taxPercentage,
  socialLinks: user.socialLinks || {},
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const createKyc = async (authUser, payload) => {
  validateCreatePayload(payload);

  const user = await getUserOrThrow(authUser.userId);

  if (!allowedApplicantRoles.includes(user.role)) {
    throw new AppError("KYC is only available for investor and investee users", 400);
  }

  const existingKyc = await Kyc.findOne({ user: user._id });

  if (existingKyc) {
    throw new AppError("KYC already exists for this user", 409);
  }

  const kyc = await Kyc.create({
    user: user._id,
    role: user.role,
    currentStep: payload.currentStep || 4,
    status: payload.status && allowedStatuses.includes(payload.status) ? payload.status : "pending",
    personalIdentity: payload.personalIdentity,
    addressVerification: payload.addressVerification,
    faceVerification: payload.faceVerification,
    sourceOfFunds: payload.sourceOfFunds,
  });

  return Kyc.findById(kyc._id).populate("user", "name email role");
};

export const getAllKyc = async () => {
  return Kyc.find()
    .populate("user", "name email role")
    .populate("approval.reviewedBy", "name email role")
    .sort({ createdAt: -1 });
};

export const getKycById = async (authUser, kycId) => {
  if (!isValidObjectId(kycId)) {
    throw new AppError("Invalid kycId", 400);
  }

  const kyc = await Kyc.findById(kycId)
    .populate("user", "name email role")
    .populate("approval.reviewedBy", "name email role");

  if (!kyc) {
    throw new AppError("KYC not found", 404);
  }

  if (authUser.role !== "superadmin" && kyc.user._id.toString() !== authUser.userId) {
    throw new AppError("Forbidden: you can only access your own KYC", 403);
  }

  return kyc;
};

export const getMyKyc = async (authUser) => {
  await getUserOrThrow(authUser.userId);

  const kyc = await Kyc.findOne({ user: authUser.userId })
    .populate("user", "name email role")
    .populate("approval.reviewedBy", "name email role");

  if (!kyc) {
    throw new AppError("KYC not found for this user", 404);
  }

  return kyc;
};

export const getMyDetailsWithKyc = async (authUser) => {
  const user = await getUserOrThrow(authUser.userId);

  const kyc = await Kyc.find({ user: authUser.userId })
    .populate("approval.reviewedBy", "name email role")
    .sort({ createdAt: -1 });

  return {
    user: buildUserDetailsResponse(user),
    kyc,
  };
};

export const updateKyc = async (authUser, kycId, payload) => {
  if (!isValidObjectId(kycId)) {
    throw new AppError("Invalid kycId", 400);
  }

  validateFileUrlsOnUpdate(payload);

  const kyc = await Kyc.findById(kycId);

  if (!kyc) {
    throw new AppError("KYC not found", 404);
  }

  const isOwner = kyc.user.toString() === authUser.userId;
  const isSuperadmin = authUser.role === "superadmin";

  if (!isOwner && !isSuperadmin) {
    throw new AppError("Forbidden: you can only update your own KYC", 403);
  }

  if (payload.currentStep) {
    if (![1, 2, 3, 4].includes(Number(payload.currentStep))) {
      throw new AppError("currentStep must be between 1 and 4", 400);
    }
    kyc.currentStep = Number(payload.currentStep);
  }

  if (payload.status) {
    if (!isSuperadmin) {
      throw new AppError("Only superadmin can update KYC status", 403);
    }

    if (!allowedStatuses.includes(payload.status)) {
      throw new AppError("Invalid status", 400);
    }
    kyc.status = payload.status;
  }

  if (payload.personalIdentity) {
    kyc.personalIdentity = {
      ...kyc.personalIdentity.toObject(),
      ...payload.personalIdentity,
    };
  }

  if (payload.addressVerification) {
    kyc.addressVerification = {
      ...kyc.addressVerification.toObject(),
      ...payload.addressVerification,
    };
  }

  if (payload.faceVerification) {
    kyc.faceVerification = {
      ...kyc.faceVerification.toObject(),
      ...payload.faceVerification,
    };
  }

  if (payload.sourceOfFunds) {
    kyc.sourceOfFunds = {
      ...kyc.sourceOfFunds.toObject(),
      ...payload.sourceOfFunds,
    };
  }

  if (payload.approval) {
    if (!isSuperadmin) {
      throw new AppError("Only superadmin can review KYC", 403);
    }

    const { rejectionReason } = payload.approval;

    kyc.approval.reviewedBy = authUser.userId;
    kyc.approval.reviewedAt = new Date();

    if (typeof rejectionReason !== "undefined") {
      kyc.approval.rejectionReason = rejectionReason || null;
    }
  }

  await kyc.save();

  return Kyc.findById(kyc._id)
    .populate("user", "name email role")
    .populate("approval.reviewedBy", "name email role");
};

export const deleteKyc = async (kycId) => {
  if (!isValidObjectId(kycId)) {
    throw new AppError("Invalid kycId", 400);
  }

  const kyc = await Kyc.findByIdAndDelete(kycId);

  if (!kyc) {
    throw new AppError("KYC not found", 404);
  }

  return {
    id: kyc._id,
    message: "KYC deleted successfully",
  };
};

export const deleteKycByUser = async (authUser, kycId) => {
  if (!isValidObjectId(kycId)) {
    throw new AppError("Invalid kycId", 400);
  }

  const kyc = await Kyc.findById(kycId);

  if (!kyc) {
    throw new AppError("KYC not found", 404);
  }

  const isOwner = kyc.user.toString() === authUser.userId;
  const isSuperadmin = authUser.role === "superadmin";

  if (!isOwner && !isSuperadmin) {
    throw new AppError("Forbidden: you can only delete your own KYC", 403);
  }

  await Kyc.findByIdAndDelete(kycId);

  return {
    id: kyc._id,
    message: "KYC deleted successfully",
  };
};
