# Setup Lengkap R2 dengan CORS

## Checklist Setup

### 1. ✅ R2 Bucket Setup
- [ ] Buat bucket di Cloudflare R2
- [ ] Enable public access untuk bucket
- [ ] Catat R2 Public URL (format: `https://pub-xxxxxxxx.r2.dev`)

### 2. ✅ Worker Upload Setup
- [ ] Deploy Worker `r2-upload-simple.js`
- [ ] Setup R2 bucket binding di `wrangler.toml`
- [ ] Set environment variable `R2_PUBLIC_URL` di Worker
- [ ] Test upload file via Worker

### 3. ✅ CORS Configuration
- [ ] Buka R2 Dashboard -> Bucket -> Settings -> CORS Policy
- [ ] Tambahkan CORS policy (lihat `R2_CORS_SETUP.md`)
- [ ] Test akses file langsung dari browser

### 4. ✅ Frontend Configuration
- [ ] Set `VITE_R2_WORKER_URL` di `.env`
- [ ] Test upload file dari frontend
- [ ] Verifikasi URL yang disimpan di database

### 5. ✅ Verifikasi URL
- [ ] Cek format URL di database (harus lengkap: `https://...`)
- [ ] Test preview file (harus langsung buka di tab baru)
- [ ] Test download file (harus bisa download)

## Troubleshooting

### Masalah: Upload sukses tapi preview/download gagal

**Kemungkinan penyebab:**
1. CORS belum dikonfigurasi ✅ → Lihat `R2_CORS_SETUP.md`
2. URL tidak lengkap ✅ → Lihat `VERIFY_URL.md`
3. R2 bucket tidak public ✅ → Enable public access di R2 Dashboard

### Masalah: ERR_CONNECTION_TIMED_OUT

**Solusi:**
1. Cek apakah R2 Public URL benar
2. Cek apakah file benar-benar ada di R2 bucket
3. Coba akses file langsung di browser
4. Jika masih timeout, gunakan Worker proxy (lihat `r2-proxy.js`)

### Masalah: CORS error di browser

**Solusi:**
1. Pastikan CORS policy sudah dikonfigurasi (lihat `R2_CORS_SETUP.md`)
2. Pastikan origin frontend ada di `AllowedOrigins`
3. Pastikan method `GET` dan `HEAD` ada di `AllowedMethods`

## Testing

### Test 1: Upload File
```bash
# Upload file via Worker
curl -X POST https://r2-upload-worker.selarasprasasti.workers.dev \
  -F "file=@test.pdf" \
  -F "documentType=payment-requests" \
  -F "documentId=pr-0001"
```

Response harus berisi URL lengkap:
```json
{
  "success": true,
  "url": "https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev/payment-requests/2025/11/pr-0001/1762542641923-abc123-test.pdf",
  "filePath": "payment-requests/2025/11/pr-0001/1762542641923-abc123-test.pdf",
  "fileName": "test.pdf",
  "size": 12345,
  "type": "application/pdf"
}
```

### Test 2: Akses File Langsung
Buka URL di browser:
```
https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev/payment-requests/2025/11/pr-0001/1762542641923-abc123-test.pdf
```

Harus bisa:
- ✅ File terbuka di browser (PDF/gambar)
- ✅ Tidak ada error CORS di console
- ✅ Response headers mengandung CORS headers

### Test 3: Download File
Klik tombol "Download" di frontend, harus:
- ✅ File terdownload
- ✅ Tidak ada error di console
- ✅ Nama file benar

## Next Steps

Jika semua sudah berhasil:
1. ✅ Upload file → URL lengkap tersimpan di database
2. ✅ Preview file → Langsung buka di tab baru
3. ✅ Download file → File terdownload dengan benar

Jika masih ada masalah, cek:
1. `R2_CORS_SETUP.md` untuk konfigurasi CORS
2. `VERIFY_URL.md` untuk verifikasi format URL
3. `r2-proxy.js` untuk alternatif menggunakan Worker proxy

