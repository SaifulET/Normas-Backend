import mongoose from "mongoose";

export const noticeTargetTypes = ["investor", "investee", "all"];
export const noticeStatuses = ["processing", "published", "partially_failed", "archived"];

const noticeImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const noticeEmailStatsSchema = new mongoose.Schema(
  {
    pending: {
      type: Number,
      default: 0,
      min: 0,
    },
    queued: {
      type: Number,
      default: 0,
      min: 0,
    },
    sent: {
      type: Number,
      default: 0,
      min: 0,
    },
    failed: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const noticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50000,
    },
    targetType: {
      type: String,
      enum: noticeTargetTypes,
      required: true,
      index: true,
    },
    image: {
      type: noticeImageSchema,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: noticeStatuses,
      default: "processing",
      index: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    emailStats: {
      type: noticeEmailStatsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

noticeSchema.index({ targetType: 1, status: 1, publishedAt: -1 });
noticeSchema.index({ createdBy: 1, publishedAt: -1 });

const Notice = mongoose.model("Notice", noticeSchema);

export default Notice;
