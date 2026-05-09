import mongoose from "mongoose";

export const supportStatuses = ["pending", "dismissed", "resolved"];
export const supportSenderTypes = ["guest", "user", "superadmin"];
export const supportMessageStatuses = ["sent", "seen"];

const supportMessageSchema = new mongoose.Schema(
  {
    senderType: {
      type: String,
      enum: supportSenderTypes,
      required: true,
    },
    senderUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    senderName: {
      type: String,
      trim: true,
      default: "",
    },
    senderEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    messageStatus: {
      type: String,
      enum: supportMessageStatuses,
      default: "sent",
    },
    seenAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
  }
);

const supportConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    guestName: {
      type: String,
      trim: true,
      default: "",
    },
    guestEmail: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
    },
    subject: {
      type: String,
      trim: true,
      required: true,
      maxlength: 200,
    },
    status: {
      type: String,
      enum: supportStatuses,
      default: "pending",
    },
    guestAccessToken: {
      type: String,
      required: true,
      select: false,
    },
    messages: {
      type: [supportMessageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const SupportConversation = mongoose.model("SupportConversation", supportConversationSchema);

export default SupportConversation;
