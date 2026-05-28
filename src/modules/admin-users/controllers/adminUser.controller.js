import * as adminUserService from "../services/adminUser.service.js";

export const getAdminUsers = async (req, res, next) => {
  try {
    const result = await adminUserService.getAdminUsers(req.query);

    res.status(200).json({
      success: true,
      message: "Admin users fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminUserDetails = async (req, res, next) => {
  try {
    const result = await adminUserService.getAdminUserDetails(req.params.userId);

    res.status(200).json({
      success: true,
      message: "Admin user details fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminUserProfile = async (req, res, next) => {
  try {
    const result = await adminUserService.getAdminUserProfile(req.params.userId);

    res.status(200).json({
      success: true,
      message: "Admin user profile fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminUserKyc = async (req, res, next) => {
  try {
    const result = await adminUserService.getAdminUserKyc(req.params.userId);

    res.status(200).json({
      success: true,
      message: "Admin user KYC fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminUserPitches = async (req, res, next) => {
  try {
    const result = await adminUserService.getAdminUserPitches(req.params.userId);

    res.status(200).json({
      success: true,
      message: "Admin user pitches fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminUserAccountStatus = async (req, res, next) => {
  try {
    const result = await adminUserService.updateAdminUserAccountStatus(
      req.params.userId,
      req.body.accountStatus || req.body.status
    );

    res.status(200).json({
      success: true,
      message: "Admin user account status updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
