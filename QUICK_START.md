# 🚀 Quick Start Guide

Panduan cepat untuk menjalankan aplikasi Finance Prasasti.

## Arsitektur

- **Backend**: Supabase (Database & Auth)
- **Storage**: Cloudflare R2 (File attachments via Worker)
- **Frontend**: Cloudflare Pages (Deployment)

## Prerequisites

- Node.js v18+
- Akun Supabase
- Akun Cloudflare dengan R2 dan Workers

## 🏃 Quick Setup

### 1. Setup Supabase

1. Buat project di [Supabase Dashboard](https://app.supabase.com/)
2. Jalankan migration dari `supabase/schema.sql`
3. Buat user default
4. Ambil Project URL dan Anon Key

### 2. Setup Cloudflare R2

1. Buat R2 bucket di Cloudflare Dashboard
2. Buat R2 API token
3. Setup public access (custom domain atau R2.dev)
4. Ambil Account ID, Access Key, Secret Key

### 3. Setup Cloudflare Worker

#### Opsi A: Dengan Wrangler CLI (Recommended) ⚡

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Edit cloudflare-worker/wrangler.toml
# - Ganti bucket_name dengan nama bucket Anda
# - Pastikan R2_PUBLIC_URL sudah benar

# Deploy
cd cloudflare-worker
wrangler deploy

# Copy Worker URL yang ditampilkan
```

Lihat [cloudflare-worker/SETUP_WRANGLER.md](./cloudflare-worker/SETUP_WRANGLER.md) untuk detail.

#### Opsi B: Via Cloudflare Dashboard

1. Buat Worker baru di Cloudflare Dashboard
2. Setup R2 binding (Settings > Variables > R2 Bucket Bindings)
   - Variable name: `MY_BUCKET`
   - R2 bucket: Pilih bucket yang sudah dibuat
3. Copy kode dari `cloudflare-worker/r2-upload-simple.js`
4. Setup environment variables:
   - `R2_PUBLIC_URL`: URL publik R2
5. Deploy Worker
6. Copy Worker URL

### 4. Setup Frontend

```bash
# Install dependencies
npm install

# Copy .env.example to .env
cp .env.example .env

# Edit .env dengan credentials Anda
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your_anon_key
# VITE_R2_WORKER_URL=https://r2-upload-worker.your-account.workers.dev
```

### 5. Run Development

```bash
npm run dev
```

Buka `http://localhost:3000`

## 🚀 Deploy ke Cloudflare Pages

### 1. Push ke Git

```bash
git add .
git commit -m "Initial commit"
git push
```

### 2. Setup Cloudflare Pages

1. Buka Cloudflare Dashboard > Workers & Pages
2. Create Application > Pages > Connect to Git
3. Pilih repository
4. Build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
5. Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_R2_WORKER_URL`
6. Deploy!

## ✅ Verifikasi

1. Login dengan user yang sudah dibuat
2. Test upload file
3. Pastikan file tersimpan di R2

## 📚 Dokumentasi Lengkap

Lihat [SETUP.md](./SETUP.md) untuk panduan lengkap.

---

**Need help?** Lihat [SETUP.md](./SETUP.md) untuk troubleshooting.
