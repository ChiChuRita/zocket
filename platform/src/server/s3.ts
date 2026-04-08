import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

function getS3Client() {
  if (client) {
    return client;
  }

  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
  if (!region) {
    throw new Error("AWS_REGION is not configured");
  }

  client = new S3Client({
    region,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });

  return client;
}

function getBucketName() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error("S3_BUCKET is not configured");
  }
  return bucket;
}

export async function putBundle(key: string, code: string) {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: code,
      ContentType: "text/javascript",
    }),
  );
}

export async function getBundle(key: string) {
  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error("S3 bundle body is missing");
  }

  return await response.Body.transformToString();
}
