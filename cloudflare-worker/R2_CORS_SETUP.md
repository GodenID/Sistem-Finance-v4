# Konfigurasi CORS untuk Cloudflare R2

## Masalah
File yang diupload ke R2 bisa diakses, tapi ketika dibuka atau didownload dari browser, muncul error CORS atau timeout.

## Solusi 1: Konfigurasi CORS di R2 Bucket (Recommended)

### Via Cloudflare Dashboard:

1. Login ke Cloudflare Dashboard
2. Pilih **R2** dari menu
3. Pilih bucket Anda (misalnya: `finance-v3`)
4. Klik **Settings** tab
5. Scroll ke bagian **CORS Policy**
6. Klik **Edit** atau **Add CORS Policy**
7. Masukkan konfigurasi CORS berikut:

```json
[
  {
    "AllowedOrigins": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD",
      "POST",
      "PUT",
      "DELETE"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type",
      "Last-Modified"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**Untuk Production (lebih aman):**
Ganti `"*"` di `AllowedOrigins` dengan domain frontend Anda:
```json
[
  {
    "AllowedOrigins": [
      "https://your-domain.pages.dev",
      "https://your-custom-domain.com",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type",
      "Last-Modified"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

8. Klik **Save**

### Via Cloudflare API (Alternative):

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets/{bucket_name}/cors" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "cors": [
      {
        "AllowedOrigins": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedHeaders": ["*"],
        "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
        "MaxAgeSeconds": 3600
      }
    ]
  }'
```

## Solusi 2: Menggunakan Worker Proxy (Alternatif)

Jika CORS masih bermasalah, gunakan Worker proxy untuk serve file dengan CORS headers.

Lihat file `r2-proxy.js` untuk implementasi Worker proxy.

## Verifikasi

Setelah konfigurasi CORS:

1. Coba akses file langsung dari browser:
   ```
   https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev/payment-requests/2025/11/pr-0002/file.pdf
   ```

2. Buka Developer Tools (F12) -> Network tab
3. Cek apakah ada error CORS
4. Cek Response Headers, pastikan ada:
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Allow-Methods: GET, HEAD`
   - `Access-Control-Allow-Headers: *`

## Troubleshooting

### Error: "Access to fetch has been blocked by CORS policy"
- Pastikan CORS policy sudah dikonfigurasi di R2 bucket
- Pastikan origin frontend ada di `AllowedOrigins`
- Cek apakah bucket public access sudah di-enable

### Error: "ERR_CONNECTION_TIMED_OUT"
- Cek apakah R2 Public URL benar
- Cek apakah file benar-benar ada di R2 bucket
- Coba akses file langsung dari browser

### Error: "404 Not Found"
- Cek path file di R2 bucket
- Pastikan file sudah terupload dengan benar
- Cek format URL yang disimpan di database

## Catatan Penting

1. **Public Access**: Pastikan bucket sudah di-enable untuk public access
   - R2 Dashboard -> Bucket -> Settings -> Public Access -> Enable

2. **Custom Domain (Optional)**: Untuk production, lebih baik gunakan custom domain
   - R2 Dashboard -> Bucket -> Settings -> Custom Domain
   - Setup domain Anda untuk akses file

3. **Security**: Untuk production, jangan gunakan `"*"` di `AllowedOrigins`
   - Gunakan domain spesifik untuk keamanan lebih baik

