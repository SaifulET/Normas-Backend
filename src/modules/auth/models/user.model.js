import mongoose from "mongoose";

const socialLinksSchema = new mongoose.Schema(
  {
    whatsapp: {
      type: String,
      trim: true,
      default: "",
    },
    facebook: {
      type: String,
      trim: true,
      default: "",
    },
    instagram: {
      type: String,
      trim: true,
      default: "",
    },
    youtube: {
      type: String,
      trim: true,
      default: "",
    },
    x: {
      type: String,
      trim: true,
      default: "",
    },
    tiktok: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["investor", "investee", "superadmin"],
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobile: {
      type: String,
      trim: true,
      default: "",
    },
    profileImage: {
      type: String,
      trim: true,
      default: "",
    },
    taxPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    stripeCustomerId: {
      type: String,
      trim: true,
      default: "",
    },
    stripeDefaultPaymentMethodId: {
      type: String,
      trim: true,
      default: "",
    },
    socialLinks: {
      type: socialLinksSchema,
      default: () => ({}),
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetOtp: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetOtpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    passwordResetOtpVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;
