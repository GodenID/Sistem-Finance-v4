# Deployment Checklist - Wasabi + Cloudflare Pages

## ✅ Pre-Deployment

### 1. Wasabi Setup
- [ ] Buat akun Wasabi
- [ ] Buat bucket (nama: `finance-prasasti`, region: `ap-southeast-1`)
- [ ] Buat Access Keys (simpan dengan aman!)
- [ ] Setup bucket policy untuk public read
- [ ] Test akses bucket

### 2. Cloudflare Worker Setup
- [ ] Deploy Wasabi Worker
- [ ] Set secrets: `WASABI_ACCESS_KEY`, `WASABI_SECRET_KEY`
- [ ] Set variables: `WASABI_BUCKET`, `WASABI_REGION`, `WASABI_ENDPOINT`, `WASABI_PUBLIC_URL`
- [ ] Test upload via Worker

### 3. Frontend Preparation
- [ ] Update `.env` dengan Wasabi Worker URL
- [ ] Test build lokal: `npm run build`
- [ ] Test aplikasi lokal: `npm run dev`
- [ ] Pastikan semua fitur bekerja

### 4. Database Setup
- [ ] Supabase project sudah dibuat
- [ ] Schema sudah di-apply
- [ ] RLS policies sudah dikonfigurasi
- [ ] Test koneksi database

## 🚀 Deployment

### 1. Deploy Worker
```bash
cd cloudflare-worker
wrangler deploy --config wrangler-wasabi.toml
```

### 2. Deploy Frontend ke Cloudflare Pages

**Via GitHub:**
- [ ] Push code ke GitHub
- [ ] Connect repository ke Cloudflare Pages
- [ ] Set build settings
- [ ] Set environment variables
- [ ] Deploy

**Via Direct Upload:**
- [ ] Build: `npm run build`
- [ ] Upload folder `dist/` ke Cloudflare Pages

### 3. Environment Variables di Cloudflare Pages
- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] `VITE_R2_WORKER_URL` (Wasabi Worker URL)

## 🧪 Post-Deployment Testing

### 1. Test Upload
- [ ] Upload file dari frontend
- [ ] Cek console → harus muncul URL Wasabi
- [ ] Cek Wasabi Console → file harus ada

### 2. Test Preview/Download
- [ ] Klik "Lihat" → harus buka file di tab baru
- [ ] Klik "Download" → harus bisa download
- [ ] Test berbagai format file (PDF, gambar, Excel)

### 3. Test Fitur Lain
- [ ] Login/Logout
- [ ] Create Payment Request
- [ ] Edit/Delete (untuk manager)
- [ ] Approval (untuk manager)
- [ ] Vendor management
- [ ] Employee management

## 📋 Configuration Files

### Files yang perlu di-update:
- [ ] `.env` - Environment variables lokal
- [ ] `cloudflare-worker/wrangler-wasabi.toml` - Worker config
- [ ] Cloudflare Dashboard - Worker secrets & variables
- [ ] Cloudflare Pages - Environment variables

### Files yang sudah dibuat:
- [x] `WASABI_SETUP.md` - Setup Wasabi
- [x] `CLOUDFLARE_PAGES_SETUP.md` - Setup Cloudflare Pages
- [x] `QUICK_START_WASABI.md` - Quick start guide
- [x] `cloudflare-worker/wasabi-upload-v2.js` - Worker code
- [x] `public/_redirects` - Cloudflare Pages redirects

## 🔍 Troubleshooting

### Worker tidak bisa upload
- [ ] Cek Wasabi credentials
- [ ] Cek bucket name dan region
- [ ] Cek Worker logs di Cloudflare Dashboard

### Frontend build failed
- [ ] Cek build command: `npm run build`
- [ ] Cek output directory: `dist`
- [ ] Cek environment variables

### File tidak bisa diakses
- [ ] Cek bucket policy (harus allow public read)
- [ ] Cek URL format (harus lengkap)
- [ ] Test URL langsung di browser

## 📞 Support

Jika ada masalah:
1. Cek dokumentasi di folder `cloudflare-worker/`
2. Cek logs di Cloudflare Dashboard
3. Cek console browser (F12)

