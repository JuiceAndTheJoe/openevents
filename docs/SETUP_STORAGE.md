# Setting Up MinIO Storage Bucket

OpenEvents uses MinIO (S3-compatible object storage) hosted on OSC for storing event images, videos, speaker photos, and other media files.

## OSC MinIO Instance Details

- **Instance Name:** `openeventstorage`
- **Endpoint URL:** `https://REDACTED_S3_ENDPOINT`
- **Access Key:** `openevents`
- **Secret Key:** `REDACTED_S3_SECRET`

## Creating the Storage Bucket

The bucket `openevents-media` must be created manually. Choose one of the methods below:

### Method 1: MinIO Web Console (Recommended)

1. Open the MinIO Console in your browser:
   ```
   https://REDACTED_S3_ENDPOINT
   ```

2. Log in with the credentials:
   - **Username:** `openevents`
   - **Password:** `REDACTED_S3_SECRET`

3. Click **"Create Bucket"** in the sidebar

4. Enter bucket name: `openevents-media`

5. Click **"Create Bucket"**

6. (Optional) Set bucket policy to allow public read access for images:
   - Go to **Buckets** → **openevents-media** → **Access Policy**
   - Set to **Public** if you want direct image URLs, or keep **Private** for signed URLs only

### Method 2: AWS CLI

If you have AWS CLI installed:

```bash
# Configure AWS CLI for MinIO
export AWS_ACCESS_KEY_ID="openevents"
export AWS_SECRET_ACCESS_KEY="REDACTED_S3_SECRET"
export AWS_REGION="us-east-1"

# Create the bucket
aws s3api create-bucket \
  --bucket openevents-media \
  --endpoint-url https://REDACTED_S3_ENDPOINT
```

### Method 3: MinIO Client (mc)

If you have MinIO Client installed:

```bash
# Configure MinIO alias
mc alias set openevents https://REDACTED_S3_ENDPOINT openevents "REDACTED_S3_SECRET"

# Create the bucket
mc mb openevents/openevents-media

# Verify bucket was created
mc ls openevents
```

## Bucket Structure

The application organizes files in the following structure:

```
openevents-media/
├── events/
│   └── {event-id}/
│       ├── cover-{timestamp}.jpg
│       └── media-{timestamp}.{ext}
├── speakers/
│   └── {event-id}/
│       └── {speaker-id}-{timestamp}.jpg
├── organizers/
│   └── {organizer-id}/
│       └── logo-{timestamp}.{ext}
└── users/
    └── {user-id}/
        └── avatar-{timestamp}.{ext}
```

## Testing the Connection

After creating the bucket, you can test the connection:

```bash
# Using AWS CLI
aws s3 ls s3://openevents-media \
  --endpoint-url https://REDACTED_S3_ENDPOINT

# Using MinIO Client
mc ls openevents/openevents-media
```

## Configuring CORS (if needed)

If you're uploading files directly from the browser, you may need to configure CORS:

```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["http://localhost:3000", "https://your-production-url.com"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}
```

Apply with:
```bash
mc cors set /path/to/cors.json openevents/openevents-media
```

## Troubleshooting

### "Self-signed certificate" errors

The OSC MinIO instance uses HTTPS. If you encounter certificate errors:

1. **AWS CLI:** Try adding `--no-verify-ssl` (not recommended for production)
2. **Node.js:** The S3 client in the app is configured to work with OSC certificates
3. **Browser:** Ensure you're using `https://` in the endpoint URL

### "Access Denied" errors

1. Verify your access key and secret key are correct
2. Check that the bucket policy allows your operations
3. Ensure the bucket name matches exactly: `openevents-media`

### Connection timeout

1. Verify the endpoint URL is correct
2. Check your network can reach OSC services
3. Ensure no firewall is blocking HTTPS (port 443)

## Environment Variables

Make sure these are set in your `.env` file:

```env
S3_ENDPOINT=https://REDACTED_S3_ENDPOINT
S3_PUBLIC_URL=https://REDACTED_S3_ENDPOINT
S3_ACCESS_KEY_ID=openevents
S3_SECRET_ACCESS_KEY=REDACTED_S3_SECRET
S3_BUCKET_NAME=openevents-media
S3_REGION=us-east-1
```
