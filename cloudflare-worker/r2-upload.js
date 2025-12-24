/**
 * Cloudflare Worker untuk handle upload file ke R2
 * Worker ini generate presigned URL untuk upload langsung dari frontend
 */

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight request
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const { documentType, documentId, fileName, contentType } = await request.json();

      // Validate required fields
      if (!documentType || !fileName || !contentType) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: documentType, fileName, contentType' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate file path with organized structure
      const filePath = generateFilePath(fileName, documentType, documentId);

      // Generate presigned URL for upload
      const presignedUrl = await generatePresignedUrl(
        env.R2_ACCOUNT_ID,
        env.R2_ACCESS_KEY_ID,
        env.R2_SECRET_ACCESS_KEY,
        env.R2_BUCKET_NAME,
        filePath,
        contentType
      );

      // Return presigned URL and file path
      return new Response(
        JSON.stringify({
          success: true,
          presignedUrl,
          filePath,
          publicUrl: `${env.R2_PUBLIC_URL}/${filePath}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};

/**
 * Generate organized file path
 * Format: {document-type}/{year}/{month}/{day}/{document-id}/{timestamp}-{random}-{sanitized-filename}.{ext}
 * 
 * Examples:
 * - klaim/2025/12/22/KL-2025-12-0001/1735912345678-abc123-receipt.jpg
 * - payment-request/2025/12/22/PR-2025-12-0001/1735912345678-xyz789-invoice.pdf
 */
function generateFilePath(originalFileName, documentType, documentId = null) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 10);
  const extension = originalFileName.split('.').pop().toLowerCase();

  // Sanitize filename
  const baseName = originalFileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9\s_-]/gi, '_')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .substring(0, 50);

  // Build path: document-type/year/month/day/document-id/filename
  let path = `${documentType}/${year}/${month}/${day}`;

  if (documentId) {
    // Keep document ID readable (e.g., KL-2025-12-0001)
    const sanitizedDocId = documentId.replace(/[^a-z0-9_-]/gi, '-');
    path += `/${sanitizedDocId}`;
  } else {
    path += `/${randomString}`;
  }

  const fileName = `${timestamp}-${randomString}-${baseName}.${extension}`;
  return `${path}/${fileName}`;
}

/**
 * Generate presigned URL untuk upload ke R2
 * Menggunakan AWS Signature V4
 */
async function generatePresignedUrl(accountId, accessKeyId, secretAccessKey, bucketName, key, contentType) {
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const expiresIn = 3600; // 1 hour

  // Create S3-compatible presigned URL
  // Note: This is a simplified version. For production, use AWS SDK or proper signature generation
  const url = new URL(`${endpoint}/${bucketName}/${key}`);

  // Add query parameters for presigned URL
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${new Date().toISOString().split('T')[0]}/${region}/s3/aws4_request`,
    'X-Amz-Date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
    'X-Amz-Expires': expiresIn.toString(),
    'X-Amz-SignedHeaders': 'host',
    'Content-Type': contentType,
  });

  url.search = params.toString();

  // Note: Untuk production, Anda perlu generate signature yang benar
  // Ini adalah placeholder. Gunakan library seperti @aws-sdk/s3-request-presigner
  // atau implementasi signature generation yang proper

  return url.toString();
}

