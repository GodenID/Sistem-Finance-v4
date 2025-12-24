# 🔧 Troubleshooting Guide

Panduan troubleshooting untuk masalah umum saat setup dan menggunakan aplikasi.

## ❌ Error: CORS Policy Block

### Gejala
```
Access to fetch at 'https://r2-upload-worker.your-account.workers.dev/' from origin 'http://localhost:3001' has been blocked by CORS policy
```

### Penyebab
1. Worker belum di-deploy
2. CORS headers tidak dikonfigurasi dengan benar di Worker
3. Worker URL salah

### Solusi

#### 1. Pastikan Worker Sudah Di-deploy

1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Buka **Workers & Pages**
3. Pastikan Worker sudah ada dan statusnya **Active**
4. Jika belum ada, ikuti langkah di [SETUP.md](./SETUP.md) bagian Setup Cloudflare Worker

#### 2. Cek CORS Headers di Worker

Pastikan Worker code menggunakan CORS headers yang benar:

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

#### 3. Redeploy Worker

Setelah memastikan CORS headers benar, redeploy Worker:
1. Di Cloudflare Dashboard, buka Worker
2. Klik **"Save and Deploy"**
3. Tunggu hingga deploy selesai

---

## ❌ Error: 404 Not Found

### Gejala
```
POST https://r2-upload-worker.your-account.workers.dev/ net::ERR_FAILED 404 (Not Found)
```

### Penyebab
1. Worker URL masih menggunakan placeholder `your-account`
2. Worker belum di-deploy
3. Worker name tidak sesuai dengan URL

### Solusi

#### 1. Setup Worker URL di .env

1. Buka file `.env` di root project
2. Tambahkan atau update `VITE_R2_WORKER_URL`:

```env
VITE_R2_WORKER_URL=https://r2-upload-worker.your-actual-account.workers.dev
```

**Cara mendapatkan Worker URL:**
1. Buka Cloudflare Dashboard > Workers & Pages
2. Pilih Worker Anda
3. Copy URL yang terlihat (biasanya di bagian atas atau di Settings)
4. Format: `https://{worker-name}.{account-subdomain}.workers.dev`

#### 2. Deploy Worker

Jika Worker belum di-deploy:

1. Buka Cloudflare Dashboard > Workers & Pages
2. Klik **"Create Application"** > **"Create Worker"**
3. Isi nama Worker (misalnya: `r2-upload-worker`)
4. Copy kode dari `cloudflare-worker/r2-upload-simple.js`
5. Paste ke Worker editor
6. Setup R2 binding dan environment variables
7. Klik **"Save and Deploy"**

#### 3. Restart Frontend

Setelah mengupdate `.env`:
1. Stop frontend server (Ctrl+C)
2. Start lagi: `npm run dev`
3. Hard refresh browser (Ctrl+Shift+R)

---

## ❌ Error: R2 bucket binding not configured

### Gejala
```
Error: R2 bucket binding not configured
```

### Penyebab
R2 bucket binding belum di-setup di Worker

### Solusi

#### Setup R2 Binding di Cloudflare Dashboard

1. Buka Cloudflare Dashboard > Workers & Pages
2. Pilih Worker Anda
3. Buka **Settings** > **Variables** > **R2 Bucket Bindings**
4. Klik **"Add binding"**
5. Isi:
   - **Variable name**: `MY_BUCKET`
   - **R2 bucket**: Pilih bucket yang sudah dibuat
6. Klik **"Save"**
7. Redeploy Worker

---

## ❌ Error: R2_PUBLIC_URL not set

### Gejala
File berhasil diupload tapi URL tidak valid atau tidak bisa diakses

### Penyebab
`R2_PUBLIC_URL` belum di-set di Worker environment variables

### Solusi

1. Buka Cloudflare Dashboard > Workers & Pages
2. Pilih Worker Anda
3. Buka **Settings** > **Variables**
4. Tambahkan environment variable:
   - **Variable name**: `R2_PUBLIC_URL`
   - **Value**: `https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev`
