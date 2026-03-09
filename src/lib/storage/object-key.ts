import type { UploadFolder } from '@/lib/storage'

const FALLBACK_BUCKETS = ['openevents', 'openevents-media'] as const

function extractFromSegments(
  segments: string[],
  allowedFolders: readonly UploadFolder[]
): string | null {
  const allowed = new Set(allowedFolders)
  const folderIndex = segments.findIndex((segment) => allowed.has(segment as UploadFolder))
  if (folderIndex < 0) return null
  const key = segments.slice(folderIndex).join('/')
  return key || null
}

function toSegments(path: string): string[] {
  return decodeURIComponent(path)
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

export function extractObjectKeyFromStorageRef(
  image: string,
  allowedFolders: readonly UploadFolder[]
): string | null {
  if (!image) return null

  const bucketCandidates = [
    process.env.S3_BUCKET_NAME,
    ...FALLBACK_BUCKETS,
  ].filter((value): value is string => Boolean(value))

  if (!image.startsWith('http://') && !image.startsWith('https://')) {
    const directSegments = toSegments(image)
    const fromDirect = extractFromSegments(directSegments, allowedFolders)
    if (fromDirect) return fromDirect

    if (directSegments.length > 1 && bucketCandidates.includes(directSegments[0])) {
      return extractFromSegments(directSegments.slice(1), allowedFolders)
    }

    return null
  }

  try {
    const parsed = new URL(image)
    const pathSegments = toSegments(parsed.pathname)

    const fromPath = extractFromSegments(pathSegments, allowedFolders)
    if (fromPath) return fromPath

    if (pathSegments.length > 1 && bucketCandidates.includes(pathSegments[0])) {
      const fromBucketPath = extractFromSegments(pathSegments.slice(1), allowedFolders)
      if (fromBucketPath) return fromBucketPath
    }

    return null
  } catch {
    return null
  }
}
