import multer from "multer";
import AppError from "../utils/appError.js";
import { uploadBlogImageToS3 } from "../modules/blog/services/blogStorage.service.js";

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

export const handleBlogCoverImageUpload = [
  upload.single("coverImage"),
  async (req, _res, next) => {
    try {
      if (req.file) {
        req.body.coverImage = await uploadBlogImageToS3(req.file, "cover");
      }

      next();
    } catch (error) {
      next(error);
    }
  },
];

export const handleBlogInlineImageUpload = [
  upload.single("image"),
  async (req, _res, next) => {
    try {
      if (!req.file) {
        throw new AppError("image is required", 400);
      }

      req.uploadedBlogImage = await uploadBlogImageToS3(req.file, "inline");
      next();
    } catch (error) {
      next(error);
    }
  },
];
