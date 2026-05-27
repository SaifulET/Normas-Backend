import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvestmentConversation",
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    dateTime: {
      type: Date,
      required: true,
    },
    timeZone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
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
  },
  {
    timestamps: true,
  }
);

scheduleSchema.index({ investor: 1, dateTime: 1 });
scheduleSchema.index({ investee: 1, dateTime: 1 });
scheduleSchema.index({ conversation: 1, dateTime: 1 });
scheduleSchema.index({ dateTime: 1 });

const Schedule = mongoose.model("Schedule", scheduleSchema);

export default Schedule;
