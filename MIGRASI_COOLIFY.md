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

## Environment frontend (build arg)

```
VITE_BACKEND_URL=https://api.<domain>
```

Wajib. Tanpa ini frontend menampilkan error "VITE_BACKEND_URL belum diset".

## Urutan cutover

1. Dump schema `public` dari Supabase.
2. Restore ke Postgres Coolify, buat extension `pgcrypto`, `uuid-ossp`, `pg_trgm`.
3. Set `setval` semua sequence.
4. Deploy backend dengan `DATABASE_URL` baru, cek log `Connected to PostgreSQL database`.
5. Deploy frontend dengan `VITE_BACKEND_URL`, tanpa `VITE_SUPABASE_*`.
6. Tes: login, dashboard, list, buat data, upload, logout.
7. Setelah stabil, matikan Supabase.

## Rollback

Kembalikan `DATABASE_URL` backend ke Supabase dan deploy ulang frontend lama.
Data yang dibuat selama jendela cutover harus disalin manual.
