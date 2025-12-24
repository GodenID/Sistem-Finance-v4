/**
 * Cloudflare Worker untuk proxy file dari R2 dengan CORS headers
 * 
 * Worker ini bertindak sebagai proxy untuk serve file dari R2 bucket
 * dengan CORS headers yang benar, sehingga bisa diakses dari browser.
 * 
 * Usage:
 * GET /?file=payment-requests/2025/11/pr-0002/file.pdf
 * atau
 * GET /payment-requests/2025/11/pr-0002/file.pdf
 */

export default {
  async fetch(request, env) {
    // Get origin from request untuk CORS
    const origin = request.headers.get('Origin');
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, ETag, Last-Modified',
      'Access-Control-Max-Age': '86400',
    };

    // Handle preflight request
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow GET and HEAD requests
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      // Get file path from URL
      const url = new URL(request.url);
      let filePath = url.searchParams.get('file');
      
      // If no file parameter, try to get from pathname
      if (!filePath) {
        // Remove leading slash from pathname
        filePath = url.pathname.substring(1);
      }

      if (!filePath) {
        return new Response(
          JSON.stringify({ error: 'File path is required. Use ?file=path/to/file or /path/to/file' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get R2 bucket
      const r2Bucket = env.MY_BUCKET || env.R2_BUCKET;
      
      if (!r2Bucket) {
        throw new Error('R2 bucket binding not configured');
      }

      // Get object from R2
      const object = await r2Bucket.get(filePath);

      if (!object) {
        return new Response(
          JSON.stringify({ error: 'File not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get object metadata
      const headers = new Headers();
      headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
      headers.set('Content-Length', object.size.toString());
      headers.set('Cache-Control', 'public, max-age=3600');
      
      // Add CORS headers
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });

      // Add ETag and Last-Modified if available
      if (object.httpEtag) {
        headers.set('ETag', object.httpEtag);
      }
      if (object.uploaded) {
        headers.set('Last-Modified', new Date(object.uploaded).toUTCString());
      }

      // Handle Range requests (for video/audio streaming)
      const range = request.headers.get('Range');
      if (range) {
        const objectBody = await object.arrayBuffer();
        const [start, end] = parseRange(range, object.size);
        
        headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
        headers.set('Content-Length', (end - start + 1).toString());
        headers.set('Accept-Ranges', 'bytes');
        
        return new Response(objectBody.slice(start, end + 1), {
          status: 206,
          headers,
        });
      }

      // Return full object
      return new Response(object.body, {
        headers,
      });
    } catch (error) {
      console.error('Error proxying file:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};

/**
 * Parse Range header
 * @param {string} range - Range header value (e.g., "bytes=0-1023")
 * @param {number} size - File size
 * @returns {[number, number]} - [start, end]
 */
function parseRange(range, size) {
  const matches = range.match(/bytes=(\d*)-(\d*)/);
  if (!matches) {
    return [0, size - 1];
  }

  let start = matches[1] ? parseInt(matches[1], 10) : 0;
  let end = matches[2] ? parseInt(matches[2], 10) : size - 1;

  if (start < 0) {
    start = 0;
  }
  if (end >= size) {
    end = size - 1;
  }
  if (start > end) {
    start = end;
  }

  return [start, end];
}

