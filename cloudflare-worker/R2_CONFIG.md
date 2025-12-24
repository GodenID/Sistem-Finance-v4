# Konfigurasi R2 Public URL

## R2_PUBLIC_URL

URL publik R2 digunakan untuk mengakses file yang sudah diupload. Setelah file diupload ke R2, URL publik akan digunakan untuk preview dan download file.

## Format URL

### R2.dev Domain (Default)
```
https://pub-{account-id}.r2.dev
```

Contoh:
```
https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev
```

### Custom Domain (Recommended untuk Production)
```
https://files.yourdomain.com
```

## Setup di Cloudflare Worker

### 1. Via Cloudflare Dashboard

1. Buka Worker di Cloudflare Dashboard
2. Buka **Settings** > **Variables**
3. Tambahkan environment variable:
   - **Variable name**: `R2_PUBLIC_URL`
   - **Value**: `https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev`
   - **Type**: Plain text (bukan encrypted, karena ini public URL)
4. Klik **"Save"**

### 2. Via Wrangler CLI

```bash
# Set environment variable
wrangler secret put R2_PUBLIC_URL

# Atau langsung di wrangler.toml (untuk non-sensitive data)
# [vars]
# R2_PUBLIC_URL = "https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev"
```

## Cara Mendapatkan R2 Public URL

### Opsi 1: R2.dev Domain (Otomatis)

1. Buka Cloudflare Dashboard > R2
2. Pilih bucket Anda
3. Buka **Settings** > **Public Access**
4. Enable **"Public Access"**
5. URL publik akan otomatis tersedia: `https://pub-{account-id}.r2.dev`

### Opsi 2: Custom Domain (Recommended)

1. Buka Cloudflare Dashboard > R2
2. Pilih bucket Anda
3. Buka **Settings** > **Public Access**
4. Klik **"Connect Domain"**
5. Pilih domain yang sudah ada di Cloudflare atau tambahkan domain baru
6. Setup DNS record sesuai instruksi
7. Setelah domain terhubung, gunakan domain tersebut sebagai R2_PUBLIC_URL

## Contoh Konfigurasi

### Di Worker Environment Variables:

```
R2_PUBLIC_URL=https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev
```

### Hasil URL File:

Setelah file diupload, URL file akan seperti:
```
https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev/payment-requests/2024/11/pr-0001/1699123456789-abc123-invoice.pdf
```

## Catatan Penting

1. **Jangan set di Frontend .env**: R2_PUBLIC_URL hanya digunakan di Worker, bukan di frontend
2. **Public URL**: URL ini bersifat publik, jadi pastikan file yang diupload tidak mengandung informasi sensitif
3. **Custom Domain**: Untuk production, gunakan custom domain untuk branding dan SEO yang lebih baik
4. **CORS**: Pastikan CORS sudah di-setup jika diperlukan untuk akses dari frontend

