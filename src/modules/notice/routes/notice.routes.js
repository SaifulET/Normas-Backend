import express from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  handleNoticeImageUpload,
  handleNoticeInlineImageUpload,
} from "../../../middlewares/noticeUpload.middleware.js";
import * as noticeController from "../controllers/notice.controller.js";

export const superadminNoticeRouter = express.Router();
export const investorNoticeRouter = express.Router();
export const investeeNoticeRouter = express.Router();

superadminNoticeRouter.use(authenticate, authorize("superadmin"));
superadminNoticeRouter.post("/images", handleNoticeInlineImageUpload, noticeController.uploadNoticeImage);
superadminNoticeRouter.delete("/images", noticeController.deleteNoticeImage);
superadminNoticeRouter.post("/", handleNoticeImageUpload, noticeController.createNotice);
superadminNoticeRouter.get("/", noticeController.getSuperadminNotices);
superadminNoticeRouter.get("/:noticeId", noticeController.getSuperadminNoticeById);
superadminNoticeRouter.patch("/:noticeId", noticeController.updateNotice);
superadminNoticeRouter.patch("/:noticeId/archive", noticeController.archiveNotice);
superadminNoticeRouter.delete("/:noticeId", noticeController.deleteNotice);
superadminNoticeRouter.post("/:noticeId/retry-failed-emails", noticeController.retryFailedNoticeEmails);

investorNoticeRouter.use(authenticate, authorize("investor"));
investorNoticeRouter.get("/", noticeController.getRoleNotices);
investorNoticeRouter.get("/:noticeId", noticeController.getRoleNoticeById);
investorNoticeRouter.patch("/:noticeId/read", noticeController.markRoleNoticeAsRead);

investeeNoticeRouter.use(authenticate, authorize("investee"));
investeeNoticeRouter.get("/", noticeController.getRoleNotices);
investeeNoticeRouter.get("/:noticeId", noticeController.getRoleNoticeById);
investeeNoticeRouter.patch("/:noticeId/read", noticeController.markRoleNoticeAsRead);
