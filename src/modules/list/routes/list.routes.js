import express from "express";
import * as listController from "../controllers/list.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { handleListImageUpload } from "../../../middlewares/listUpload.middleware.js";

const router = express.Router();

router.get("/", listController.getAllLists);
router.get("/filter", listController.getFilteredLists);
router.get("/sectors", listController.getSectorListCounts);
router.get("/user/me", authenticate, authorize("investor", "investee", "superadmin"), listController.getMyLists);
router.get("/:listId", listController.getListById);
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
