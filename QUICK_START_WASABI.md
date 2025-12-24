# Quick Start: Migrasi ke Wasabi + Cloudflare Pages

## Overview
Panduan cepat untuk migrasi dari R2 ke Wasabi dan deploy frontend ke Cloudflare Pages.

## Step 1: Setup Wasabi (5 menit)

1. **Buat akun Wasabi** → https://wasabi.com
2. **Buat bucket**:
   - Nama: `finance-v3` (atau nama lain sesuai kebutuhan)
   - Region: `ap-southeast-1` (Singapore)
3. **Buat Access Keys**:
   - Copy Access Key ID
   - Copy Secret Access Key (simpan dengan aman!)
4. **Setup Bucket Policy** → Lihat `WASABI_BUCKET_POLICY_QUICK.md` (5 menit setup)

## Step 2: Deploy Wasabi Worker (5 menit)

```bash
cd cloudflare-worker

# Set secrets
wrangler secret put WASABI_ACCESS_KEY
wrangler secret put WASABI_SECRET_KEY

# Edit wrangler-wasabi.toml, uncomment [vars] dan isi:
# WASABI_BUCKET = "finance-v3"  # Ganti dengan nama bucket Anda
# WASABI_REGION = "ap-southeast-1"  # Sesuaikan dengan region bucket
# WASABI_ENDPOINT = "https://s3.ap-southeast-1.wasabisys.com"
# WASABI_PUBLIC_URL = "https://finance-v3.s3.ap-southeast-1.wasabisys.com"

# Deploy
wrangler deploy --config wrangler-wasabi.toml
```

Dapatkan Worker URL: `https://wasabi-upload-worker.your-account.workers.dev`

## Step 3: Update Frontend .env

Edit `.env`:
```env
# Supabase (tetap sama)
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...

# Wasabi Worker URL
VITE_R2_WORKER_URL=https://wasabi-upload-worker.your-account.workers.dev

# Wasabi Public URL (optional)
VITE_WASABI_PUBLIC_URL=https://finance-v3.s3.ap-southeast-1.wasabisys.com
```

## Step 4: Deploy Frontend ke Cloudflare Pages (10 menit)

### Opsi A: Via GitHub (Recommended)

1. **Push code ke GitHub**
   ```bash
   git add .
   git commit -m "Migrate to Wasabi"
   git push origin main
   ```

2. **Cloudflare Dashboard**:
   - Workers & Pages → Create application → Pages
   - Connect to Git → Pilih repository
   - Build settings:
     - Build command: `npm run build`
     - Output directory: `dist`
   - Environment variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_R2_WORKER_URL`
   - Deploy!

### Opsi B: Direct Upload

```bash
# Build lokal
npm run build

# Upload folder dist/ ke Cloudflare Pages
# Via Dashboard: Workers & Pages → Pages → Upload assets
```

## Step 5: Test

1. ✅ Upload file → Harus sukses
2. ✅ Preview file → Harus buka di tab baru
3. ✅ Download file → Harus bisa download
4. ✅ Cek file di Wasabi Console → Harus ada file baru

## Migrasi Data (Optional)

Jika ada data lama di R2 yang perlu dipindah ke Wasabi:

1. **Download semua file dari R2**
2. **Upload ke Wasabi** (via Worker atau Wasabi Console)
3. **Update URL di database** (jika perlu)

## Checklist

- [ ] Wasabi bucket dibuat dan dikonfigurasi
- [ ] Wasabi Worker di-deploy
- [ ] Frontend .env di-update
- [ ] Frontend di-deploy ke Cloudflare Pages
- [ ] Environment variables di-set di Cloudflare Pages
- [ ] Test upload file
- [ ] Test preview/download file

## Dokumentasi Lengkap

- `WASABI_SETUP.md` - Setup Wasabi detail
- `CLOUDFLARE_PAGES_SETUP.md` - Setup Cloudflare Pages detail
- `cloudflare-worker/wasabi-upload.js` - Worker code

## Support

Jika ada masalah:
1. Cek logs di Cloudflare Dashboard
2. Cek console browser (F12)
3. Cek Wasabi Console untuk file upload

