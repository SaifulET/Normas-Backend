import express from "express";
import * as kycController from "../controllers/kyc.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { handleKycFileUpload } from "../../../middlewares/kycUpload.middleware.js";
import {
  ensureKycCanBeEdited,
  ensureKycDoesNotExistForUser,
} from "../../../middlewares/kycPrecheck.middleware.js";

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  authorize("investor", "investee"),
  ensureKycDoesNotExistForUser,
  handleKycFileUpload,
  kycController.createKyc
);
router.get("/", authorize("superadmin"), kycController.getAllKyc);
router.get(
  "/user/details",
  authorize("investor", "investee", "superadmin"),
  kycController.getMyDetailsWithKyc
);
router.get("/me", authorize("investor", "investee", "superadmin"), kycController.getMyKyc);
router.get("/:kycId", authorize("investor", "investee", "superadmin"), kycController.getKycById);
router.patch(
  "/:kycId",
  authorize("investor", "investee", "superadmin"),
  ensureKycCanBeEdited,
  handleKycFileUpload,
  kycController.updateKyc
);
router.delete("/:kycId", authorize("investor", "investee", "superadmin"), kycController.deleteKyc);

export default router;
