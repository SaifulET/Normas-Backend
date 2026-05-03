import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import AppError from "../utils/appError.js";

const maxFileSize = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSize,
    files: 6,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      cb(new AppError("Only image files are allowed", 400));
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

const uploadBufferToS3 = async (file, userId) => {
  const awsConfig = getAwsConfig();
  const s3Client = new S3Client({
    region: awsConfig.region,
    credentials: awsConfig.credentials,
  });

  const key = buildFileKey(userId, file.fieldname, file.originalname);

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

export const handleKycImageUpload = [
  upload.fields(uploadFields),
  async (req, _res, next) => {
    try {
      req.body = assignMultipartTextFields(req.body);

      const uploadedFiles = req.files || {};
      const fileEntries = Object.entries(uploadedFiles);
      console.log("Uploaded files:", fileEntries);

      for (const [fieldName, files] of fileEntries) {
        const file = files?.[0];

        if (!file) {
          continue;
        }

        const url = await uploadBufferToS3(file, req.user.userId);
        setNestedValue(req.body, uploadFieldToBodyPath[fieldName], url);
      }

      next();
    } catch (error) {
      console.log("Error uploading KYC files:", error);
      next(error);
    }
  },
];
