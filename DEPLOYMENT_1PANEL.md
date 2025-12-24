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
Pastikan nilai-nilai ini benar:

```yaml
    environment:
      # Database password (sesuaikan jika ingin mengubah)
      POSTGRES_PASSWORD: your_secure_password
      
      # URL Database (internal docker network, biasanya tidak perlu ubah jika pakai postgres container yg sama)
      DATABASE_URL: postgresql://postgres:your_secure_password@postgres:5432/finance_db
      
      # Rahasia JWT
      JWT_SECRET: ganti-dengan-string-acak-yang-panjang
      
      # URL Frontend (untuk CORS)
      FRONTEND_URL: http://IP-VPS-ANDA atau https://domain-anda.com
```

Dan di service `frontend`:
```yaml
      args:
        # URL Backend untuk build frontend
        VITE_API_URL: http://IP-VPS-ANDA:3001/api atau https://api.domain-anda.com
```

> **Catatan:** Jika Anda mengubah `VITE_API_URL`, Anda **harus build ulang** image frontend (`docker-compose build frontend` atau Rebuild di 1Panel).

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

## Troubleshooting

-   **Database Error**: Cek log `finance-backend`. Pastikan koneksi ke database berhasil. Container database perlu waktu inisialisasi pertama kali. Jika backend restart sendiri di awal, itu normal, dia akan mencoba connect lagi.
-   **API Error**: Jika frontend tidak bisa menghubungi backend, cek `VITE_API_URL`. Pastikan browser Anda bisa mengakses URL tersebut.
-   **Upload Gagal**: Pastikan folder uploads ter-mapping dengan benar di `volumes`.
