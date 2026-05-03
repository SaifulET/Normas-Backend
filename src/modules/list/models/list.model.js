import mongoose from "mongoose";

const additionalDetailSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      trim: true,
      default: "",
    },
    value: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const listSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bannerImage: {
      type: String,
      trim: true,
      default: null,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      default: "",
    },
    stage: {
      type: String,
      trim: true,
      default: "",
    },
    sector: {
      type: String,
      trim: true,
      default: "",
    },
    fundingTarget: {
      type: Number,
      default: 0,
    },
    keyword: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    additionalDetails: {
      type: [additionalDetailSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["activated", "deactivated", "suspended"],
      default: "deactivated",
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const List = mongoose.model("List", listSchema);

export default List;
