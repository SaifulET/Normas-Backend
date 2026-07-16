import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },
    role: {
      type: String,
      trim: true,
      default: "",
    },
    quote: {
      type: String,
      trim: true,
      default: "",
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    avatarImage: {
      type: String,
      trim: true,
      default: "",
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ isVisible: 1, sortOrder: 1, createdAt: -1 });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
