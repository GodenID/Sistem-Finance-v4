# Quick Fix: R2 CORS dan URL Setup

## Masalah
- Upload sukses tapi preview/download tidak bisa
- Error CORS di browser
- Error ERR_CONNECTION_TIMED_OUT

## Solusi Cepat

### Step 1: Konfigurasi CORS di R2 (PENTING!)

1. Login ke **Cloudflare Dashboard**
2. Pilih **R2** → Pilih bucket Anda (`finance-v3`)
3. Klik **Settings** tab
4. Scroll ke **CORS Policy** → Klik **Edit** atau **Add CORS Policy**
5. Copy-paste konfigurasi berikut:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type", "Last-Modified"],
    "MaxAgeSeconds": 3600
  }
]
```

6. Klik **Save**

### Step 2: Verifikasi R2_PUBLIC_URL di Worker

1. Buka **Cloudflare Dashboard** → **Workers & Pages**
2. Pilih Worker `r2-upload-worker`
3. Klik **Settings** → **Variables**
4. Pastikan `R2_PUBLIC_URL` sudah di-set:
   ```
   https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev
   ```
   (Tanpa trailing slash di akhir!)

5. Jika belum ada, tambahkan:
   - Key: `R2_PUBLIC_URL`
   - Value: `https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev`

### Step 3: Re-deploy Worker

```bash
cd cloudflare-worker
wrangler deploy
```

### Step 4: Test

1. Upload file baru dari frontend
2. Cek console browser (F12) → Harus muncul:
   ```
   ✅ File uploaded successfully: https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev/...
   ```
3. Klik "Lihat" → Harus langsung buka file di tab baru
4. Klik "Download" → Harus bisa download file

## Verifikasi URL di Database

Jalankan query di Supabase SQL Editor:
```sql
SELECT 
  nomor_pr,
  lampiran,
  CASE 
    WHEN lampiran LIKE 'https://%' THEN '✅ URL Lengkap'
    ELSE '❌ URL Tidak Lengkap'
  END as status
FROM payment_requests
WHERE lampiran IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

Semua URL harus menunjukkan "✅ URL Lengkap"

## Jika Masih Bermasalah

### Error: CORS policy
- ✅ Pastikan CORS sudah dikonfigurasi (Step 1)
- ✅ Tunggu beberapa menit untuk perubahan CORS terpropagasi
- ✅ Clear cache browser

### Error: ERR_CONNECTION_TIMED_OUT
- ✅ Cek apakah R2 Public URL benar
- ✅ Test akses file langsung di browser:
  ```
  https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev/payment-requests/2025/11/pr-0002/file.pdf
  ```
- ✅ Pastikan bucket public access sudah di-enable

### URL Tidak Lengkap
- ✅ Pastikan `R2_PUBLIC_URL` sudah di-set di Worker (Step 2)
- ✅ Re-deploy Worker (Step 3)
- ✅ Upload file baru untuk test

## Dokumentasi Lengkap

- `cloudflare-worker/R2_CORS_SETUP.md` - Konfigurasi CORS detail
- `cloudflare-worker/VERIFY_URL.md` - Verifikasi format URL
- `cloudflare-worker/SETUP_COMPLETE.md` - Setup lengkap

