# 🚀 Deploy Worker dengan Wrangler CLI

Panduan lengkap untuk setup dan deploy Cloudflare Worker menggunakan Wrangler CLI.

## Prerequisites

- Node.js v18 atau lebih baru
- npm atau yarn
- Akun Cloudflare
- Cloudflare R2 bucket sudah dibuat

## 📦 Setup

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

Atau install secara lokal di folder worker:

```bash
cd cloudflare-worker
npm install
```

### 2. Login ke Cloudflare

```bash
wrangler login
```

Ini akan membuka browser untuk autentikasi. Setelah login, Wrangler akan otomatis tersambung ke akun Cloudflare Anda.

### 3. Konfigurasi wrangler.toml

Edit file `wrangler.toml`:

```toml
name = "r2-upload-worker"
main = "r2-upload-simple.js"
compatibility_date = "2024-01-01"

# R2 bucket binding
[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "finance-prasasti"  # Ganti dengan nama bucket Anda

# Environment variables
[vars]
R2_PUBLIC_URL = "https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev"
```

**Catatan**: 
- `bucket_name`: Ganti dengan nama R2 bucket Anda yang sebenarnya
- `R2_PUBLIC_URL`: Gunakan URL R2 public Anda

### 4. Deploy Worker

```bash
cd cloudflare-worker
wrangler deploy
```

Atau jika menggunakan npm script:

```bash
npm run deploy
```

### 5. Dapatkan Worker URL

Setelah deploy berhasil, Wrangler akan menampilkan Worker URL:

```
✨  Successfully published your Worker to the following routes:
   https://r2-upload-worker.your-account.workers.dev
```

Copy URL ini untuk digunakan di frontend `.env`.

## ⚙️ Environment Variables

### Via wrangler.toml (Non-sensitive)

Untuk variable yang tidak sensitif (seperti R2_PUBLIC_URL), bisa langsung di `wrangler.toml`:

```toml
[vars]
R2_PUBLIC_URL = "https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev"
```

### Via wrangler secret (Sensitive)

Untuk variable sensitif (jika menggunakan r2-upload-proxy.js):

```bash
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

Wrangler akan meminta Anda memasukkan value secara interaktif.

## 🔧 Perintah Wrangler

### Deploy

```bash
wrangler deploy
```

### Development (Local)

```bash
wrangler dev
```

Ini akan menjalankan Worker di lokal dengan hot-reload.

### Tail Logs

```bash
wrangler tail
```

Ini akan menampilkan real-time logs dari Worker.

### List Workers

```bash
wrangler deployments list
```

### Delete Worker

```bash
wrangler delete
```

## 📝 Setup Lengkap dengan Wrangler

### Step 1: Install Dependencies

```bash
cd cloudflare-worker
npm install
```

### Step 2: Login

```bash
wrangler login
```

### Step 3: Edit wrangler.toml

Edit `wrangler.toml` dengan konfigurasi Anda:
- Nama Worker
- Nama R2 bucket
- R2_PUBLIC_URL

### Step 4: Deploy

```bash
wrangler deploy
```

### Step 5: Copy Worker URL

Setelah deploy, copy Worker URL yang ditampilkan.

### Step 6: Update Frontend .env

Edit `.env` di root project:

```env
VITE_R2_WORKER_URL=https://r2-upload-worker.your-account.workers.dev
```

## ✅ Verifikasi

### Test Worker

```bash
# Test dengan curl
curl -X POST https://r2-upload-worker.your-account.workers.dev \
  -F "file=@test.pdf" \
  -F "documentType=payment-requests" \
  -F "documentId=PR-0001"
```

### Test dari Browser

Buka Worker URL di browser. Seharusnya return error "Method not allowed" (karena GET, bukan POST).

## 🐛 Troubleshooting

### Error: Authentication required

```bash
wrangler login
```

### Error: Bucket not found

Pastikan:
1. R2 bucket sudah dibuat di Cloudflare Dashboard
2. Nama bucket di `wrangler.toml` sesuai dengan nama bucket yang sebenarnya
3. Anda sudah login dengan akun yang memiliki akses ke bucket tersebut

### Error: Invalid binding

Pastikan format binding di `wrangler.toml` benar:

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

## 📚 Referensi

- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [R2 Bindings](https://developers.cloudflare.com/r2/data-access/workers-api/workers-api-reference/)

