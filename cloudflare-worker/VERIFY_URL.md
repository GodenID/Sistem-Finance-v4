# Verifikasi Format URL yang Disimpan

## Masalah
URL yang disimpan di database mungkin tidak lengkap atau formatnya salah.

## Format URL yang Benar

URL yang dikembalikan oleh Worker seharusnya dalam format:
```
https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev/{filePath}
```

Contoh:
```
https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev/payment-requests/2025/11/pr-0002/1762542641923-abc123-filename.pdf
```

## Cara Verifikasi

### 1. Cek URL di Database

Jalankan query di Supabase SQL Editor:
```sql
SELECT 
  id,
  nomor_pr,
  lampiran,
  LENGTH(lampiran) as url_length,
  CASE 
    WHEN lampiran LIKE 'http%' THEN 'URL Lengkap'
    ELSE 'URL Tidak Lengkap'
  END as status_url
FROM payment_requests
WHERE lampiran IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

### 2. Cek Format URL di Console

Setelah upload file, cek di browser console:
- Buka Developer Tools (F12)
- Lihat console log: `✅ File uploaded successfully: {url}`
- Pastikan URL dimulai dengan `https://`

### 3. Test URL Langsung

Copy URL dari database dan coba akses langsung di browser:
```
https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev/payment-requests/2025/11/pr-0002/1762542641923-abc123-filename.pdf
```

Jika muncul error atau tidak bisa diakses, kemungkinan:
1. File belum terupload ke R2
2. Path file salah
3. R2 bucket tidak public
4. CORS belum dikonfigurasi

## Perbaikan

### Jika URL Tidak Lengkap

1. **Cek Worker Code**: Pastikan Worker mengembalikan URL lengkap
   ```javascript
   const publicUrl = `${env.R2_PUBLIC_URL}/${filePath}`;
   ```

2. **Cek Environment Variable**: Pastikan `R2_PUBLIC_URL` sudah di-set di Worker
   - Cloudflare Dashboard -> Workers -> r2-upload-worker -> Settings -> Variables
   - Atau di `wrangler.toml`:
     ```toml
     [vars]
     R2_PUBLIC_URL = "https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev"
     ```

3. **Re-deploy Worker**: Setelah update, re-deploy Worker
   ```bash
   cd cloudflare-worker
   wrangler deploy
   ```

### Jika URL Lengkap Tapi Tidak Bisa Diakses

1. **Cek R2 Bucket**: Pastikan bucket public access sudah di-enable
2. **Cek CORS**: Lihat `R2_CORS_SETUP.md` untuk konfigurasi CORS
3. **Cek File di R2**: Pastikan file benar-benar ada di bucket

## Debug URL di Frontend

Tambahkan console.log di `src/utils/r2Upload.js`:
```javascript
const data = await response.json();
console.log('✅ File uploaded successfully:', data.url);
console.log('📁 File path:', data.filePath);
console.log('🔗 Full URL:', data.url);

// Verifikasi URL
if (!data.url.startsWith('http')) {
  console.error('❌ URL tidak lengkap!', data.url);
}
```

