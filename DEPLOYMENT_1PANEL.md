# Panduan Deployment di 1Panel (VPS)

Dokumen ini menjelaskan langkah-langkah untuk men-deploy aplikasi Finance V3 di VPS menggunakan **1Panel** dan **Docker Compose**.

## Prasyarat

1.  **VPS** dengan OS Linux (Ubuntu/Debian/CentOS).
2.  **1Panel** ternstall dan berjalan.
3.  **Domain** (opsional) jika ingin akses via domain, atau gunakan IP.

## Langkah 1: Persiapan File

Pastikan Anda memiliki file-file berikut di folder project Anda (kami sudah membuatnya):
-   `docker-compose.yml` (di root)
-   `backend/Dockerfile`
-   `frontend/Dockerfile`
-   `frontend/nginx.conf`

## Langkah 2: Upload Project ke VPS

1.  Login ke panel **1Panel** Anda.
2.  Masuk ke menu **Files**.
3.  Buat folder baru, misalnya `/opt/1panel/apps/finance-v3`.
4.  Upload seluruh folder project Anda ke sana.
    *   *Tips: Zip folder project Anda di komputer lokal (`finance-v3.zip`), upload ke 1Panel, lalu Unzip di sana.*

Struktur folder di server harus terlihat seperti ini:
```
/opt/1panel/apps/finance-v3/
├── backend/
│   ├── database/
│   ├── Dockerfile
│   └── ...
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── ...
└── docker-compose.yml
```

## Langkah 3: Konfigurasi Environment (PENTING)

Sebelum menjalankan, Anda perlu menyesuaikan variable environment di `docker-compose.yml` atau membuat file `.env`.
Namun, cara termudah di 1Panel adalah mengedit `docker-compose.yml` langsung di File Manager sebelum deploy, atau saat membuat Stack.

Cek bagian `environment` di service `backend` dalam `docker-compose.yml`.
Variabel **wajib** diisi (di 1Panel: edit file compose / environment sebelum deploy):

```yaml
    environment:
      # PENTING: harus ke database yang SAMA dengan frontend
      # (Postgres Supabase tempat tabel users berada).
      # Contoh: postgresql://postgres:PASSWORD@db-finance.prasastigroup.id:5432/postgres
      DATABASE_URL: postgresql://postgres:PASSWORD@HOST-SUPABASE-ANDA:5432/postgres

      # WAJIB min. 32 char acak — container MENOLAK start bila kosong/lemah.
      # Generate di laptop: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
      JWT_SECRET: PASTE-SECRET-64-CHAR-DISINI

      # URL Frontend (untuk CORS) — harus persis origin frontend
      FRONTEND_URL: https://domain-anda.com

      # Reset password via email (Resend) + link di email
      RESEND_API_KEY: re_xxxxxxxxxxxx
      RESEND_FROM_EMAIL: Finance Prasasti <finance@prasastigroup.id>
      APP_BASE_URL: https://domain-anda.com
```

Variabel lain (Guard, rate-limit) sudah ada default aman di `docker-compose.yml`.

Dan di service `frontend` (`args` = dibakar saat build, jadi ubah → **wajib rebuild**):
```yaml
      args:
        # WAJIB agar login pakai sesi JWT terverifikasi server (bukan flag localStorage)
        VITE_BACKEND_URL: https://api.domain-anda.com
        VITE_SUPABASE_URL: https://db-finance.prasastigroup.id
        VITE_SUPABASE_ANON_KEY: eyJ0eXAiOi...
```

> **Catatan:** Setiap mengubah `args` frontend, Anda **harus build ulang** image frontend (`docker-compose build frontend` atau Rebuild di 1Panel).

## Langkah 3b: Migrasi Database (sekali saja)

Jalankan di **Supabase SQL Editor** (database yang sama dengan `DATABASE_URL` di atas):

1. File `supabase/migrations/add_password_resets.sql` (tabel token reset password).
2. Pastikan tabel `activity_logs` ada (untuk audit login) — dari `supabase/schema.sql` bila instalasi lama belum punya.

## Langkah 4: Jalankan via 1Panel Container

1.  Masuk ke menu **Container** -> **Compose** (atau **Stacks**).
2.  Klik **Create Compose**.
3.  **Name**: `finance-app` (atau nama lain).
4.  **Work Dir**: Pilih folder tempat Anda upload tadi (`/opt/1panel/apps/finance-v3`).
5.  **Serve File**: Pilih `Existing File` lalu pilih `docker-compose.yml` yang ada di folder tersebut.
    *   *Alternatif: Jika Anda ingin copy-paste isi `docker-compose.yml`, pilih "Manual Input" dan paste di editor.*
6.  Klik **Confirm** atau **Deploy**.

1Panel akan mulai mendownload image (Postgres, Node, Nginx), membuild image backend dan frontend Anda, lalu menjalankannya. Proses ini mungkin memakan waktu beberapa menit.

## Langkah 5: Verifikasi & Cek Log

1.  Di daftar **Compose** / **Containers**, pastikan statusnya **Running** (hijau).
2.  Jika ada masalah, klik ikon **Log** pada container `finance-backend` atau `finance-frontend`.
3.  Akses aplikasi via browser: `http://IP-VPS-ANDA` (Default port 80).
4.  Cek kesehatan backend langsung (ganti host backend Anda):
    - `GET https://api.domain-anda.com/api/health` → `{ status: 'ok', ... }`
    - `POST https://api.domain-anda.com/api/auth/login` tanpa body guard → `403 GUARD_REQUIRED` (proteksi aktif)
5.  Login dari frontend → buka DevTools → Application → pastikan ada `authToken` (sesi JWT), bukan cuma flag `isAuthenticated`.
6.  Cek audit: `SELECT action, record_number, new_value, changed_at FROM activity_logs WHERE table_name='auth' ORDER BY changed_at DESC LIMIT 10;`

## Troubleshooting

-   **Database Error**: Cek log `finance-backend`. Pastikan koneksi ke database berhasil. Container database perlu waktu inisialisasi pertama kali. Jika backend restart sendiri di awal, itu normal, dia akan mencoba connect lagi.
-   **API Error**: Jika frontend tidak bisa menghubungi backend, cek `VITE_API_URL`. Pastikan browser Anda bisa mengakses URL tersebut.
-   **Upload Gagal**: Pastikan folder uploads ter-mapping dengan benar di `volumes`.
