import express from "express";
import * as legalContentController from "../controllers/legalContent.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", legalContentController.getAllLegalContents);
router.get("/type/:type", legalContentController.getLegalContentByType);
router.get("/:contentId", legalContentController.getLegalContentById);

router.use(authenticate, authorize("superadmin"));

router.post("/", legalContentController.createLegalContent);
router.patch("/:contentId", legalContentController.updateLegalContent);
router.delete("/:contentId", legalContentController.deleteLegalContent);

export default router;
