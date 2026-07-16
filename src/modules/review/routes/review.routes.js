import express from "express";
import * as reviewController from "../controllers/review.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", reviewController.getPublicReviews);

router.use(authenticate, authorize("superadmin"));

router.get("/admin", reviewController.getAllReviews);
router.get("/admin/:reviewId", reviewController.getReviewById);
router.post("/admin", reviewController.createReview);
router.patch("/admin/:reviewId", reviewController.updateReview);
router.delete("/admin/:reviewId", reviewController.deleteReview);

export default router;
