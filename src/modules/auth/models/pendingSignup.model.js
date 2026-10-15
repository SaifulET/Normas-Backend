import mongoose from "mongoose";

const pendingSignupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["investor", "investee"],
      required: true,
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
    otpHash: {
      type: String,
      required: true,
      select: false,
    },
    otpExpiresAt: {
      type: Date,
      required: true,
      select: false,
    },
    verificationAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

pendingSignupSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 0 });

const PendingSignup = mongoose.model("PendingSignup", pendingSignupSchema);

export default PendingSignup;
