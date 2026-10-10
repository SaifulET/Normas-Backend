import mongoose from "mongoose";

const pendingSuperadminSignupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    otp: {
      type: String,
      required: true,
      select: false,
    },
    otpExpiresAt: {
      type: Date,
      required: true,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

pendingSuperadminSignupSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 0 });

const PendingSuperadminSignup = mongoose.model("PendingSuperadminSignup", pendingSuperadminSignupSchema);

export default PendingSuperadminSignup;
