# Setup Wasabi + Cloudflare Pages - Panduan Lengkap

## 🎯 Overview

Aplikasi ini menggunakan:
- **Frontend**: React + Vite (deploy di Cloudflare Pages)
- **Backend**: Supabase (PostgreSQL + Auth)
- **Storage**: Wasabi (S3-compatible object storage)
- **Worker**: Cloudflare Worker untuk upload file ke Wasabi

## 📋 Quick Start

Ikuti panduan di `QUICK_START_WASABI.md` untuk setup cepat (15 menit).

## 📚 Dokumentasi Lengkap

1. **`WASABI_SETUP.md`** - Setup Wasabi bucket dan credentials
2. **`CLOUDFLARE_PAGES_SETUP.md`** - Setup deploy frontend ke Cloudflare Pages
3. **`QUICK_START_WASABI.md`** - Quick start guide

## 🚀 Setup Step-by-Step

### 1. Setup Wasabi

```bash
# 1. Buat akun Wasabi → https://wasabi.com
# 2. Buat bucket (region: ap-southeast-1)
# 3. Buat Access Keys
# 4. Setup bucket policy untuk public read
```

Lihat `WASABI_SETUP.md` untuk detail.

### 2. Deploy Wasabi Worker

```bash
cd cloudflare-worker

# Set secrets
wrangler secret put WASABI_ACCESS_KEY
wrangler secret put WASABI_SECRET_KEY

# Edit wrangler-wasabi.toml, uncomment [vars] section
# Deploy
wrangler deploy --config wrangler-wasabi.toml
```

### 3. Update Frontend

Edit `.env`:
```env
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
VITE_R2_WORKER_URL=https://wasabi-upload-worker.your-account.workers.dev
```

### 4. Deploy Frontend ke Cloudflare Pages

```bash
# Build
npm run build

# Deploy via Cloudflare Dashboard
# Atau push ke GitHub untuk auto-deploy
```

Lihat `CLOUDFLARE_PAGES_SETUP.md` untuk detail.

## 📁 Struktur File

```
PWS/
├── src/                    # Frontend code
├── cloudflare-worker/      # Cloudflare Workers
│   ├── wasabi-upload.js    # Worker untuk upload ke Wasabi
│   ├── wrangler-wasabi.toml
│   └── ...
├── supabase/               # Database schema
├── public/                 # Static assets
│   └── _redirects          # Cloudflare Pages redirects
├── .env                    # Environment variables (local)
└── ...
```

## 🔧 Environment Variables

### Frontend (.env)
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_R2_WORKER_URL=https://wasabi-upload-worker.workers.dev
```

### Cloudflare Worker (via Dashboard atau wrangler.toml)
```
WASABI_ACCESS_KEY (secret)
WASABI_SECRET_KEY (secret)
WASABI_BUCKET=finance-prasasti
WASABI_REGION=ap-southeast-1
WASABI_ENDPOINT=https://s3.ap-southeast-1.wasabisys.com
WASABI_PUBLIC_URL=https://finance-prasasti.s3.ap-southeast-1.wasabisys.com
```

### Cloudflare Pages (via Dashboard)
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_R2_WORKER_URL
```

## 🧪 Testing

### Test Upload
1. Upload file dari frontend
2. Cek console → harus muncul URL Wasabi
3. Cek Wasabi Console → harus ada file baru

### Test Preview/Download
1. Klik "Lihat" → harus buka file di tab baru
2. Klik "Download" → harus bisa download

## 🐛 Troubleshooting

### Upload Failed
- Cek Wasabi credentials di Worker
- Cek bucket name dan region
- Cek Worker logs di Cloudflare Dashboard

### Preview/Download Failed
- Cek bucket policy (harus allow public read)
- Cek URL format (harus lengkap: https://...)
- Cek CORS settings di Wasabi

### Build Failed di Cloudflare Pages
- Cek build command: `npm run build`
- Cek output directory: `dist`
- Cek environment variables

## 📖 Referensi

- Wasabi Docs: https://wasabi.com/api-docs/
- Cloudflare Pages: https://developers.cloudflare.com/pages/
- Cloudflare Workers: https://developers.cloudflare.com/workers/

