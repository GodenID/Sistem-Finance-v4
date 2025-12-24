# Setup Wasabi Storage untuk Aplikasi

## Overview
Wasabi adalah object storage yang kompatibel dengan S3 API, lebih murah dari AWS S3 dan cocok untuk storage file.

## Step 1: Buat Akun Wasabi

1. Kunjungi https://wasabi.com
2. Buat akun baru (Free trial tersedia)
3. Login ke Wasabi Console

## Step 2: Buat Bucket

1. Login ke **Wasabi Console** (https://console.wasabi.com)
2. Klik **"Create Bucket"**
3. Masukkan nama bucket (contoh: `finance-prasasti`)
4. Pilih region (disarankan: **ap-southeast-1** - Singapore untuk Indonesia)
5. Pilih **"Standard Storage Class"**
6. Klik **"Create Bucket"**

## Step 3: Setup Bucket Public Access

**Lihat panduan lengkap di: `WASABI_BUCKET_POLICY_SETUP.md`**

### Quick Setup:

1. Pilih bucket yang baru dibuat
2. Klik tab **"Access Control"** atau **"Policies"**
3. Di bagian **"Bucket Policy"**, klik **"Edit"**
4. Copy-paste policy berikut (ganti `finance-v3` dengan nama bucket Anda yang sebenarnya - lihat ARN di atas editor):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::finance-v3/*"
    }
  ]
}
```

**⚠️ PENTING**: 
- Pastikan nama bucket di `Resource` sama dengan ARN yang ditampilkan di atas editor!
- Jika muncul warning "Public Access", enable public access terlebih dahulu (lihat `WASABI_BUCKET_POLICY_FIX.md`)

5. Klik **"Save"**
6. (Optional) Setup CORS jika diperlukan (lihat `WASABI_BUCKET_POLICY_SETUP.md`)

## Step 4: Buat Access Keys

1. Di Wasabi Console, klik **"Access Keys"** di menu sidebar
2. Klik **"Create New Access Key"**
3. Masukkan nama (contoh: "finance-app")
4. Klik **"Create Access Key"**
5. **PENTING**: Copy dan simpan:
   - **Access Key ID**
   - **Secret Access Key** (hanya muncul sekali!)

## Step 5: Setup Cloudflare Worker

### 5.1. Deploy Worker

1. Buka terminal di folder `cloudflare-worker`
2. Install dependencies (jika perlu):
   ```bash
   npm install
   ```

3. Set secrets (credentials Wasabi):
   ```bash
   wrangler secret put WASABI_ACCESS_KEY
   # Paste Access Key ID ketika diminta
   
   wrangler secret put WASABI_SECRET_KEY
   # Paste Secret Access Key ketika diminta
   ```

4. Set environment variables:
   ```bash
   # Via wrangler.toml atau Cloudflare Dashboard
   # Edit wrangler-wasabi.toml dan uncomment [vars] section
   ```

5. Deploy Worker:
   ```bash
   wrangler deploy --config wrangler-wasabi.toml
   ```

### 5.2. Setup via Cloudflare Dashboard (Alternatif)

1. Buka **Cloudflare Dashboard** → **Workers & Pages**
2. Klik **"Create Worker"**
3. Nama: `wasabi-upload-worker`
4. Copy-paste kode dari `wasabi-upload.js`
5. Klik **"Save and Deploy"**
6. Klik **"Settings"** → **"Variables"**
7. Tambahkan secrets:
   - `WASABI_ACCESS_KEY` (type: Secret)
   - `WASABI_SECRET_KEY` (type: Secret)
8. Tambahkan variables:
   - `WASABI_BUCKET` = nama bucket Anda (contoh: `finance-prasasti`)
   - `WASABI_REGION` = `ap-southeast-1`
   - `WASABI_ENDPOINT` = `https://s3.ap-southeast-1.wasabisys.com`
   - `WASABI_PUBLIC_URL` = `https://finance-prasasti.s3.ap-southeast-1.wasabisys.com`
     (atau custom domain jika ada)

## Step 6: Update Frontend

1. Edit file `.env`:
   ```env
   # Wasabi Worker URL
   VITE_R2_WORKER_URL=https://wasabi-upload-worker.your-account.workers.dev
   
   # Wasabi Public URL (optional, untuk fallback)
   VITE_WASABI_PUBLIC_URL=https://finance-prasasti.s3.ap-southeast-1.wasabisys.com
   ```

2. Frontend akan otomatis menggunakan Worker URL untuk upload

## Step 7: Test Upload

1. Jalankan aplikasi frontend
2. Coba upload file
3. Cek console browser → harus muncul URL Wasabi
4. Cek file di Wasabi Console → harus ada file baru

## Step 8: Setup Custom Domain (Optional)

Jika ingin menggunakan custom domain untuk file:

1. Di Wasabi Console, pilih bucket
2. Klik tab **"Domain"**
3. Setup custom domain (misalnya: `cdn.yourdomain.com`)
4. Update DNS records sesuai instruksi
5. Update `WASABI_PUBLIC_URL` di Worker variables

## Troubleshooting

### Error: "Wasabi credentials not configured"
- Pastikan `WASABI_ACCESS_KEY` dan `WASABI_SECRET_KEY` sudah di-set sebagai secrets
- Pastikan `WASABI_BUCKET` sudah di-set sebagai variable

### Error: "403 Forbidden"
- Pastikan bucket policy sudah dikonfigurasi untuk public read
- Pastikan Access Key memiliki permission untuk upload

### Error: "Bucket not found"
- Pastikan nama bucket benar
- Pastikan region benar
- Pastikan endpoint URL benar

### File tidak bisa diakses
- Pastikan bucket policy sudah allow public read
- Cek URL file di browser
- Pastikan `WASABI_PUBLIC_URL` benar

## Harga Wasabi

- **Storage**: $6.99/TB/bulan (lebih murah dari AWS S3)
- **Egress**: Free (tidak ada biaya untuk download)
- **Free Trial**: 30 hari dengan 1TB storage

## Referensi

- Wasabi Documentation: https://wasabi.com/api-docs/
- Wasabi Console: https://console.wasabi.com
- S3 API Compatibility: Wasabi 100% kompatibel dengan S3 API

