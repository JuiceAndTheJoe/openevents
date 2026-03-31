# Setting Up MinIO Storage Bucket

OpenEvents uses MinIO (S3-compatible object storage) hosted on OSC for storing event images, videos, speaker photos, and other media files.

## OSC MinIO Instance Details

- **Instance Name:** `your-instance-name`
- **Endpoint URL:** `https://your-minio-endpoint.example.com`
- **Access Key:** `your-access-key`
- **Secret Key:** `your-secret-key`

## Creating the Storage Bucket

The bucket `openevents-media` must be created manually. Choose one of the methods below:

### Method 1: MinIO Web Console (Recommended)

1. Open the MinIO Console in your browser:
   ```
   https://your-minio-endpoint.example.com
   ```

2. Log in with your credentials:
   - **Username:** `your-access-key`
   - **Password:** `your-secret-key`

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
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"

# Create the bucket
aws s3api create-bucket \
  --bucket openevents-media \
  --endpoint-url https://your-minio-endpoint.example.com
```

### Method 3: MinIO Client (mc)

If you have MinIO Client installed:

```bash
# Configure MinIO alias
mc alias set openevents https://your-minio-endpoint.example.com your-access-key "your-secret-key"

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
  --endpoint-url https://your-minio-endpoint.example.com

# Using MinIO Client
mc ls openevents/openevents-media
```

## Configuring CORS

Browser-based uploads require CORS to be configured on the MinIO server.

### OSC-hosted MinIO

MinIO instances on OSC have CORS enabled at the server level with `cors_allow_origin=*`. No additional configuration is needed.

### Self-hosted MinIO

If you're running your own MinIO, configure CORS using the admin API:

```bash
mc admin config set myminio api cors_allow_origin="*"
mc admin service restart myminio
```

Or set bucket-level CORS:

```bash
# Create cors.xml
cat > cors.xml << 'EOF'
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
  </CORSRule>
</CORSConfiguration>
EOF

mc cors set myminio/openevents-media cors.xml
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

### Local Development

Set these in your `.env` file:

```env
S3_ENDPOINT=https://your-minio-endpoint.example.com
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=openevents-media
S3_REGION=us-east-1
```

Note: `S3_PUBLIC_URL` is optional. Only set it if the browser-accessible URL differs from `S3_ENDPOINT` (e.g., when using an internal endpoint for server-side operations).

### OSC Catalog Service Deployment

When deploying Open Events as an OSC catalog service, storage is configured through the service instance settings:

1. **Create a MinIO instance** on your OSC tenant
2. **Create the bucket** (e.g., `openevents-media`) via the MinIO Console
3. **Configure the Open Events instance** with your MinIO credentials:
   - `s3Endpoint`: Your MinIO instance URL
   - `s3AccessKeyId`: MinIO access key
   - `s3SecretAccessKey`: MinIO secret key
   - `s3BucketName`: Your bucket name
   - `s3Region`: `us-east-1`

Environment variables are injected directly by OSC when creating the instance. No additional configuration service is required.
