# Backup Worker - Setup Guide

## 🕐 Jadwal Backup
Backup otomatis berjalan setiap hari jam **23:00 WIB** (16:00 UTC).

## 📋 Langkah Deployment

### 1. Pastikan sudah login ke Cloudflare
```bash
cd cloudflare-worker
npx wrangler login
```

### 2. Set Secrets
```bash
# Set Supabase URL
npx wrangler secret put SUPABASE_URL --config wrangler-backup.toml
# Masukkan: https://[project-id].supabase.co

# Set Supabase Anon Key
npx wrangler secret put SUPABASE_ANON_KEY --config wrangler-backup.toml
# Masukkan anon key dari Supabase Dashboard

# Set Backup Secret (untuk trigger manual)
npx wrangler secret put BACKUP_SECRET --config wrangler-backup.toml
# Masukkan password apa saja untuk keamanan
```

### 3. Deploy Worker
```bash
npx wrangler deploy --config wrangler-backup.toml
```

## ✅ Verifikasi
Setelah deploy, cek di Cloudflare Dashboard:
1. Buka Workers & Pages
2. Pilih `finance-v3-backup`
3. Tab "Triggers" → harus tampil cron `0 16 * * *`

## 📁 Dimana Backup Disimpan?
Backup disimpan di R2 bucket `finance-v3` folder `backups/`:
- Path: `backups/backup_YYYY-MM-DD_HH-MM.json`
- Otomatis hapus backup > 30 hari

## 🔧 Manual Trigger
```bash
curl -X POST https://finance-v3-backup.[your-subdomain].workers.dev/backup \
  -H "Authorization: Bearer [BACKUP_SECRET]"
```

## 📊 Lihat Daftar Backup
```bash
curl https://finance-v3-backup.[your-subdomain].workers.dev/backups
```
