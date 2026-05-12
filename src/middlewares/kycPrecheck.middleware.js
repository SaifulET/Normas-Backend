import mongoose from "mongoose";
import Kyc from "../modules/kyc/models/kyc.model.js";
import AppError from "../utils/appError.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export const ensureKycDoesNotExistForUser = async (req, _res, next) => {
  try {
    const existingKyc = await Kyc.findOne({ user: req.user.userId }).select("_id").lean();

    if (existingKyc) {
      throw new AppError("KYC already exists for this user", 409);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const ensureKycCanBeEdited = async (req, _res, next) => {
  try {
    const { kycId } = req.params;

    if (!isValidObjectId(kycId)) {
      throw new AppError("Invalid kycId", 400);
    }

    const kyc = await Kyc.findById(kycId).select("user").lean();

    if (!kyc) {
      throw new AppError("KYC not found", 404);
    }

    const isOwner = kyc.user.toString() === req.user.userId;
    const isSuperadmin = req.user.role === "superadmin";

    if (!isOwner && !isSuperadmin) {
      throw new AppError("Forbidden: you can only update your own KYC", 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};
