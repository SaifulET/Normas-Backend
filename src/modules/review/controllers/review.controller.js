import * as reviewService from "../services/review.service.js";

export const createReview = async (req, res, next) => {
  try {
    const result = await reviewService.createReview(req.body);

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateReview = async (req, res, next) => {
  try {
    const result = await reviewService.updateReview(req.params.reviewId, req.body);

    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicReviews = async (req, res, next) => {
  try {
    const result = await reviewService.getPublicReviews(req.query);

    res.status(200).json({
      success: true,
      message: "Reviews fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllReviews = async (_req, res, next) => {
  try {
    const result = await reviewService.getAllReviews();

    res.status(200).json({
      success: true,
      message: "Reviews fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getReviewById = async (req, res, next) => {
  try {
    const result = await reviewService.getReviewById(req.params.reviewId);

    res.status(200).json({
      success: true,
      message: "Review fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const result = await reviewService.deleteReview(req.params.reviewId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
