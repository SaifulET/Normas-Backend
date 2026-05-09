import mongoose from "mongoose";

export const meetingRequestStatuses = ["pending", "accepted", "rejected", "cancelled"];

const meetingRequestSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvestmentConversation",
      required: true,
    },
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
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestedByRole: {
      type: String,
      enum: ["investor", "investee", "superadmin"],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    note: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    locationDetails: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },
    timeZone: {
      type: String,
      trim: true,
      default: "UTC",
      maxlength: 120,
    },
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: meetingRequestStatuses,
      default: "pending",
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    responseNote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

meetingRequestSchema.index({ conversation: 1, startsAt: 1 });
meetingRequestSchema.index({ investor: 1, startsAt: 1 });
meetingRequestSchema.index({ investee: 1, startsAt: 1 });
meetingRequestSchema.index({ status: 1, startsAt: 1 });

const MeetingRequest = mongoose.model("MeetingRequest", meetingRequestSchema);

export default MeetingRequest;
