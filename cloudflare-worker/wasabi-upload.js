/**
 * Cloudflare Worker untuk upload file ke Wasabi (S3-compatible)
 * 
 * Wasabi menggunakan S3 API, jadi kita bisa menggunakan AWS SDK atau fetch langsung
 */

export default {
  async fetch(request, env) {
    // Get origin from request untuk CORS
    const origin = request.headers.get('Origin');
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
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

      // Get Wasabi credentials from environment
      const wasabiAccessKey = env.WASABI_ACCESS_KEY;
      const wasabiSecretKey = env.WASABI_SECRET_KEY;
      const wasabiBucket = env.WASABI_BUCKET;
      const wasabiRegion = env.WASABI_REGION || 'ap-southeast-1'; // Default: Singapore
      const wasabiEndpoint = env.WASABI_ENDPOINT || `https://s3.${wasabiRegion}.wasabisys.com`;

      if (!wasabiAccessKey || !wasabiSecretKey || !wasabiBucket) {
        throw new Error('Wasabi credentials not configured');
      }

      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Upload to Wasabi using S3 API
      const publicUrl = await uploadToWasabi(
        arrayBuffer,
        filePath,
        file.type,
        file.name,
        wasabiAccessKey,
        wasabiSecretKey,
        wasabiBucket,
        wasabiRegion,
        wasabiEndpoint
      );

      // Log untuk debugging
      console.log('📤 File uploaded to Wasabi:', {
        fileName: file.name,
        filePath: filePath,
        fullUrl: publicUrl,
        size: file.size,
        type: file.type
      });

      // Return success response
      return new Response(
        JSON.stringify({
          success: true,
          url: publicUrl,
          filePath: filePath,
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
 * Upload file to Wasabi using S3 API (Signature Version 4)
 */
async function uploadToWasabi(
  fileData,
  filePath,
  contentType,
  fileName,
  accessKey,
  secretKey,
  bucket,
  region,
  endpoint,
  env
) {
  const url = `${endpoint}/${bucket}/${filePath}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  // Create AWS Signature V4
  const authorization = await createAWS4Signature(
    'PUT',
    `/${bucket}/${filePath}`,
    endpoint,
    region,
    accessKey,
    secretKey,
    dateStamp,
    amzDate,
    contentType,
    fileData
  );

  // Upload file
  const response = await fetch(url, {
    method: 'PUT',
    body: fileData,
    headers: {
      'Content-Type': contentType,
      'x-amz-date': amzDate,
      'Authorization': authorization,
      'x-amz-acl': 'public-read', // Make file public
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wasabi upload failed: ${response.status} - ${errorText}`);
  }

  // Construct public URL
  // Format: https://{bucket}.s3.{region}.wasabisys.com/{filePath}
  const wasabiPublicUrl = env.WASABI_PUBLIC_URL || `https://${bucket}.s3.${region}.wasabisys.com/${filePath}`;
  
  return wasabiPublicUrl;
}

/**
 * Create AWS Signature Version 4
 */
async function createAWS4Signature(
  method,
  canonicalUri,
  host,
  region,
  accessKey,
  secretKey,
  dateStamp,
  amzDate,
  contentType,
  payload
) {
  const service = 's3';
  const algorithm = 'AWS4-HMAC-SHA256';

  // Step 1: Create canonical request
  const hostname = new URL(host).hostname;
  const canonicalHeaders = [
    `host:${hostname}`,
    `x-amz-acl:public-read`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';

  const signedHeaders = 'host;x-amz-acl;x-amz-date';

  // Hash payload (convert ArrayBuffer to hex string)
  const payloadHashBytes = await sha256Hash(payload);
  const payloadHash = Array.from(new Uint8Array(payloadHashBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const canonicalRequest = [
    method,
    canonicalUri,
    '', // canonical query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // Hash canonical request
  const canonicalRequestHashBytes = await sha256Hash(canonicalRequest);
  const canonicalRequestHash = Array.from(new Uint8Array(canonicalRequestHashBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Step 2: Create string to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  // Step 3: Create signing key
  const kDate = await hmacSHA256(dateStamp, 'AWS4' + secretKey);
  const kRegion = await hmacSHA256(region, kDate);
  const kService = await hmacSHA256(service, kRegion);
  const kSigning = await hmacSHA256('aws4_request', kService);

  // Step 4: Create signature
  const signature = await hmacSHA256(stringToSign, kSigning);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Step 5: Create authorization header
  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  return authorization;
}

/**
 * SHA256 hash - returns ArrayBuffer
 */
async function sha256Hash(data) {
  if (typeof data === 'string') {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    return await crypto.subtle.digest('SHA-256', dataBytes);
  } else {
    // data is already ArrayBuffer
    return await crypto.subtle.digest('SHA-256', data);
  }
}

/**
 * HMAC SHA256 - returns ArrayBuffer
 */
async function hmacSHA256(message, key) {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key);
  
  let messageBytes;
  if (typeof message === 'string') {
    messageBytes = encoder.encode(message);
  } else if (message instanceof ArrayBuffer) {
    messageBytes = new Uint8Array(message);
  } else {
    messageBytes = message; // Assume it's already Uint8Array
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes);
  return signature; // Return ArrayBuffer
}

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

