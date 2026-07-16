import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import Review from "../models/review.model.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const getReviewOrThrow = async (reviewId) => {
  if (!isValidObjectId(reviewId)) {
    throw new AppError("Invalid reviewId", 400);
  }

  const review = await Review.findById(reviewId);

  if (!review) {
    throw new AppError("Review not found", 404);
  }

  return review;
};

const clampRating = (rating) => {
  const numericRating = Number(rating);

  if (!Number.isFinite(numericRating)) {
    return 5;
  }

  return Math.min(5, Math.max(1, Math.round(numericRating)));
};

const buildReviewPayload = (payload = {}) => ({
  avatarImage: payload.avatarImage || "",
  isVisible: typeof payload.isVisible === "boolean" ? payload.isVisible : true,
  name: payload.name || "",
  quote: payload.quote || "",
  rating: clampRating(payload.rating),
  role: payload.role || "",
  sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0,
});

const getPublicLimit = (query = {}) => {
  const requestedLimit = Number(query.limit);

  if (!Number.isFinite(requestedLimit)) {
    return 6;
  }

  return Math.min(24, Math.max(1, Math.round(requestedLimit)));
};

export const createReview = async (payload) => {
  const review = await Review.create(buildReviewPayload(payload));
  return Review.findById(review._id);
};

export const updateReview = async (reviewId, payload) => {
  const review = await getReviewOrThrow(reviewId);

  if (typeof payload.name !== "undefined") {
    review.name = payload.name;
  }

  if (typeof payload.role !== "undefined") {
    review.role = payload.role;
  }

  if (typeof payload.quote !== "undefined") {
    review.quote = payload.quote;
  }

  if (typeof payload.rating !== "undefined") {
    review.rating = clampRating(payload.rating);
  }

  if (typeof payload.avatarImage !== "undefined") {
    review.avatarImage = payload.avatarImage;
  }

  if (typeof payload.isVisible !== "undefined") {
    review.isVisible = Boolean(payload.isVisible);
  }

  if (typeof payload.sortOrder !== "undefined") {
    review.sortOrder = Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : review.sortOrder;
  }

  await review.save();

  return Review.findById(review._id);
};

export const getPublicReviews = async (query = {}) => {
  return Review.find({
    isVisible: true,
    name: { $ne: "" },
    quote: { $ne: "" },
  })
    .sort({ sortOrder: 1, createdAt: -1 })
    .limit(getPublicLimit(query));
};

export const getAllReviews = async () => {
  return Review.find().sort({ sortOrder: 1, createdAt: -1 });
};

export const getReviewById = async (reviewId) => {
  const review = await getReviewOrThrow(reviewId);
  return Review.findById(review._id);
};

export const deleteReview = async (reviewId) => {
  const review = await getReviewOrThrow(reviewId);

  await Review.findByIdAndDelete(reviewId);

  return {
    id: review._id,
    message: "Review deleted successfully",
  };
};
