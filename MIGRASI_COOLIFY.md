# Migrasi Supabase ke Postgres Biasa (Coolify)

## Ringkasan

Database pindah ke Postgres biasa di Coolify. Frontend tidak lagi memakai
`@supabase/supabase-js` untuk data. Semua query lewat backend Express
(`/api/data`), yang memegang kredensial database dan mewajibkan sesi JWT.

## Yang berubah di kode

| File | Perubahan |
| --- | --- |
| `backend/routes/data.js` | Baru. Data gateway: list, insert, update, delete, count, revisi tabel. Tabel dan kolom divalidasi dengan allowlist. |
| `backend/index.js` | Mount `/api/data`. |
| `backend/config/database.js` | SSL bisa dikontrol lewat `DATABASE_SSL`. Postgres internal Coolify tidak pakai TLS. |
| `frontend/src/lib/supabase.js` | Diganti jadi klien HTTP ke backend dengan API mirip supabase-js. |
| `frontend/src/hooks/useRealtimeSubscription.js` | Realtime diganti polling revisi tabel tiap 15 detik. |
| `frontend/src/lib/api.js` | Health check memakai `/api/health`. |
| `frontend/vite.config.js` | `@supabase/supabase-js` keluar dari vendor chunk. |
| `frontend/Dockerfile`, `docker-compose.yml` | Build arg `VITE_SUPABASE_*` dihapus. |

## Environment backend

```
DATABASE_URL=postgresql://finance:PASSWORD@<service-uuid>:5432/finance_db
DATABASE_SSL=false
```

`<service-uuid>` adalah hostname internal container Postgres Coolify. Jangan
pakai IP publik.

## Kondisi terpasang (31 Okt 2026)

| Komponen | Nilai |
| --- | --- |
| Postgres Coolify | service `tpv7gy7pp5ezlmmoyqadobnb`, db `finance_db`, user `finance`, image `postgres:15-alpine` |
| Backend | app `finance-backend` (`ab4ww53u7stslvyr3o9rqcqe`), `https://backend-finance.prasastigroup.id` |
| Frontend | Cloudflare Pages `finance-v3` (direct upload), `https://finance.prasastigroup.id` |
| Sumber kode | `https://github.com/GodenID/Sistem-Finance-v4.git`, branch `main` |

Jumlah baris hasil restore sama dengan sumber: users 41, vendors 475,
payment_requests 2452, kasbon 263, klaim 1978, penyelesaian 241,
activity_logs 13871.

Catatan restore:

- Dump Supabase memakai default `extensions.uuid_generate_v4()`. Postgres biasa
  tidak punya schema `extensions`, jadi schema itu harus dibuat dan extension
  `uuid-ossp` + `pgcrypto` dipasang di dalamnya sebelum `pg_restore`.
  `pg_trgm` tetap di schema `public` karena dipakai index trigram.
- Semua primary key bertipe `uuid` dengan default `uuid_generate_v4()`. Tidak ada
  kolom `serial`/`identity`, jadi tidak ada sequence yang perlu di-`setval`.

## Environment frontend (build arg)

```
VITE_BACKEND_URL=https://api.<domain>
```

Wajib. Tanpa ini frontend menampilkan error "VITE_BACKEND_URL belum diset".

## Urutan cutover

1. Dump schema `public` dari Supabase.
2. Buat schema `extensions`, pasang extension, lalu restore.
3. Verifikasi jumlah baris per tabel terhadap sumber.
4. Deploy backend dengan `DATABASE_URL` baru.
5. Build frontend dengan `VITE_BACKEND_URL`, lalu deploy ke Cloudflare Pages.
6. Tes: login, dashboard, list, buat data, upload, logout.
7. Setelah stabil, matikan Supabase.

## Rollback

Frontend: di Cloudflare Pages buka project `finance-v3`, pilih deployment
sebelum cutover, lalu **Rollback to this deployment**. Tidak perlu build ulang.

Backend: kembalikan `DATABASE_URL` ke Supabase lalu deploy ulang. Data yang
dibuat selama jendela cutover harus disalin manual.

Setelah cutover, token API Coolify yang dipakai selama migrasi harus dirotasi.

