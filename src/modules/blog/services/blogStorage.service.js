import { randomUUID } from "crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import AppError from "../../../utils/appError.js";

let cachedS3Client = null;

const getAwsConfig = () => {
  const region = process.env.AWS_REGION?.trim();
  const bucketName = process.env.AWS_S3_BUCKET?.trim() || process.env.AWS_BUCKET_NAME?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!region || !bucketName) {
    throw new AppError("AWS S3 blog storage is not configured", 500);
  }

  return {
    bucketName,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    region,
  };
};

const getS3Client = () => {
  if (!cachedS3Client) {
    const awsConfig = getAwsConfig();
    cachedS3Client = new S3Client({
      credentials: awsConfig.credentials,
      region: awsConfig.region,
    });
  }

  return cachedS3Client;
};

const getBlogFolder = () => (process.env.AWS_S3_BLOG_FOLDER?.trim() || "blogs").replace(/^\/+|\/+$/g, "");

const getExtension = (file) => {
  const extension = file.originalname?.split(".").pop() || file.mimetype?.split("/").pop() || "image";
  return extension.replace(/[^a-zA-Z0-9]/g, "") || "image";
};

export const uploadBlogImageToS3 = async (file, subfolder = "inline") => {
  const awsConfig = getAwsConfig();
  const safeSubfolder = String(subfolder || "inline").replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9/_-]/g, "-");
  const key = `${getBlogFolder()}/${safeSubfolder}/${Date.now()}-${randomUUID()}.${getExtension(file)}`;

  await getS3Client().send(
    new PutObjectCommand({
      Body: file.buffer,
      Bucket: awsConfig.bucketName,
      ContentType: file.mimetype,
      Key: key,
    })
  );

  return {
    key,
    url: `https://${awsConfig.bucketName}.s3.${awsConfig.region}.amazonaws.com/${key}`,
  };
};

export const deleteBlogImageFromS3 = async (key) => {
  const normalizedKey = String(key || "").trim();

  if (!normalizedKey) {
    return false;
  }

  const awsConfig = getAwsConfig();

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: awsConfig.bucketName,
      Key: normalizedKey,
    })
  );

  return true;
};
