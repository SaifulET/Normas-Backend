import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import AppError from "../utils/appError.js";

const bytesPerMb = 1024 * 1024;
const maxFileSize = Number(process.env.KYC_MAX_FILE_SIZE_MB || 50) * bytesPerMb;

const isAllowedKycFile = (mimetype = "") =>
  mimetype.startsWith("image/") || mimetype.startsWith("video/") || mimetype === "application/pdf";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSize,
    files: 8,
  },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedKycFile(file.mimetype)) {
      cb(new AppError("Only image, video, or PDF files are allowed", 400));
      return;
    }

    cb(null, true);
  },
});

const uploadFields = [
  { name: "identityDocument", maxCount: 1 },
  { name: "utilityBill", maxCount: 1 },
  { name: "bankStatement", maxCount: 1 },
  { name: "facePhoto", maxCount: 1 },
  { name: "verificationVideo", maxCount: 1 },
  { name: "salarySlip", maxCount: 1 },
  { name: "businessDocument", maxCount: 1 },
  { name: "taxReturns", maxCount: 1 },
];

const uploadFieldToBodyPath = {
  identityDocument: ["personalIdentity", "identityDocument"],
  utilityBill: ["addressVerification", "utilityBill"],
  bankStatement: ["addressVerification", "bankStatement"],
  facePhoto: ["faceVerification", "facePhoto"],
  verificationVideo: ["faceVerification", "verificationVideo"],
  salarySlip: ["sourceOfFunds", "salarySlip"],
  businessDocument: ["sourceOfFunds", "businessDocument"],
  taxReturns: ["sourceOfFunds", "taxReturns"],
};

let cachedS3Client = null;
let cachedS3Config = null;

const setNestedValue = (target, path, value) => {
  let current = target;

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    current[key] = current[key] && typeof current[key] === "object" ? current[key] : {};
    current = current[key];
  }

  current[path[path.length - 1]] = value;
};

const assignMultipartTextFields = (body) => {
  const normalizedBody = {};

  for (const [key, value] of Object.entries(body || {})) {
    if (!key.includes(".")) {
      normalizedBody[key] = value;
      continue;
    }

    setNestedValue(normalizedBody, key.split("."), value);
  }

  return normalizedBody;
};

const buildFileKey = (userId, fieldName, originalName) => {
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, "-");
  return `kyc/${userId}/${fieldName}-${Date.now()}-${sanitizedName}`;
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

const getS3Client = () => {
  const awsConfig = getAwsConfig();

  if (
    !cachedS3Client ||
    cachedS3Config?.region !== awsConfig.region ||
    cachedS3Config?.accessKeyId !== awsConfig.credentials.accessKeyId ||
    cachedS3Config?.secretAccessKey !== awsConfig.credentials.secretAccessKey
  ) {
    cachedS3Client = new S3Client({
      region: awsConfig.region,
      credentials: awsConfig.credentials,
    });
    cachedS3Config = {
      region: awsConfig.region,
      accessKeyId: awsConfig.credentials.accessKeyId,
      secretAccessKey: awsConfig.credentials.secretAccessKey,
      bucketName: awsConfig.bucketName,
    };
  }

  return {
    s3Client: cachedS3Client,
    bucketName: awsConfig.bucketName,
    region: awsConfig.region,
  };
};

const uploadBufferToS3 = async (file, userId) => {
  const { s3Client, bucketName, region } = getS3Client();

  const key = buildFileKey(userId, file.fieldname, file.originalname);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
};

export const handleKycFileUpload = [
  upload.fields(uploadFields),
  async (req, _res, next) => {
    try {
      req.body = assignMultipartTextFields(req.body);

      const uploadedFiles = req.files || {};
      const fileEntries = Object.entries(uploadedFiles);

      const uploadResults = await Promise.all(
        fileEntries.map(async ([fieldName, files]) => {
          const file = files?.[0];

          if (!file) {
            return null;
          }

          const url = await uploadBufferToS3(file, req.user.userId);
          return { fieldName, url };
        })
      );

      for (const result of uploadResults) {
        if (result) {
          setNestedValue(req.body, uploadFieldToBodyPath[result.fieldName], result.url);
        }
      }

      next();
    } catch (error) {
      console.log("Error uploading KYC files:", error);
      next(error);
    }
  },
];

export const handleKycImageUpload = handleKycFileUpload;
