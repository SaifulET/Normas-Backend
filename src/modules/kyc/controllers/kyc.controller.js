import * as kycService from "../services/kyc.service.js";

export const createKyc = async (req, res, next) => {
  try {
    const result = await kycService.createKyc(req.user, req.body);

    res.status(201).json({
      success: true,
      message: "KYC submitted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllKyc = async (_req, res, next) => {
  try {
    const result = await kycService.getAllKyc();

    res.status(200).json({
      success: true,
      message: "KYC list fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getKycById = async (req, res, next) => {
  try {
    const result = await kycService.getKycById(req.user, req.params.kycId);

    res.status(200).json({
      success: true,
      message: "KYC fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyKyc = async (req, res, next) => {
  try {
    const result = await kycService.getMyKyc(req.user);

    res.status(200).json({
      success: true,
      message: "User KYC fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateKyc = async (req, res, next) => {
  try {
    const result = await kycService.updateKyc(req.user, req.params.kycId, req.body);

    res.status(200).json({
      success: true,
      message: "KYC updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteKyc = async (req, res, next) => {
  try {
    const result = await kycService.deleteKycByUser(req.user, req.params.kycId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
