import mongoose from "mongoose";

export const moderationAlertTypes = [
  "chat_contact_details",
  "post_irrelevant",
  "post_misleading",
  "post_title_description_mismatch",
  "post_contact_or_location",
  "post_manual_review",
];

export const moderationAlertStatuses = ["pending", "reviewed"];

const moderationActionSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const moderationAlertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: moderationAlertTypes,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: moderationAlertStatuses,
      default: "pending",
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvestmentConversation",
      default: null,
      index: true,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    list: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "List",
      default: null,
      index: true,
    },
    message: {
      type: String,
      trim: true,
      default: "",
      maxlength: 4000,
    },
    detectedReasons: {
      type: [String],
      default: [],
    },
    decision: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    actions: {
      type: [moderationActionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

moderationAlertSchema.index({ status: 1, createdAt: -1 });
moderationAlertSchema.index({ list: 1, type: 1, status: 1 });
moderationAlertSchema.index({ conversation: 1, messageId: 1 });

const ModerationAlert = mongoose.model("ModerationAlert", moderationAlertSchema);

export default ModerationAlert;
