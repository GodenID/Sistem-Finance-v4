/**
 * Cloudflare Worker untuk upload file ke Wasabi (S3-compatible)
 * Versi 2: Menggunakan AWS SDK approach yang lebih sederhana
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
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

      if (file.size > 10 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ error: 'File size exceeds 10MB limit' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const filePath = generateFilePath(file.name, documentType, documentId);
      const arrayBuffer = await file.arrayBuffer();

      // Get Wasabi config
      const wasabiAccessKey = env.WASABI_ACCESS_KEY;
      const wasabiSecretKey = env.WASABI_SECRET_KEY;
      const wasabiBucket = env.WASABI_BUCKET;
      const wasabiRegion = env.WASABI_REGION || 'ap-southeast-1';
      const wasabiEndpoint = env.WASABI_ENDPOINT || `https://s3.${wasabiRegion}.wasabisys.com`;

      if (!wasabiAccessKey || !wasabiSecretKey || !wasabiBucket) {
        throw new Error('Wasabi credentials not configured. Please set WASABI_ACCESS_KEY, WASABI_SECRET_KEY, and WASABI_BUCKET in Worker environment variables.');
      }

      // Upload to Wasabi
      const publicUrl = await uploadToWasabiV4(
        arrayBuffer,
        filePath,
        file.type,
        wasabiAccessKey,
        wasabiSecretKey,
        wasabiBucket,
        wasabiRegion,
        wasabiEndpoint,
        env
      );

      console.log('✅ File uploaded to Wasabi:', {
        fileName: file.name,
        filePath: filePath,
        fullUrl: publicUrl,
        size: file.size
      });

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
      console.error('❌ Error uploading file:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};

/**
 * Upload to Wasabi using AWS Signature V4
 */
async function uploadToWasabiV4(
  fileData,
  filePath,
  contentType,
  accessKey,
  secretKey,
  bucket,
  region,
  endpoint,
  env
) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, -1) + 'Z';
  const dateStamp = amzDate.substring(0, 8).replace(/T/g, '');

  const host = new URL(endpoint).hostname;
  const canonicalUri = `/${bucket}/${filePath}`;
  const canonicalQuerystring = '';
  
  // Create canonical headers
  const canonicalHeaders = `host:${host}\nx-amz-acl:public-read\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-acl;x-amz-date';

  // Hash payload
  const payloadHash = await hexHash(fileData);

  // Create canonical request
  const canonicalRequest = `PUT
${canonicalUri}
${canonicalQuerystring}
${canonicalHeaders}
${signedHeaders}
${payloadHash}`;

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalRequestHash = await hexHash(canonicalRequest);
  const stringToSign = `${algorithm}
${amzDate}
${credentialScope}
${canonicalRequestHash}`;

  // Calculate signature
  const signature = await calculateSignature(secretKey, dateStamp, region, stringToSign);

  // Create authorization header
  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // Upload file
  const url = `${endpoint}${canonicalUri}`;
  const response = await fetch(url, {
    method: 'PUT',
    body: fileData,
    headers: {
      'Content-Type': contentType,
      'x-amz-date': amzDate,
      'x-amz-acl': 'public-read',
      'Authorization': authorization,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wasabi upload failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  // Construct public URL
  const wasabiPublicUrl = env.WASABI_PUBLIC_URL || `https://${bucket}.s3.${region}.wasabisys.com/${filePath}`;
  return wasabiPublicUrl;
}

/**
 * Calculate AWS Signature V4
 */
async function calculateSignature(secretKey, dateStamp, region, stringToSign) {
  const kDate = await hmacSha256('AWS4' + secretKey, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, 's3');
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = await hmacSha256(kSigning, stringToSign);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * HMAC SHA256
 */
async function hmacSha256(key, message) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return new Uint8Array(signature);
}

/**
 * SHA256 hash and return hex string
 */
async function hexHash(data) {
  const encoder = new TextEncoder();
  let dataArray;
  
  if (typeof data === 'string') {
    dataArray = encoder.encode(data);
  } else if (data instanceof ArrayBuffer) {
    dataArray = new Uint8Array(data);
  } else {
    dataArray = data;
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', dataArray);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate organized file path
 */
function generateFilePath(originalFileName, documentType, documentId = null) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 10);
  const extension = originalFileName.split('.').pop().toLowerCase();
  
  const baseName = originalFileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9\s_-]/gi, '_')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .substring(0, 50);
  
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

