/**
 * Cloudflare Worker — upload dokumen Finance ke S3 (Onidel, S3-compatible).
 *
 * Kontrak HTTP tetap sama dengan versi R2 supaya frontend tidak perlu diubah:
 *   POST   /              multipart { file, documentType, documentId, userName } -> { url, filePath, ... }
 *   DELETE /<key>         atau /?key=<key>  (header X-Delete-Key bila DELETE_SECRET diset)
 *   GET    /__list        daftar objek: { objects: [{ key, size, uploaded }], truncated, cursor }
 *   GET    /<key>         proxy baca objek (bucket juga public-read)
 *
 * Kredensial S3 hanya ada di worker (secret), tidak pernah sampai ke browser.
 * Semua request ditandatangani SigV4 dengan Web Crypto.
 */

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data;
  return hex(await crypto.subtle.digest('SHA-256', bytes));
}

async function hmac(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? encoder.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data)));
}

/** Encode satu segmen path sesuai aturan SigV4. */
const encodeSegment = (value) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

const encodeKey = (key) => key.split('/').map(encodeSegment).join('/');

/** Query string kanonik: key ter-encode, urut berdasarkan nama. */
function canonicalQuery(params) {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${encodeSegment(k)}=${encodeSegment(String(params[k]))}`)
    .join('&');
}

// ---------------------------------------------------------------------------
// S3 (SigV4)
// ---------------------------------------------------------------------------

function s3Config(env) {
  const endpoint = String(env.S3_ENDPOINT || '').replace(/\/$/, '');
  const bucket = String(env.S3_BUCKET || '').trim();
  if (!endpoint) throw new Error('S3_ENDPOINT belum diset');
  if (!bucket) throw new Error('S3_BUCKET belum diset');
  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error('Kredensial S3 belum diset di worker (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)');
  }
  return {
    endpoint,
    host: new URL(endpoint).host,
    bucket,
    region: env.S3_REGION || 'us-east-1',
    publicUrl: String(env.S3_PUBLIC_URL || `${endpoint}/${bucket}`).replace(/\/$/, ''),
  };
}

/**
 * Tanda tangani lalu kirim request S3.
 * @param {object} cfg hasil s3Config
 * @param {object} env
 * @param {{method: string, key?: string, query?: object, body?: ArrayBuffer|null, contentType?: string}} req
 */
async function s3Fetch(cfg, env, { method, key = '', query = {}, body = null, contentType }) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const canonicalUri = key
    ? `/${encodeSegment(cfg.bucket)}/${encodeKey(key)}`
    : `/${encodeSegment(cfg.bucket)}`;
  const queryString = canonicalQuery(query);
  const payloadHash = await sha256Hex(body || '');

  const canonicalHeaders =
    `host:${cfg.host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    method,
    canonicalUri,
    queryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  let signingKey = await hmac(`AWS4${env.S3_SECRET_ACCESS_KEY}`, dateStamp);
  signingKey = await hmac(signingKey, cfg.region);
  signingKey = await hmac(signingKey, 's3');
  signingKey = await hmac(signingKey, 'aws4_request');
  const signature = hex(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey(
    'raw', signingKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  ), encoder.encode(stringToSign)));

  const url = `${cfg.endpoint}${canonicalUri}${queryString ? `?${queryString}` : ''}`;
  const headers = {
    Host: cfg.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${env.S3_ACCESS_KEY_ID}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
  if (contentType) headers['Content-Type'] = contentType;

  return fetch(url, { method, headers, body: body || undefined });
}

// ---------------------------------------------------------------------------
// Path file
// ---------------------------------------------------------------------------

/**
 * Susun path dokumen: {jenis}/{nomor-dokumen}/{timestamp}-{acak}-{nama-file}
 * Contoh: payment-requests/PR-0001/1730500000000-a1b2c3d4-invoice.pdf
 */
function buildKey(documentType, documentId, originalName) {
  const type = String(documentType || 'uploads')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'uploads';

  const docNumber = String(documentId || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const folder = docNumber ? docNumber.toUpperCase() : 'tanpa-nomor';

  const extension = (String(originalName).split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const baseName = String(originalName)
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9\s_-]/gi, '_')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .substring(0, 60) || 'file';

  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);

  return `${type}/${folder}/${stamp}-${random}-${baseName}.${extension || 'bin'}`;
}

/**
 * Ubah URL publik atau path apa pun menjadi object key murni (tanpa nama bucket).
 * Menerima: URL penuh, "/finance/klaim/..." , atau "klaim/..." .
 */
function normalizeKey(input, bucket) {
  let value = String(input || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return '';
    }
  }
  value = decodeURIComponent(value).replace(/^\/+/, '');
  const prefix = `${bucket}/`;
  if (value.startsWith(prefix)) value = value.slice(prefix.length);
  if (!value || value.includes('..') || value.endsWith('/')) return '';
  return value;
}

// ---------------------------------------------------------------------------
// XML ListObjectsV2
// ---------------------------------------------------------------------------

