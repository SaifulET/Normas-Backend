import * as profileService from "../services/profile.service.js";

export const getSuperadminProfile = async (req, res, next) => {
  try {
    const result = await profileService.getSuperadminProfile(req.user);

    res.status(200).json({
      success: true,
      message: "Superadmin profile fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSuperadminProfile = async (req, res, next) => {
  try {
    const result = await profileService.updateSuperadminProfile(req.user, req.body);

    res.status(200).json({
      success: true,
      message: "Superadmin profile updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
