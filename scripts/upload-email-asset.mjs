import "dotenv/config";
import { readFile, stat } from "fs/promises";
import { basename } from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const [, , filePath, requestedKey] = process.argv;

const contentTypes = new Map([
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

const getExtension = (value) => {
  const match = String(value || "").toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] || "";
};

const sanitizeKeyPart = (value) =>
  String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9/_ .-]/g, "-")
    .replace(/\s+/g, "-");

const getAwsConfig = () => {
  const region = process.env.AWS_REGION?.trim();
  const bucketName = process.env.AWS_S3_BUCKET?.trim() || process.env.AWS_BUCKET_NAME?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!region || !bucketName) {
    throw new Error("AWS_REGION and AWS_BUCKET_NAME/AWS_S3_BUCKET are required.");
  }

  return {
    region,
    bucketName,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  };
};

if (!filePath) {
  console.error("Usage: node scripts/upload-email-asset.mjs <file-path> [s3-key]");
  process.exit(1);
}

await stat(filePath);

const awsConfig = getAwsConfig();
const fileName = sanitizeKeyPart(basename(filePath));
const key = sanitizeKeyPart(requestedKey) || `email-assets/${fileName}`;
const extension = getExtension(filePath);
const contentType = contentTypes.get(extension) || "application/octet-stream";
const body = await readFile(filePath);

const s3Client = new S3Client({
  region: awsConfig.region,
  credentials: awsConfig.credentials,
});

await s3Client.send(
  new PutObjectCommand({
    Bucket: awsConfig.bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
    ContentDisposition: `inline; filename="${basename(filePath).replace(/"/g, "")}"`,
  })
);

const url = `https://${awsConfig.bucketName}.s3.${awsConfig.region}.amazonaws.com/${key}`;

console.log(JSON.stringify({ key, url }, null, 2));
