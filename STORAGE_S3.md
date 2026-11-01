# Penyimpanan Lampiran: S3 Onidel

Upload baru tidak lagi ke Cloudflare R2. Semua lampiran baru masuk ke bucket S3
`finance` di Onidel. Worker `finance-v3-upload` tetap jadi satu-satunya pintu
masuk, jadi kontrak frontend tidak berubah.

## Kondisi terpasang

| Komponen | Nilai |
| --- | --- |
| Endpoint S3 | `https://s3.ap-southeast-1.onidel.cloud` |
| Region | `ap-southeast-1` |
| Bucket | `finance` (path-style) |
| URL publik file | `https://s3.ap-southeast-1.onidel.cloud/finance/<key>` |
| Worker upload | `https://upload.prasastigroup.id` (custom domain worker `finance-v3-upload`) |
| Worker email | `https://notify.prasastigroup.id` |
| Worker Turnstile | `https://turnstile.prasastigroup.id` |
| File lama | tetap di R2 lewat `https://files.prasastigroup.id` (read-only, tidak dipindah) |

Kredensial S3 hanya ada sebagai secret worker (`S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`). Tidak pernah masuk bundle frontend dan tidak ditulis di
`wrangler.toml`.

## Kenapa pakai custom domain

Domain `*.workers.dev` diblokir sebagian ISP Indonesia: handshake TLS diputus di
tengah jalan, jadi `fetch` gagal (`SEC_E_UNTRUSTED_ROOT` / connect timeout).
Akibatnya upload dan verifikasi Turnstile mati untuk pengguna di jaringan
tersebut. Karena itu ketiga worker memakai subdomain `prasastigroup.id`.

## Struktur folder

Satu folder per jenis dokumen, satu subfolder per nomor dokumen:

```
<documentType>/<NOMOR-DOKUMEN>/<timestamp>-<acak>-<nama-file>
```

Contoh:

```
payment-requests/PR-260909-ZB9WJ7/1793552037938-nfdmaurh-invoice.pdf
klaim/KLM-261101-34KQGM/1793552038627-3g7bqd05-struk.jpg
kasbon/KSN-261101-AB12CD/1793552039128-w5d2oijl-bukti-transfer.pdf
penyelesaian/PNY-261101-XY99ZZ/1793552039736-ygtk8yy5-laporan.pdf
```

Nomor dokumen diambil dari data yang dikirim frontend:

| Jenis | Sumber nomor |
| --- | --- |
| `payment-requests` | `nomorPr` |
| `klaim` | `nomorKlaim` |
| `kasbon` | `nomorKasbon` |
| `penyelesaian` | `nomorPenyelesaian` |
| `recurring` | `transfer-<id>` dan `invoice-<id>` |

Bila `documentId` kosong, file masuk folder `tanpa-nomor` dan worker menulis
peringatan di log — tidak ditolak, supaya upload tidak gagal karena data lama.

## Endpoint worker

| Metode | Path | Fungsi |
| --- | --- | --- |
| `POST` | `/` | multipart `file`, `documentType`, `documentId`, `userName` → `{ url, filePath, ... }` |
| `GET` | `/<key>` | proxy baca objek dari S3 |
| `GET` | `/__list?prefix=&limit=&cursor=` | daftar objek (sweeper file yatim) |
| `DELETE` | `/?key=<key>` | hapus objek |

Balasan `POST` sama bentuknya dengan worker R2 lama, jadi
`frontend/src/utils/r2Upload.js` hanya perlu ganti nilai
`VITE_R2_WORKER_URL`.

## Deploy worker

```bash
cd cloudflare-worker
npx wrangler secret put S3_ACCESS_KEY_ID --config wrangler.toml
npx wrangler secret put S3_SECRET_ACCESS_KEY --config wrangler.toml
npx wrangler deploy --config wrangler.toml
```

Konfigurasi ada di `cloudflare-worker/wrangler.toml` (worker: `s3-upload.js`).
Worker R2 lama (`r2-upload-simple.js`) disimpan hanya sebagai referensi.

## Catatan

- `DELETE_SECRET` belum diset, jadi endpoint hapus terbuka. Isi secret itu lalu
  samakan dengan `VITE_R2_DELETE_KEY` bila ingin hapus file diproteksi.
- Menghapus lampiran lama (URL `files.prasastigroup.id`) lewat worker baru tidak
  menghapus objek R2-nya: worker hanya menyentuh bucket S3. Objek R2 lama
  dibiarkan, sesuai keputusan menyimpan berkas lama apa adanya.
- Bucket `finance` bersifat public-read. Siapa pun yang tahu URL bisa membuka
  file. Nama file memuat timestamp dan 8 karakter acak, jadi tidak mudah ditebak.
