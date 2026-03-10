import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Lazy-initialized S3 client to ensure env vars are loaded by instrumentation
let _s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!_s3Client) {
    const accessKeyId = process.env.S3_ACCESS_KEY_ID
    // MINIO_PASSWORD is a fallback because OSC filters out keys containing "SECRET_ACCESS_KEY"
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.MINIO_PASSWORD

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        `S3 credentials not configured. Missing: ${[
          !accessKeyId && 'S3_ACCESS_KEY_ID',
          !secretAccessKey && 'S3_SECRET_ACCESS_KEY',
        ]
          .filter(Boolean)
          .join(', ')}`
      )
    }

    _s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO
    })
  }
  return _s3Client
}

function getBucketName(): string {
  return process.env.S3_BUCKET_NAME || 'openevents'
}

export type UploadFolder = 'events' | 'speakers' | 'organizers' | 'users'

/**
 * Generate a presigned URL for uploading a file directly to S3/MinIO
 */
export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType,
  })

  const signedUrl = await getSignedUrl(getS3Client(), command, { expiresIn })

  // The signed URL is built using S3_ENDPOINT, which may be an internal address
  // unreachable from browsers. Rewrite it to S3_PUBLIC_URL so the browser can
  // PUT directly to the storage endpoint.
  const internalEndpoint = process.env.S3_ENDPOINT
  const publicEndpoint = process.env.S3_PUBLIC_URL
  if (publicEndpoint && internalEndpoint && publicEndpoint !== internalEndpoint) {
    return signedUrl.replace(internalEndpoint, publicEndpoint)
  }

  return signedUrl
}

/**
 * Generate a presigned URL for downloading/viewing a file
 */
export async function getDownloadPresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  })

  return getSignedUrl(getS3Client(), command, { expiresIn })
}

/**
 * Generate a unique file key for storage
 */
export function generateFileKey(
  folder: UploadFolder,
  entityId: string,
  filename: string
): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${folder}/${entityId}/${timestamp}-${sanitizedFilename}`
}

/**
 * Delete a file from S3/MinIO
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  })

  await getS3Client().send(command)
}

/**
 * List files in a folder
 */
export async function listFiles(prefix: string): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: getBucketName(),
    Prefix: prefix,
  })

  const response = await getS3Client().send(command)
  return response.Contents?.map((item) => item.Key!) || []
}

/**
 * Get the public URL for a file (if bucket is public)
 * For signed URLs, use getDownloadPresignedUrl instead
 */
export function getPublicUrl(key: string): string {
  const endpoint = process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT
  return `${endpoint}/${getBucketName()}/${key}`
}

// Export getters for external use
export { getS3Client as s3Client, getBucketName as BUCKET_NAME }