5. Klik **"Save"**
6. Redeploy Worker

Lihat [cloudflare-worker/SETUP_R2_PUBLIC_URL.md](./cloudflare-worker/SETUP_R2_PUBLIC_URL.md) untuk detail.

---

## ❌ Error: Failed to fetch

### Gejala
```
TypeError: Failed to fetch
```

### Penyebab
1. Worker tidak bisa diakses
2. Network error
3. Worker URL salah

### Solusi

1. **Cek Worker URL**
   - Pastikan URL di `.env` sudah benar
   - Pastikan tidak ada typo
   - Pastikan menggunakan `https://`

2. **Test Worker URL**
   - Buka Worker URL di browser
   - Seharusnya return error "Method not allowed" (karena GET, bukan POST)
   - Jika 404, berarti Worker belum di-deploy atau URL salah

3. **Cek Network**
   - Pastikan koneksi internet stabil
   - Cek firewall atau proxy yang mungkin memblokir

4. **Cek Browser Console**
   - Buka Developer Tools > Network tab
   - Lihat request ke Worker
   - Cek status code dan error message

---

## ❌ Error: File tidak bisa di-preview

### Gejala
File berhasil diupload tapi tidak bisa dibuka atau di-preview

### Penyebab
1. Public access belum di-enable di R2 bucket
2. R2_PUBLIC_URL salah
3. File path salah

### Solusi

#### 1. Enable Public Access di R2

1. Buka Cloudflare Dashboard > R2
2. Pilih bucket Anda
3. Buka **Settings** > **Public Access**
4. Enable **"Public Access"**
5. Jika menggunakan custom domain, setup domain terlebih dahulu

#### 2. Cek R2_PUBLIC_URL

Pastikan `R2_PUBLIC_URL` di Worker environment variables menggunakan URL yang benar:
- Format R2.dev: `https://pub-{account-id}.r2.dev`
- Atau custom domain: `https://files.yourdomain.com`

#### 3. Test URL Langsung

Copy URL file dari database atau response Worker, lalu buka di browser:
```
https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev/payment-requests/2024/11/pr-0001/...
```

Jika file bisa dibuka, berarti URL benar. Jika tidak, cek:
- Public access di R2 bucket
- File path di URL
- R2_PUBLIC_URL di Worker

---

## ✅ Checklist Troubleshooting

Jika masih mengalami masalah, cek checklist berikut:

- [ ] Worker sudah di-deploy di Cloudflare
- [ ] Worker URL sudah benar di `.env` (tidak menggunakan placeholder)
- [ ] R2 bucket binding sudah di-setup di Worker
- [ ] R2_PUBLIC_URL sudah di-set di Worker environment variables
- [ ] CORS headers sudah dikonfigurasi di Worker
- [ ] Public access sudah di-enable di R2 bucket
- [ ] Frontend sudah di-restart setelah mengubah `.env`
- [ ] Browser cache sudah di-clear (hard refresh: Ctrl+Shift+R)
- [ ] Network connection stabil
- [ ] Tidak ada firewall atau proxy yang memblokir

---

## 🆘 Masih Bermasalah?

Jika masalah masih belum teratasi:

1. **Cek Log Worker**
   - Buka Cloudflare Dashboard > Workers & Pages
   - Pilih Worker Anda
   - Buka tab **Logs** untuk melihat error detail

2. **Cek Browser Console**
   - Buka Developer Tools (F12)
   - Lihat error di Console dan Network tab
   - Screenshot error untuk referensi

3. **Cek Network Request**
   - Di Network tab, cari request ke Worker
   - Lihat Request URL, Status Code, dan Response
   - Pastikan request method adalah POST

4. **Test Worker Langsung**
   - Gunakan curl atau Postman untuk test Worker
   - Pastikan Worker merespons dengan benar

---

**Need more help?** Lihat dokumentasi:
- [SETUP.md](./SETUP.md) - Panduan setup lengkap
- [cloudflare-worker/README.md](./cloudflare-worker/README.md) - Dokumentasi Worker
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)

