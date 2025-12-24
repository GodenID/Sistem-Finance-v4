# Struktur Folder R2 Cloudflare

## Struktur Organisasi File

File lampiran di R2 Cloudflare diorganisir dengan struktur folder yang rapi berdasarkan jenis dokumen, tahun, bulan, dan ID dokumen.

### Format Struktur Folder

```
{document-type}/{year}/{month}/{document-id}/{timestamp}-{random}-{sanitized-filename}.{ext}
```

### Contoh Struktur

```
payment-requests/
  ├── 2024/
  │   ├── 11/
  │   │   ├── pr-0001/
  │   │   │   ├── 1699123456789-abc123-invoice_vendor.pdf
  │   │   │   └── 1699123457901-xyz456-bukti_transfer.pdf
  │   │   ├── pr-0002/
  │   │   │   └── 1699123567890-def789-kwitansi.pdf
  │   │   └── pr-0003/
  │   │       └── 1699123678901-ghi012-receipt.pdf
  │   └── 12/
  │       └── pr-0004/
  │           └── 1701234567890-jkl345-invoice.pdf
  └── 2025/
      └── 01/
          └── pr-0005/
              └── 1704567890123-mno678-document.pdf

klaim/
  ├── 2024/
  │   └── 11/
  │       ├── klm-0001/
  │       │   └── 1699123456789-abc123-tiket_pesawat.pdf
  │       └── klm-0002/
  │           └── 1699123567890-def789-hotel_receipt.pdf

penyelesaian/
  ├── 2024/
  │   └── 11/
  │       ├── pln-0001/
  │       │   └── 1699123456789-abc123-bukti_penyelesaian.pdf
  │       └── pln-0002/
  │           └── 1699123567890-def789-kwitansi.pdf

kasbon/
  ├── 2024/
  │   └── 11/
  │       ├── kb-0001/
  │       │   └── 1699123456789-abc123-bukti_kasbon.pdf
  │       └── kb-0002/
  │           └── 1699123567890-def789-receipt.pdf
```

## Komponen Path

### 1. Document Type
Jenis dokumen yang menentukan folder utama:
- `payment-requests` - Payment Request
- `klaim` - Klaim
- `penyelesaian` - Penyelesaian
- `kasbon` - Kasbon
- `uploads` - Upload umum (fallback)

### 2. Year
Tahun upload file (format: YYYY, contoh: 2024, 2025)

### 3. Month
Bulan upload file (format: MM, contoh: 01-12)

### 4. Document ID
ID dokumen yang diambil dari nomor dokumen:
- Payment Request: `PR-0001` → folder `pr-0001`
- Klaim: `KLM-0001` → folder `klm-0001`
- Penyelesaian: `PLN-0001` → folder `pln-0001`
- Kasbon: `KB-0001` → folder `kb-0001`

Document ID akan di-sanitize (lowercase, replace special chars dengan underscore).

### 5. Filename
Format: `{timestamp}-{random}-{sanitized-filename}.{extension}`

- **timestamp**: Unix timestamp (milliseconds) saat upload
- **random**: Random string (8 karakter) untuk uniqueness
- **sanitized-filename**: Nama file asli yang di-sanitize:
  - Convert to lowercase
  - Replace special characters dengan underscore
  - Replace spaces dengan underscore
  - Limit panjang maksimal 50 karakter
- **extension**: Extension file (lowercase)

## Keuntungan Struktur Ini

1. **Terorganisir**: File dikelompokkan berdasarkan jenis, waktu, dan dokumen
2. **Mudah Dicari**: Struktur folder memudahkan pencarian file berdasarkan tahun/bulan/dokumen
3. **Skalabel**: Struktur dapat menampung banyak file tanpa masalah
4. **Maintainable**: Mudah untuk maintenance dan cleanup file lama
5. **Unik**: Setiap file memiliki nama unik dengan timestamp dan random string
6. **SEO Friendly**: Nama file yang di-sanitize lebih baik untuk URL

## Contoh URL Publik

Setelah file diupload, URL publik akan seperti:
```
https://your-r2-domain.com/payment-requests/2024/11/pr-0001/1699123456789-abc123-invoice_vendor.pdf
```

## Catatan

- Jika document ID tidak tersedia saat upload, akan digunakan random string sebagai folder
- File yang diupload akan otomatis memiliki URL publik untuk preview/download
- Nama file asli tetap disimpan di metadata untuk referensi

