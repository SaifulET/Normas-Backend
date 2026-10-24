import mongoose from "mongoose";

const blockedIpSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    reason: {
      type: String,
      trim: true,
      default: "Exceeded 7 support messages",
    },
    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    blockedAt: {
      type: Date,
      default: Date.now,
    },
    lastRequestAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["blocked", "unblocked"],
      default: "blocked",
      index: true,
    },
    unblockedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const BlockedIp = mongoose.model("BlockedIp", blockedIpSchema);

export default BlockedIp;
