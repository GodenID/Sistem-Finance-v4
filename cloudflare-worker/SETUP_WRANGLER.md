# 🚀 Setup dengan Wrangler CLI

Panduan cepat untuk setup dan deploy Worker menggunakan Wrangler CLI.

## 📋 Prerequisites

- Node.js v18+
- npm atau yarn
- Akun Cloudflare
- R2 bucket sudah dibuat

## ⚡ Quick Setup

### 1. Install Wrangler

```bash
# Global install
npm install -g wrangler

# Atau local install di folder worker
cd cloudflare-worker
npm install
```

### 2. Login ke Cloudflare

```bash
wrangler login
```

Ini akan membuka browser untuk autentikasi.

### 3. Edit wrangler.toml

Edit `cloudflare-worker/wrangler.toml`:

```toml
name = "r2-upload-worker"
main = "r2-upload-simple.js"
compatibility_date = "2024-01-01"

# R2 bucket binding - GANTI dengan nama bucket Anda
[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "finance-prasasti"  # ⚠️ GANTI INI!

# Environment variables
[vars]
R2_PUBLIC_URL = "https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev"  # ✅ Sudah benar
```

**Penting**: Ganti `bucket_name` dengan nama bucket R2 Anda yang sebenarnya!

### 4. Deploy Worker

#### Windows:
```bash
cd cloudflare-worker
deploy.bat
```

#### Linux/Mac:
```bash
cd cloudflare-worker
chmod +x deploy.sh
./deploy.sh
```

#### Manual:
```bash
cd cloudflare-worker
wrangler deploy
```

### 5. Copy Worker URL

Setelah deploy berhasil, Wrangler akan menampilkan Worker URL:

```
✨  Successfully published your Worker to the following routes:
   https://r2-upload-worker.your-account.workers.dev
```

**Copy URL ini!**

### 6. Update Frontend .env

Edit `.env` di root project:

```env
VITE_R2_WORKER_URL=https://r2-upload-worker.your-account.workers.dev
```

(Ganti dengan Worker URL Anda yang sebenarnya)

### 7. Restart Frontend

```bash
# Stop server (Ctrl+C)
# Start lagi
npm run dev
```

## ✅ Verifikasi

### Test Worker

Buka Worker URL di browser:
```
https://r2-upload-worker.your-account.workers.dev
```

**Expected**: Error "Method not allowed" (karena GET, bukan POST)
**Jika 404**: Worker belum di-deploy atau URL salah

### Test Upload

1. Buka aplikasi di browser
2. Coba upload file
3. Cek browser console - tidak ada error CORS atau 404

## 🔧 Perintah Berguna

### Deploy
```bash
wrangler deploy
```

### Development (Local)
```bash
wrangler dev
```

### Tail Logs
```bash
wrangler tail
```

### List Deployments
```bash
wrangler deployments list
```

### Delete Worker
```bash
wrangler delete
```

## 🐛 Troubleshooting

### Error: Authentication required
```bash
wrangler login
```

### Error: Bucket not found
- Pastikan bucket sudah dibuat di Cloudflare Dashboard
- Pastikan nama bucket di `wrangler.toml` benar
- Pastikan sudah login dengan akun yang benar

### Error: Invalid binding
Pastikan format di `wrangler.toml`:
```toml
[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "your-bucket-name"
```

### Update Worker
Setelah mengubah kode, deploy lagi:
```bash
wrangler deploy
```

## 📚 Dokumentasi

- [README_WRANGLER.md](./README_WRANGLER.md) - Dokumentasi lengkap Wrangler
- [README.md](./README.md) - Dokumentasi umum Worker
- [Wrangler Docs](https://developers.cloudflare.com/workers/wrangler/)

---

**Selamat! Worker sudah di-deploy dengan Wrangler! 🎉**

