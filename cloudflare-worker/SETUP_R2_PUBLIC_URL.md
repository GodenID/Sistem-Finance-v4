# Setup R2_PUBLIC_URL di Cloudflare Worker

## URL Anda

```
https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev
```

## Langkah Setup

### 1. Buka Cloudflare Dashboard

1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Pilih akun Cloudflare Anda
3. Buka **Workers & Pages**
4. Pilih Worker yang sudah Anda buat (misalnya: `r2-upload-worker`)

### 2. Setup Environment Variable

1. Di halaman Worker, buka **Settings** > **Variables**
2. Scroll ke bagian **Environment Variables**
3. Klik **"Add variable"** atau **"Edit variables"**
4. Tambahkan variable baru:
   - **Variable name**: `R2_PUBLIC_URL`
   - **Value**: `https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev`
   - **Type**: Plain text (bukan encrypted, karena ini public URL)
5. Klik **"Save"**

### 3. Redeploy Worker (Jika Perlu)

Jika Worker sudah di-deploy sebelumnya, Anda perlu redeploy untuk menerapkan environment variable baru:

1. Buka tab **Deployments**
2. Klik **"Retry deployment"** atau buat deployment baru
3. Pastikan environment variable sudah ter-load

### 4. Verifikasi

Setelah setup, test upload file dari frontend. URL file yang di-return dari Worker seharusnya menggunakan R2_PUBLIC_URL Anda:

```
https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev/payment-requests/2024/11/pr-0001/1699123456789-abc123-file.pdf
```

## Troubleshooting

### URL tidak berubah setelah setup

- Pastikan Worker sudah di-redeploy setelah menambahkan environment variable
- Cek di Worker logs apakah R2_PUBLIC_URL sudah ter-load
- Pastikan nama variable adalah `R2_PUBLIC_URL` (case-sensitive)

### File tidak bisa diakses

- Pastikan public access sudah di-enable di R2 bucket
- Pastikan URL menggunakan format yang benar (dengan `https://`)
- Cek di R2 bucket apakah file sudah terupload

## Catatan

- R2_PUBLIC_URL hanya digunakan di Worker, bukan di frontend `.env`
- Frontend akan mendapatkan public URL dari response Worker setelah upload
- URL ini bersifat publik, pastikan file yang diupload tidak mengandung informasi sensitif

