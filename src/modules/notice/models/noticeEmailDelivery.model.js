import mongoose from "mongoose";

export const noticeEmailDeliveryStatuses = ["pending", "queued", "sent", "failed"];

const noticeEmailDeliverySchema = new mongoose.Schema(
  {
    notice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notice",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    jobId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    status: {
      type: String,
      enum: noticeEmailDeliveryStatuses,
      default: "pending",
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    queuedAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      trim: true,
      default: "",
    },
    providerMessageId: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

noticeEmailDeliverySchema.index({ notice: 1, user: 1 }, { unique: true });
noticeEmailDeliverySchema.index({ notice: 1, status: 1 });

const NoticeEmailDelivery = mongoose.model("NoticeEmailDelivery", noticeEmailDeliverySchema);

export default NoticeEmailDelivery;
