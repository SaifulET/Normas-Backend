import mongoose from "mongoose";

export const notificationTypes = [
  "schedule_created",
  "schedule_starting_soon",
  "schedule_due",
  "payment_created",
  "user_registered",
  "report_created",
  "report_action",
  "pitch_suspended",
  "pitch_restored",
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: notificationTypes,
      required: true,
      index: true,
    },
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
      maxlength: 500,
    },
    referenceType: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
    dedupeKey: {
      type: String,
      trim: true,
      default: undefined,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index(
  { dedupeKey: 1 },
  {
    unique: true,
    sparse: true,
  }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
