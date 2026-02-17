import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// MinIO/S3 client configuration
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Required for MinIO
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'openevents'

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
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })

  return getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Generate a presigned URL for downloading/viewing a file
 */
export async function getDownloadPresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  return getSignedUrl(s3Client, command, { expiresIn })
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
    Bucket: BUCKET_NAME,
    Key: key,
  })

  await s3Client.send(command)
}

/**
 * List files in a folder
 */
export async function listFiles(prefix: string): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  })

  const response = await s3Client.send(command)
  return response.Contents?.map((item) => item.Key!) || []
}

/**
 * Get the public URL for a file (if bucket is public)
 * For signed URLs, use getDownloadPresignedUrl instead
 */
export function getPublicUrl(key: string): string {
  const endpoint = process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT
  return `${endpoint}/${BUCKET_NAME}/${key}`
}

export { s3Client, BUCKET_NAME }
