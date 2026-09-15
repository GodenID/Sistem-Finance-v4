# Resend Email Notification Setup

Worker ini dipakai untuk mengirim email saat Finance menandai Payment Request, Kasbon, atau Klaim sebagai `Sudah Transfer`.

## 1. Buat API key Resend

1. Login ke `https://resend.com`.
2. Verifikasi domain pengirim jika ingin memakai email perusahaan.
3. Buat API key.

## 2. Set sender email

Edit `wrangler-resend.toml`:

```toml
[vars]
RESEND_FROM_EMAIL = "Finance Prasasti <finance@prasastigroup.com>"
```

Untuk domain `prasastigroup.id` yang sudah verified di Resend, contoh sender:

```toml
[vars]
RESEND_FROM_EMAIL = "Finance Prasasti <finance@prasastigroup.id>"
```

Pastikan alamat pengirim memakai domain yang sudah verified di Resend.

## 3. Simpan API key sebagai secret

```bash
cd cloudflare-worker
npx wrangler secret put RESEND_API_KEY --config wrangler-resend.toml
```

## 4. Deploy Worker

```bash
npx wrangler deploy --config wrangler-resend.toml
```

## 5. Set URL Worker di frontend

Pastikan environment frontend berisi:

```env
VITE_EMAIL_NOTIFICATION_URL=https://finance-v3-email.<account>.workers.dev
```

Setelah mengubah env, build dan deploy ulang frontend.

## 6. Jalankan migration database

Jalankan SQL ini di Supabase SQL Editor:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

Atau jalankan file:

```text
supabase/migrations/add_user_email.sql
```
