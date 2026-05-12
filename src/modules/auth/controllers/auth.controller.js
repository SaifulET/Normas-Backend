import * as authService from "../services/auth.service.js";

const signup = async (req, res, next) => {
  try {
    const result = await authService.signup(req.body);

    res.status(201).json({
      success: true,
      message: "User registered and logged in successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const signin = async (req, res, next) => {
  try {
    const result = await authService.signin(req.body);

    res.status(200).json({
      success: true,
      message: "User logged in successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const result = await authService.refreshAccessToken(req.body);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const result = await authService.logout(req.user);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const resendPasswordOtp = async (req, res, next) => {
  try {
    const result = await authService.resendPasswordOtp(req.body);

    res.status(200).json({
      success: true,
      message: "OTP resent successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const verifyPasswordOtp = async (req, res, next) => {
  try {
    const result = await authService.verifyPasswordOtp(req.body);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const setNewPassword = async (req, res, next) => {
  try {
    const result = await authService.setNewPassword(req.body);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  signup,
  signin,
  refreshToken,
  logout,
  forgotPassword,
  resendPasswordOtp,
  verifyPasswordOtp,
  setNewPassword,
};
