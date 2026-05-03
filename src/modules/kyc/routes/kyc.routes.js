import express from "express";
import * as kycController from "../controllers/kyc.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { handleKycImageUpload } from "../../../middlewares/kycUpload.middleware.js";

const router = express.Router();

router.use(authenticate);

router.post("/", authorize("investor", "investee"), handleKycImageUpload, kycController.createKyc);
router.get("/", authorize("superadmin"), kycController.getAllKyc);
router.get("/me", authorize("investor", "investee", "superadmin"), kycController.getMyKyc);
router.get("/:kycId", authorize("investor", "investee", "superadmin"), kycController.getKycById);
router.patch(
  "/:kycId",
  authorize("investor", "investee", "superadmin"),
  handleKycImageUpload,
  kycController.updateKyc
);
router.delete("/:kycId", authorize("investor", "investee", "superadmin"), kycController.deleteKyc);

export default router;
