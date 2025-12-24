# Cloudflare Worker untuk R2 Upload

Worker ini digunakan untuk mengupload file dari frontend ke Cloudflare R2 dengan struktur folder yang terorganisir.

## Setup

Ada 2 cara untuk setup Worker:
1. **Wrangler CLI** (Recommended) - Lebih cepat dan mudah
2. **Cloudflare Dashboard** - Manual via web interface

### 🚀 Opsi 1: Setup dengan Wrangler CLI (Recommended)

Lihat [SETUP_WRANGLER.md](./SETUP_WRANGLER.md) untuk panduan lengkap dengan Wrangler.

**Quick Start:**
```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Edit wrangler.toml (ganti bucket_name)
# Deploy
cd cloudflare-worker
wrangler deploy
```

### 📋 Opsi 2: Setup via Cloudflare Dashboard

#### 1. Buat Worker di Cloudflare

1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Pilih **Workers & Pages** > **Create Application** > **Create Worker**
3. Nama: `r2-upload-worker` (atau nama lain)
4. Deploy worker kosong dulu

### 2. Setup R2 Binding (Recommended)

**Via Cloudflare Dashboard:**
1. Di Worker, buka **Settings** > **Variables** > **R2 Bucket Bindings**
2. Klik **"Add binding"**
3. Isi:
   - **Variable name**: `MY_BUCKET`
   - **R2 bucket**: Pilih bucket yang sudah dibuat (misalnya: `finance-prasasti`)
4. Klik **"Save"**

**Via wrangler.toml:**
1. Edit `wrangler.toml` dan uncomment bagian R2 bindings
2. Update `bucket_name` dengan nama bucket Anda

### 3. Upload Code

Gunakan salah satu metode:

#### Opsi A: Upload via Dashboard (Recommended untuk testing)

1. Copy kode dari `r2-upload-simple.js` (recommended - menggunakan R2 bindings)
2. Atau `r2-upload-proxy.js` (menggunakan S3 API dengan credentials)
3. Paste ke Cloudflare Workers Editor
4. Klik **"Save and Deploy"**

#### Opsi B: Upload via Wrangler CLI

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login ke Cloudflare
wrangler login

# Deploy worker
cd cloudflare-worker
wrangler deploy --name r2-upload-worker
```

### 4. Setup Environment Variables

Di Cloudflare Dashboard, buka Worker > **Settings** > **Variables**, tambahkan:

**Jika menggunakan R2 Bindings (r2-upload-simple.js):**
- `R2_PUBLIC_URL`: URL publik R2 
  - Format R2.dev: `https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev`
  - Atau custom domain: `https://files.yourdomain.com`

**Jika menggunakan S3 API (r2-upload-proxy.js):**
- `R2_ACCOUNT_ID`: Account ID R2 Anda
- `R2_ACCESS_KEY_ID`: Access Key ID R2 Anda
- `R2_SECRET_ACCESS_KEY`: Secret Access Key R2 Anda (gunakan **"Encrypt"**)
- `R2_BUCKET_NAME`: Nama bucket R2 (misalnya: `finance-prasasti`)
- `R2_PUBLIC_URL`: URL publik R2 (format R2.dev atau custom domain)

**Catatan**: Lihat [R2_CONFIG.md](./R2_CONFIG.md) untuk detail konfigurasi R2_PUBLIC_URL

### 4. Dapatkan Worker URL

Setelah deploy, copy Worker URL:
- Format: `https://r2-upload-worker.your-account.workers.dev`
- Gunakan URL ini untuk `VITE_R2_WORKER_URL` di frontend

## Cara Kerja

1. Frontend mengirim file ke Worker via POST request
2. Worker menerima file dan generate path terorganisir
3. Worker upload file ke R2 menggunakan S3 API
4. Worker return public URL file

## Struktur Folder

File disimpan dengan struktur:
```
{document-type}/{year}/{month}/{document-id}/{timestamp}-{random}-{filename}.{ext}
```

Contoh:
```
payment-requests/2024/11/pr-0001/1699123456789-abc123-invoice.pdf
```

## Testing

### Test via curl

```bash
curl -X POST https://r2-upload-worker.your-account.workers.dev \
  -F "file=@test.pdf" \
  -F "documentType=payment-requests" \
  -F "documentId=PR-0001"
```

### Test via JavaScript

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('documentType', 'payment-requests');
formData.append('documentId', 'PR-0001');

const response = await fetch('https://r2-upload-worker.your-account.workers.dev', {
  method: 'POST',
  body: formData,
});

const data = await response.json();
console.log(data);
```

## Troubleshooting

### Error: Failed to upload to R2

- Pastikan R2 credentials sudah benar
- Pastikan bucket name sudah benar
- Pastikan R2 bucket sudah dibuat

### Error: File size exceeds limit

- File maksimal 10MB
- Cek ukuran file sebelum upload

### Error: CORS error

- Pastikan CORS headers sudah di-setup di Worker
- Pastikan Worker URL sudah benar

## Production

Untuk production:
1. Setup custom domain untuk Worker
2. Enable authentication (optional)
3. Add rate limiting (optional)
4. Monitor usage dan errors

