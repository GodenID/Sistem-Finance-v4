/**
 * Cloudflare Worker untuk upload file ke R2 (Simple Version dengan R2 Bindings)
 * 
 * CATATAN: Versi ini menggunakan R2 bindings yang lebih sederhana dan reliable
 * Setup R2 binding di wrangler.toml atau via Cloudflare Dashboard
 */

export default {
  async fetch(request, env) {
    // Get origin from request untuk CORS
    const origin = request.headers.get('Origin');

    // CORS headers - allow semua origin untuk development, atau spesifik untuk production
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
    };

    // Handle preflight request
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Handle GET requests - proxy file downloads with CORS
    if (request.method === 'GET') {
      try {
        const url = new URL(request.url);
        const filePath = url.pathname.slice(1); // Remove leading slash

        if (!filePath) {
          return new Response(
            JSON.stringify({ error: 'File path required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const r2Bucket = env.MY_BUCKET || env.R2_BUCKET;
        if (!r2Bucket) {
          throw new Error('R2 bucket binding not configured');
        }

        const object = await r2Bucket.get(filePath);

        if (!object) {
          return new Response(
            JSON.stringify({ error: 'File not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        // Add CORS headers
        headers.set('Access-Control-Allow-Origin', origin || '*');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        return new Response(object.body, { headers });
      } catch (error) {
        console.error('Error fetching file:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Only allow POST requests for upload
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
      const userName = formData.get('userName') || null;

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
      const filePath = generateFilePath(file.name, documentType, documentId, userName);

      // Upload to R2 using bindings (MY_BUCKET adalah nama binding di wrangler.toml)
      // Jika menggunakan env variables, gunakan env.R2_BUCKET
      const r2Bucket = env.MY_BUCKET || env.R2_BUCKET;

      if (!r2Bucket) {
        throw new Error('R2 bucket binding not configured');
      }

      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Upload to R2
      await r2Bucket.put(filePath, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
        },
        customMetadata: {
          originalFileName: file.name,
          documentType: documentType,
          documentId: documentId || '',
          userName: userName || '',
        },
      });

      // Get public URL - pastikan format benar
      const r2PublicUrl = env.R2_PUBLIC_URL?.trim();
      if (!r2PublicUrl) {
        throw new Error('R2_PUBLIC_URL environment variable not set');
      }

      // Remove trailing slash dari R2_PUBLIC_URL jika ada
      const baseUrl = r2PublicUrl.endsWith('/') ? r2PublicUrl.slice(0, -1) : r2PublicUrl;

      // Remove leading slash dari filePath jika ada
      const cleanFilePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

      // Construct full URL
      const publicUrl = `${baseUrl}/${cleanFilePath}`;

      // Log untuk debugging
      console.log('📤 File uploaded:', {
        fileName: file.name,
        filePath: cleanFilePath,
        fullUrl: publicUrl,
        size: file.size,
        type: file.type,
        userName: userName
      });

      // Return success response
      return new Response(
        JSON.stringify({
          success: true,
          url: publicUrl,
          filePath: cleanFilePath,
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
 * Format: {document-type}/{year}/{month}/{day}/{user-name}/{document-id}/{timestamp}-{random}-{sanitized-filename}.{ext}
 * 
 * Examples:
 * - klaim/2025/12/22/Rangga/KLM-0001/1735912345678-abc123-receipt.jpg
 * - payment-request/2025/12/22/Rangga/PR-0001/1735912345678-xyz789-invoice.pdf
 * - penyelesaian/2025/12/22/Rangga/PY-0001/1735912345678-ghi789-bukti.jpg
 */
function generateFilePath(originalFileName, documentType, documentId = null, userName = null) {
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

  // Build path: document-type/year/month/day/user-name/document-id/filename
  let path = `${documentType}/${year}/${month}/${day}`;

  // Add user name folder
  if (userName) {
    const sanitizedUserName = userName.replace(/[^a-z0-9\s_-]/gi, '_').replace(/\s+/g, '_');
    path += `/${sanitizedUserName}`;
  } else {
    path += `/unknown`;
  }

  // Add document ID folder
  if (documentId) {
    // Keep document ID readable (e.g., KLM-0001)
    const sanitizedDocId = documentId.replace(/[^a-z0-9_-]/gi, '-');
    path += `/${sanitizedDocId}`;
  } else {
    path += `/${randomString}`;
  }

  const fileName = `${timestamp}-${randomString}-${baseName}.${extension}`;
  return `${path}/${fileName}`;
}

