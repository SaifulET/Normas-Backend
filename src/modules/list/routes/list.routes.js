import express from "express";
import * as listController from "../controllers/list.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { optionalAuthenticate } from "../../../middlewares/optionalAuth.middleware.js";
import { handleListImageUpload } from "../../../middlewares/listUpload.middleware.js";

const router = express.Router();

router.get("/", listController.getAllLists);
router.get("/filter", listController.getFilteredLists);
router.get("/sectors", listController.getSectorListCounts);
router.get("/related/:id", listController.getRelatedLists);
router.get("/admin/review", authenticate, authorize("superadmin"), listController.getAdminReviewLists);
router.get("/admin/review/:listId", authenticate, authorize("superadmin"), listController.getAdminReviewListById);
router.get("/user/me", authenticate, authorize("investor", "investee", "superadmin"), listController.getMyLists);
router.get("/saved/me", authenticate, authorize("investor"), listController.getMySavedLists);
router.get("/saved/:listId/status", authenticate, authorize("investor"), listController.getInvestorSavedListStatus);
router.post("/save", authenticate, authorize("investor"), listController.saveInvestorList);
router.delete("/saved/:listId", authenticate, authorize("investor"), listController.removeInvestorSavedList);
router.get("/:listId", optionalAuthenticate, listController.getListById);
router.patch("/:listId/views", express.json(), listController.updateListViewCount);

router.use(authenticate);

router.post("/", authorize("investor", "investee", "superadmin"), handleListImageUpload, listController.createList);
router.patch(
  "/:listId",
  authorize("investor", "investee", "superadmin"),
  handleListImageUpload,
  listController.updateList
);
router.patch(
  "/:listId/status",
  authorize("investor", "investee", "superadmin"),
  listController.changeListStatus
);
router.delete(
  "/:listId",
  authorize("investor", "investee", "superadmin"),
  listController.deleteList
);

export default router;
