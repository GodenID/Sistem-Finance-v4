# ⚡ Quick Fix - Upload File Gagal

## Masalah yang Sering Terjadi

### 1. Error: CORS Policy Block + 404 Not Found

**Gejala:**
- Error CORS di browser console
- Error 404 saat POST ke Worker
- URL Worker masih `your-account`

## 🚀 Solusi Cepat

### Opsi A: Deploy dengan Wrangler CLI (Recommended) ⚡

#### Step 1: Install Wrangler

```bash
npm install -g wrangler
```

#### Step 2: Login ke Cloudflare

```bash
wrangler login
```

#### Step 3: Edit wrangler.toml

Edit `cloudflare-worker/wrangler.toml`:
- Ganti `bucket_name` dengan nama bucket R2 Anda
- Pastikan `R2_PUBLIC_URL` sudah benar

#### Step 4: Deploy

```bash
cd cloudflare-worker
wrangler deploy
```

#### Step 5: Copy Worker URL

Setelah deploy, copy Worker URL yang ditampilkan.

#### Step 6: Update .env

Edit `.env` di root:
```env
VITE_R2_WORKER_URL=https://r2-upload-worker.xxxxx.workers.dev
```

**Lihat [cloudflare-worker/SETUP_WRANGLER.md](./cloudflare-worker/SETUP_WRANGLER.md) untuk panduan lengkap!**

---

### Opsi B: Deploy via Cloudflare Dashboard

#### Step 1: Deploy Worker di Cloudflare

1. **Buka Cloudflare Dashboard**
   - Login ke https://dash.cloudflare.com/
   - Buka **Workers & Pages**

2. **Buat Worker Baru** (jika belum ada)
   - Klik **"Create Application"** > **"Create Worker"**
   - Nama: `r2-upload-worker` (atau nama lain)
   - Klik **"Deploy"**

3. **Upload Code Worker**
   - Buka file `cloudflare-worker/r2-upload-simple.js`
   - Copy seluruh kode
   - Paste ke Worker editor di Cloudflare
   - Klik **"Save and Deploy"**

### Step 2: Setup R2 Binding

1. Di Worker, buka **Settings** > **Variables** > **R2 Bucket Bindings**
2. Klik **"Add binding"**
3. Isi:
   - **Variable name**: `MY_BUCKET`
   - **R2 bucket**: Pilih bucket R2 Anda
4. Klik **"Save"**

### Step 3: Setup Environment Variables

1. Di Worker, buka **Settings** > **Variables**
2. Tambahkan:
   - **Variable name**: `R2_PUBLIC_URL`
   - **Value**: `https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev`
3. Klik **"Save"**

### Step 4: Dapatkan Worker URL

1. Di halaman Worker, cari **Worker URL**
2. Copy URL (format: `https://r2-upload-worker.xxxxx.workers.dev`)
3. Simpan URL ini

### Step 5: Update .env di Frontend

1. Buka file `.env` di root project
2. Tambahkan atau update:
   ```env
   VITE_R2_WORKER_URL=https://r2-upload-worker.xxxxx.workers.dev
   ```
   (Ganti dengan Worker URL Anda yang sebenarnya)

3. **Save file**

### Step 6: Restart Frontend

1. Stop frontend server (Ctrl+C di terminal)
2. Start lagi:
   ```bash
   npm run dev
   ```
3. **Hard refresh browser** (Ctrl+Shift+R atau Cmd+Shift+R)

### Step 7: Test Upload

1. Buka aplikasi di browser
2. Coba upload file
3. Jika masih error, cek browser console untuk error detail

## ✅ Checklist

Pastikan semua sudah dilakukan:

- [ ] Worker sudah di-deploy di Cloudflare
- [ ] R2 binding sudah di-setup (MY_BUCKET)
- [ ] R2_PUBLIC_URL sudah di-set di Worker
- [ ] Worker URL sudah di-copy
- [ ] VITE_R2_WORKER_URL sudah di-update di .env (bukan placeholder)
- [ ] Frontend sudah di-restart
- [ ] Browser sudah di-hard refresh

## 🔍 Verifikasi

### Test 1: Worker URL

Buka Worker URL di browser:
```
https://r2-upload-worker.xxxxx.workers.dev
```

**Expected:** Error "Method not allowed" (karena GET, bukan POST)
**Jika 404:** Worker belum di-deploy atau URL salah

### Test 2: CORS

Buka browser console dan coba upload file. Seharusnya:
- Tidak ada error CORS
- Request berhasil (status 200)
- File berhasil diupload

### Test 3: File URL

Setelah upload berhasil, cek URL file:
```
https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev/...
```

**Expected:** File bisa dibuka di browser
**Jika 403/404:** Public access belum di-enable di R2 bucket

## 🆘 Masih Error?

Lihat [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) untuk troubleshooting detail.

