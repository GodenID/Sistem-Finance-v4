/**
 * Cloudflare Worker untuk handle upload file ke R2 (Proxy Method)
 * Worker ini menerima file dari frontend dan mengupload langsung ke R2
 * Lebih sederhana dan reliable daripada presigned URL
 */

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      // Get form data from request
      const formData = await request.formData();
      const file = formData.get('file');
      const documentType = formData.get('documentType') || 'uploads';
      const documentId = formData.get('documentId') || null;

      if (!file) {
        return new Response(
          JSON.stringify({ error: 'No file provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ error: 'File size exceeds 10MB limit' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate organized file path
      const filePath = generateFilePath(file.name, documentType, documentId);

      // Upload to R2 using S3 API
      const publicUrl = await uploadToR2(
        env.R2_ACCOUNT_ID,
        env.R2_ACCESS_KEY_ID,
        env.R2_SECRET_ACCESS_KEY,
        env.R2_BUCKET_NAME,
        filePath,
        file,
        file.type
      );

      // Return success response
      return new Response(
        JSON.stringify({
          success: true,
          url: publicUrl,
          filePath,
          fileName: file.name,
          size: file.size,
          type: file.type,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Error uploading file:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};

/**
 * Generate organized file path
 * Format: {document-type}/{year}/{month}/{document-id}/{timestamp}-{random}-{sanitized-filename}.{ext}
 */
function generateFilePath(originalFileName, documentType, documentId = null) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
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
  
  // Build path
  let path = `${documentType}/${year}/${month}`;
  
  if (documentId) {
    const sanitizedDocId = documentId.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    path += `/${sanitizedDocId}`;
  } else {
    path += `/${randomString}`;
  }
  
  const fileName = `${timestamp}-${randomString}-${baseName}.${extension}`;
  return `${path}/${fileName}`;
}

/**
 * Upload file to R2 using S3 API
 */
async function uploadToR2(accountId, accessKeyId, secretAccessKey, bucketName, key, file, contentType) {
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${bucketName}/${key}`;
  
  // Convert file to ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  
  // Create request with AWS Signature V4
  // For simplicity, we'll use a basic PUT request
  // In production, you should implement proper AWS signature
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Authorization': `AWS ${accessKeyId}:${await generateSignature(secretAccessKey, 'PUT', `/${bucketName}/${key}`, contentType)}`,
    },
    body: arrayBuffer,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload to R2: ${response.statusText}`);
  }

  // Return public URL
  const publicUrl = `${process.env.R2_PUBLIC_URL || `https://pub-${accountId}.r2.dev`}/${key}`;
  return publicUrl;
}

/**
 * Generate AWS Signature V4 (simplified)
 * Note: This is a basic implementation. For production, use proper AWS signature library
 */
async function generateSignature(secretAccessKey, method, path, contentType) {
  // Simplified signature - in production, implement full AWS Signature V4
  // This is a placeholder - you may need to use a library or implement full signature
  const timestamp = new Date().toISOString();
  const stringToSign = `${method}\n\n${contentType}\n${timestamp}\n${path}`;
  
  // Use Web Crypto API for HMAC
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretAccessKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return signatureHex;
}