function decodeXml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseListXml(xml) {
  const objects = [];
  const contents = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) || [];
  for (const block of contents) {
    const key = block.match(/<Key>([\s\S]*?)<\/Key>/);
    const size = block.match(/<Size>([\s\S]*?)<\/Size>/);
    const uploaded = block.match(/<LastModified>([\s\S]*?)<\/LastModified>/);
    if (!key) continue;
    objects.push({
      key: decodeXml(key[1]),
      size: size ? Number(size[1]) : 0,
      uploaded: uploaded ? uploaded[1] : null,
    });
  }
  const truncated = /<IsTruncated>true<\/IsTruncated>/i.test(xml);
  const next = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/);
  return { objects, truncated, cursor: truncated && next ? decodeXml(next[1]) : null };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Delete-Key',
      'Access-Control-Max-Age': '86400',
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    let cfg;
    try {
      cfg = s3Config(env);
    } catch (error) {
      console.error('Konfigurasi S3 tidak lengkap:', error.message);
      return json({ error: error.message }, 500);
    }

    const url = new URL(request.url);

    // Daftar objek untuk sweeper file yatim.
    if (url.pathname === '/__list') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      try {
        const query = {
          'list-type': '2',
          prefix: url.searchParams.get('prefix') || '',
          'max-keys': String(Math.min(Number(url.searchParams.get('limit')) || 500, 1000)),
        };
        const cursor = url.searchParams.get('cursor');
        if (cursor) query['continuation-token'] = cursor;

        const response = await s3Fetch(cfg, env, { method: 'GET', query });
        if (!response.ok) {
          return json({ error: `Gagal membaca storage (${response.status})` }, 502);
        }
        return json(parseListXml(await response.text()));
      } catch (error) {
        console.error('Error list S3:', error);
        return json({ error: error.message }, 500);
      }
    }

    // Hapus objek.
    if (request.method === 'DELETE') {
      const secret = env.DELETE_SECRET?.trim();
      if (secret && request.headers.get('X-Delete-Key') !== secret) {
        return json({ error: 'Delete key salah atau tidak ada' }, 403);
      }
      const key = normalizeKey(url.searchParams.get('key') || url.pathname.slice(1), cfg.bucket);
      if (!key) return json({ error: 'File path required' }, 400);
      try {
        const response = await s3Fetch(cfg, env, { method: 'DELETE', key });
        if (!response.ok && response.status !== 204) {
          return json({ error: `Gagal menghapus file (${response.status})` }, 502);
        }
        console.log('🗑️ File dihapus:', key);
        return json({ success: true, key });
      } catch (error) {
        console.error('Error delete S3:', error);
        return json({ error: error.message }, 500);
      }
    }

    // Proxy baca objek.
    if (request.method === 'GET') {
      const key = normalizeKey(url.pathname.slice(1), cfg.bucket);
      if (!key) return json({ error: 'File path required' }, 400);
      try {
        const response = await s3Fetch(cfg, env, { method: 'GET', key });
        if (!response.ok) {
          return json({ error: 'File not found' }, response.status === 404 ? 404 : 502);
        }
        const headers = new Headers(corsHeaders);
        const contentType = response.headers.get('content-type');
        const etag = response.headers.get('etag');
        if (contentType) headers.set('Content-Type', contentType);
        if (etag) headers.set('ETag', etag);
        const length = response.headers.get('content-length');
        if (length) headers.set('Content-Length', length);
        return new Response(response.body, { headers });
      } catch (error) {
        console.error('Error ambil file S3:', error);
        return json({ error: error.message }, 500);
      }
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // Upload.
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      const documentType = formData.get('documentType') || 'uploads';
      const documentId = formData.get('documentId') || null;
      const userName = formData.get('userName') || null;

      if (!file || typeof file === 'string') {
        return json({ error: 'No file provided' }, 400);
      }
      if (file.size > 10 * 1024 * 1024) {
        return json({ error: 'File size exceeds 10MB limit' }, 400);
      }
      if (!documentId) {
        // Tetap simpan, tapi di folder cadangan supaya tidak bercampur dengan
        // dokumen bernomor. Sebagian besar pemanggil selalu mengirim nomor.
        console.warn('Upload tanpa documentId:', { documentType, userName });
      }

      const key = buildKey(documentType, documentId, file.name);
      const body = await file.arrayBuffer();

      const response = await s3Fetch(cfg, env, {
        method: 'PUT',
        key,
        body,
        contentType: file.type || 'application/octet-stream',
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        console.error('PutObject gagal:', response.status, detail);
        return json({ error: `Upload ke storage gagal (${response.status})` }, 502);
      }

      const publicUrl = `${cfg.publicUrl}/${encodeKey(key)}`;
      console.log('📤 File uploaded:', { key, size: file.size, type: file.type, userName });

      return json({
        success: true,
        url: publicUrl,
        filePath: key,
        fileName: file.name,
        size: file.size,
        type: file.type,
      });
    } catch (error) {
      console.error('Error upload S3:', error);
      return json({ error: error.message }, 500);
    }
  },
};
