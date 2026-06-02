import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import AppError from "../../../utils/appError.js";
import { notifyUserRegistered } from "../../notification/services/notification.service.js";
import User from "../models/user.model.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: String(process.env.SMTP_SECURE) === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const validateSignupPayload = ({ name, role, email, password }) => {
  if (!name || !role || !email || !password) {
    throw new AppError("Name, role, email and password are required", 400);
  }
};

const validateSigninPayload = ({ email, password }) => {
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }
};

const generateAccessToken = (user) =>
  jwt.sign(
    { userId: user._id },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m" }
  );

const generateRefreshToken = (user) =>
  jwt.sign(
    { userId: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d" }
  );

const serializeAuthUser = (user) => ({
  id: user._id.toString(),
  _id: user._id.toString(),
  name: user.name,
  role: user.role,
  email: user.email,
  mobile: user.mobile || "",
  profileImage: user.profileImage || "",
  accountStatus: user.accountStatus || "pending",
  taxPercentage: user.taxPercentage ?? 0,
  socialLinks: user.socialLinks || {},
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const buildAuthResponse = (user, accessToken, refreshToken) => ({
  user: serializeAuthUser(user),
  accessToken,
  refreshToken,
});

const sendOtpEmail = async (email, otp, name) => {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: "Password Reset OTP",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>Your password reset OTP is:</p>
        <h1 style="letter-spacing: 8px;">${otp}</h1>
        <p>This OTP will expire in ${process.env.OTP_EXPIRES_IN_MINUTES || 10} minutes.</p>
      </div>
    `,
  });
};

export const signup = async ({ name, role, email, password }) => {
  validateSignupPayload({ name, role, email, password });

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    throw new AppError("User already exists with this email", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    role,
    email: normalizedEmail,
    password: hashedPassword,
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  await user.save();
  await notifyUserRegistered(user);

  return buildAuthResponse(user, accessToken, refreshToken);
};

export const signin = async ({ email, password }) => {
  validateSigninPayload({ email, password });

  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail }).select("+password +refreshToken");

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);

  if (!isPasswordMatched) {
    throw new AppError("Invalid email or password", 401);
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  await user.save();

  return buildAuthResponse(user, accessToken, refreshToken);
};

export const refreshAccessToken = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new AppError("Refresh token is required", 400);
  }

  let decoded;

  try {
    decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (_error) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const user = await User.findById(decoded.userId).select("+refreshToken");

  if (!user || user.refreshToken !== refreshToken) {
    throw new AppError("Refresh token does not match", 401);
  }

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  user.refreshToken = newRefreshToken;
  await user.save();

  return buildAuthResponse(user, newAccessToken, newRefreshToken);
};

export const logout = async (authUser) => {
  const user = await User.findById(authUser.userId).select("+refreshToken");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  user.refreshToken = null;
  await user.save();

  return {
    message: "Logout successful",
  };
};

export const forgotPassword = async ({ email }) => {
  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail }).select(
    "+passwordResetOtp +passwordResetOtpExpiresAt"
  );

  if (!user) {
    throw new AppError("User not found with this email", 404);
  }

  const otp = generateOtp();
  const expiresInMinutes = Number(process.env.OTP_EXPIRES_IN_MINUTES || 10);

  user.passwordResetOtp = otp;
  user.passwordResetOtpExpiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  user.passwordResetOtpVerified = false;
  await user.save();

  await sendOtpEmail(user.email, otp, user.name);

  return {
    message: "OTP sent successfully to your email",
    email: user.email,
  };
};

export const resendPasswordOtp = async ({ email }) => {
  return forgotPassword({ email });
};

export const verifyPasswordOtp = async ({ email, otp }) => {
  if (!email || !otp) {
    throw new AppError("Email and OTP are required", 400);
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedOtp = String(otp).trim();

  if (!/^\d{4}$/.test(normalizedOtp)) {
    throw new AppError("OTP must be a 4 digit number", 400);
  }

  const user = await User.findOne({ email: normalizedEmail }).select(
    "+passwordResetOtp +passwordResetOtpExpiresAt"
  );

  if (!user) {
    throw new AppError("User not found with this email", 404);
  }

  if (!user.passwordResetOtp || !user.passwordResetOtpExpiresAt) {
    throw new AppError("Please request a new OTP", 400);
  }

  if (user.passwordResetOtpExpiresAt.getTime() < Date.now()) {
    throw new AppError("OTP has expired", 400);
  }

  if (user.passwordResetOtp !== normalizedOtp) {
    throw new AppError("Invalid OTP", 400);
  }

  user.passwordResetOtpVerified = true;
  await user.save();

  return {
    message: "OTP verified successfully",
    email: user.email,
  };
};

export const setNewPassword = async ({ email, password }) => {
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail }).select(
    "+password +passwordResetOtp +passwordResetOtpExpiresAt"
  );

  if (!user) {
    throw new AppError("User not found with this email", 404);
  }

  if (!user.passwordResetOtpVerified) {
    throw new AppError("OTP verification required before setting new password", 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  user.password = hashedPassword;
  user.passwordResetOtp = null;
  user.passwordResetOtpExpiresAt = null;
  user.passwordResetOtpVerified = false;
  user.refreshToken = null;
  await user.save();

  return {
    message: "Password updated successfully",
  };
};
