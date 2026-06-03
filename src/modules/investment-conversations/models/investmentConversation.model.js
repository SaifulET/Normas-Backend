import mongoose from "mongoose";

export const investmentConversationStatuses = ["pending", "active"];

const messageSeenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    seenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const investmentConversationMessageSchema = new mongoose.Schema(
  {
    senderUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["investor", "investee", "superadmin"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    moderationStatus: {
      type: String,
      enum: ["approved", "restricted"],
      default: "approved",
    },
    moderationReasons: {
      type: [String],
      default: [],
    },
    moderationHiddenFrom: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    seenBy: {
      type: [messageSeenSchema],
      default: [],
    },
  },
  { _id: true }
);

const investmentConversationSchema = new mongoose.Schema(
  {
    list: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "List",
      required: true,
    },
    investor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    investee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messages: {
      type: [investmentConversationMessageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: investmentConversationStatuses,
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

investmentConversationSchema.index({ list: 1, investor: 1, investee: 1 }, { unique: true });
investmentConversationSchema.index({ investor: 1, lastMessageAt: -1 });
investmentConversationSchema.index({ investee: 1, lastMessageAt: -1 });
investmentConversationSchema.index({ status: 1, lastMessageAt: -1 });

const InvestmentConversation = mongoose.model(
  "InvestmentConversation",
  investmentConversationSchema
);

export default InvestmentConversation;
