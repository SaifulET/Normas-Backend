import express from "express";
import * as faqController from "../controllers/faq.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", faqController.getAllFaqs);
router.get("/:faqId", faqController.getFaqById);

router.use(authenticate, authorize("superadmin"));

router.post("/", faqController.createFaq);
router.patch("/:faqId", faqController.updateFaq);
router.delete("/:faqId", faqController.deleteFaq);

export default router;
