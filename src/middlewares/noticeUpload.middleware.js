import multer from "multer";
import AppError from "../utils/appError.js";
import { uploadNoticeImageToS3 } from "../modules/notice/services/noticeStorage.service.js";

const maxFileSize = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSize,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      cb(new AppError("Only image files are allowed", 400));
      return;
    }

    cb(null, true);
  },
});

export const handleNoticeImageUpload = [
  upload.single("image"),
  async (req, _res, next) => {
    try {
      if (req.file) {
        req.body.image = await uploadNoticeImageToS3(req.file, "cover");
      }

      next();
    } catch (error) {
      next(error);
    }
  },
];

export const handleNoticeInlineImageUpload = [
  upload.single("image"),
  async (req, _res, next) => {
    try {
      if (!req.file) {
        throw new AppError("image is required", 400);
      }

      req.uploadedNoticeImage = await uploadNoticeImageToS3(req.file, "inline");
      next();
    } catch (error) {
      next(error);
    }
  },
];
