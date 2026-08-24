import multer from "multer";
import AppError from "../utils/appError.js";

const maxFileSizeMb = Number(process.env.CHAT_ATTACHMENT_MAX_FILE_SIZE_MB || 20);
const maxFileSize = Math.max(maxFileSizeMb, 1) * 1024 * 1024;

const blockedExtensions = new Set([
  "bat",
  "cmd",
  "com",
  "exe",
  "js",
  "msi",
  "ps1",
  "sh",
  "vbs",
]);

const getExtension = (fileName = "") => fileName.split(".").pop()?.toLowerCase() || "";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSize,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const extension = getExtension(file.originalname);

    if (blockedExtensions.has(extension)) {
      return callback(new AppError("This file type is not allowed", 400));
    }

    return callback(null, true);
  },
});

export const chatAttachmentUpload = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        return next(new AppError(error.message, 400));
      }

      return next(error);
    }

    if (!req.file) {
      return next(new AppError("file is required", 400));
    }

    return next();
  });
};
