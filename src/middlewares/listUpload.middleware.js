import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import AppError from "../utils/appError.js";

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

const setNestedValue = (target, path, value) => {
  let current = target;

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    current[key] = current[key] && typeof current[key] === "object" ? current[key] : {};
    current = current[key];
  }

  current[path[path.length - 1]] = value;
};

const parseAdditionalDetails = (value) => {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    throw new AppError("additionalDetails must be a valid JSON array", 400);
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      throw new Error("Not an array");
    }

    return parsedValue;
  } catch {
    throw new AppError("additionalDetails must be a valid JSON array", 400);
  }
};

const normalizeMultipartBody = (body) => {
  const normalizedBody = {};

  for (const [key, value] of Object.entries(body || {})) {
    if (key === "additionalDetails") {
      normalizedBody.additionalDetails = parseAdditionalDetails(value);
      continue;
    }

    if (!key.includes(".")) {
      normalizedBody[key] = value;
      continue;
    }

    setNestedValue(normalizedBody, key.split("."), value);
  }

  return normalizedBody;
};

const getAwsConfig = () => {
  const region = process.env.AWS_REGION?.trim();
  const bucketName = process.env.AWS_BUCKET_NAME?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!region || !bucketName || !accessKeyId || !secretAccessKey) {
    throw new AppError("AWS S3 credentials are not configured", 500);
  }

  return {
    region,
    bucketName,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };
};

const buildFileKey = (userId, originalName) => {
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, "-");
  return `lists/${userId}/banner-${Date.now()}-${sanitizedName}`;
};

const uploadBufferToS3 = async (file, userId) => {
  const awsConfig = getAwsConfig();
  const s3Client = new S3Client({
    region: awsConfig.region,
    credentials: awsConfig.credentials,
  });

  const key = buildFileKey(userId, file.originalname);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: awsConfig.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return `https://${awsConfig.bucketName}.s3.${awsConfig.region}.amazonaws.com/${key}`;
};

export const handleListImageUpload = [
  upload.single("bannerImage"),
  async (req, _res, next) => {
    try {
      req.body = normalizeMultipartBody(req.body);

      if (req.file) {
        req.body.bannerImage = await uploadBufferToS3(req.file, req.user.userId);
      }

      next();
    } catch (error) {
      next(error);
    }
  },
];
