# 🚀 Panduan Setup Aplikasi Finance Prasasti

Panduan lengkap untuk setup aplikasi Finance Prasasti dengan arsitektur:
- **Backend**: Supabase (Database & Authentication)
- **Storage**: Cloudflare R2 (File attachments)
- **Frontend**: Cloudflare Pages (Deployment)

## 📋 Prerequisites

Sebelum memulai, pastikan Anda sudah memiliki:
- [Node.js](https://nodejs.org/) (v18 atau lebih baru)
- [npm](https://www.npmjs.com/) atau [yarn](https://yarnpkg.com/)
- Akun [Supabase](https://supabase.com/)
- Akun [Cloudflare](https://cloudflare.com/) dengan akses R2 dan Workers
- Git repository (untuk deployment ke Cloudflare Pages)

---

## 🗄️ 1. Setup Supabase

### 1.1 Buat Project Supabase

1. Login ke [Supabase Dashboard](https://app.supabase.com/)
2. Klik **"New Project"**
3. Isi informasi project:
   - **Name**: Finance Prasasti (atau nama lain)
   - **Database Password**: Buat password yang kuat
   - **Region**: Pilih region terdekat (misalnya Southeast Asia)
4. Klik **"Create new project"** dan tunggu hingga project selesai dibuat

### 1.2 Setup Database Schema

1. Di Supabase Dashboard, buka **SQL Editor**
2. Buka file `supabase/schema.sql` di project ini
3. Copy seluruh isi file tersebut
4. Paste ke SQL Editor di Supabase
5. Klik **"Run"** untuk menjalankan migration
6. Pastikan semua tabel berhasil dibuat (users, vendors, payment_requests, kasbon, klaim, penyelesaian)

### 1.3 Dapatkan Supabase Credentials

1. Di Supabase Dashboard, buka **Settings** > **API**
2. Copy **Project URL** (akan digunakan untuk `VITE_SUPABASE_URL`)
3. Copy **anon/public key** (akan digunakan untuk `VITE_SUPABASE_ANON_KEY`)

### 1.4 Buat User Default

1. Buka **Table Editor** > **users**
2. Klik **"Insert"** > **"Insert row"**
3. Tambahkan user untuk testing:

```sql
-- User Administrator
INSERT INTO users (username, password, name, role) 
VALUES ('admin', 'admin123', 'Administrator', 'administrator');

-- User Guest
INSERT INTO users (username, password, name, role) 
VALUES ('guest', 'semangatkerja', 'Guest User', 'guest');

-- User lainnya sesuai kebutuhan
INSERT INTO users (username, password, name, role) 
VALUES ('finance', 'finance123', 'Team Finance', 'team_finance');
```

**Catatan**: Di production, sebaiknya gunakan bcrypt untuk hash password.

---

## ☁️ 2. Setup Cloudflare R2

### 2.1 Buat R2 Bucket

1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Pilih akun Cloudflare Anda
3. Buka **R2** > **Create bucket**
4. Isi informasi:
   - **Bucket name**: `finance-prasasti` (atau nama lain)
   - **Location**: Pilih region terdekat
5. Klik **"Create bucket"**

### 2.2 Buat R2 API Token

1. Di halaman R2, buka **Manage R2 API Tokens**
2. Klik **"Create API token"**
3. Isi informasi:
   - **Token name**: `finance-prasasti-api`
   - **Permissions**: Pilih **"Object Read & Write"**
   - **TTL**: Optional (biarkan kosong untuk tidak expired)
4. Klik **"Create API token"**
5. **Copy dan simpan**:
   - **Access Key ID**
   - **Secret Access Key**
   - **Account ID** (bisa dilihat di halaman R2)

### 2.3 Setup Public Access (Custom Domain atau R2.dev)

#### Opsi 1: Menggunakan Custom Domain (Recommended)

1. Di bucket R2, buka **Settings** > **Public Access**
2. Klik **"Connect Domain"**
3. Pilih domain yang sudah ada di Cloudflare atau tambahkan domain baru
4. Setup DNS record sesuai instruksi
5. Setelah domain terhubung, URL publik akan seperti: `https://files.yourdomain.com`

#### Opsi 2: Menggunakan R2.dev Domain

1. Di bucket R2, buka **Settings** > **Public Access**
2. Enable **"Public Access"**
3. URL publik akan seperti: `https://pub-xxxxx.r2.dev`

### 2.4 Dapatkan R2 Endpoint

R2 Endpoint format: `https://{account_id}.r2.cloudflarestorage.com`

Anda bisa menemukan Account ID di:
- Cloudflare Dashboard > R2 > Overview
- Atau di halaman R2 API Tokens

---

## ⚙️ 3. Setup Cloudflare Worker (untuk R2 Upload)

Ada 2 cara untuk setup Worker:

### 🚀 Opsi A: Setup dengan Wrangler CLI (Recommended)

Lihat [cloudflare-worker/SETUP_WRANGLER.md](./cloudflare-worker/SETUP_WRANGLER.md) untuk panduan lengkap.

**Quick Start:**
```bash
# 1. Install Wrangler
npm install -g wrangler

# 2. Login ke Cloudflare
wrangler login

# 3. Edit cloudflare-worker/wrangler.toml
#    - Ganti bucket_name dengan nama bucket R2 Anda
#    - Pastikan R2_PUBLIC_URL sudah benar

# 4. Deploy
cd cloudflare-worker
wrangler deploy

# 5. Copy Worker URL yang ditampilkan
# 6. Update VITE_R2_WORKER_URL di frontend .env
```

### 📋 Opsi B: Setup via Cloudflare Dashboard

#### 3.1 Buat Cloudflare Worker

1. Di Cloudflare Dashboard, buka **Workers & Pages**
2. Klik **"Create Application"** > **"Create Worker"**
3. Isi informasi:
   - **Name**: `r2-upload-worker` (atau nama lain)
   - **HTTP Handler**: Pilih default
4. Klik **"Deploy"**

### 3.2 Setup R2 Binding (Recommended)

**Via Cloudflare Dashboard:**
1. Di Worker, buka **Settings** > **Variables** > **R2 Bucket Bindings**
2. Klik **"Add binding"**
3. Isi:
   - **Variable name**: `MY_BUCKET`
   - **R2 bucket**: Pilih bucket yang sudah dibuat (misalnya: `finance-prasasti`)
4. Klik **"Save"**

### 3.3 Upload Worker Code

1. Copy kode dari file `cloudflare-worker/r2-upload-simple.js` (recommended - menggunakan R2 bindings, lebih sederhana)
2. Atau `cloudflare-worker/r2-upload-proxy.js` (menggunakan S3 API dengan credentials)
3. Paste ke Cloudflare Workers Editor
4. Klik **"Save and Deploy"**

### 3.4 Setup Environment Variables

1. Di Worker, buka **Settings** > **Variables**
2. Tambahkan environment variable:
   - `R2_PUBLIC_URL`: URL publik R2 
     - Format R2.dev: `https://pub-2a22328082a54c2080b6e1a618eee362.r2.dev`
     - Atau custom domain: `https://files.yourdomain.com`
   
**Catatan**: 
- R2_PUBLIC_URL harus di-set di Worker, bukan di frontend `.env`
- Jika menggunakan `r2-upload-proxy.js`, Anda juga perlu menambahkan:
  - `R2_ACCOUNT_ID`: Account ID R2 Anda
  - `R2_ACCESS_KEY_ID`: Access Key ID R2 Anda
  - `R2_SECRET_ACCESS_KEY`: Secret Access Key R2 Anda (gunakan **"Encrypt"**)
  - `R2_BUCKET_NAME`: Nama bucket R2
- Lihat [cloudflare-worker/R2_CONFIG.md](./cloudflare-worker/R2_CONFIG.md) untuk detail konfigurasi

### 3.5 Dapatkan Worker URL

1. Setelah worker di-deploy, copy **Worker URL**
2. URL akan seperti: `https://r2-upload-worker.your-account.workers.dev`
3. Simpan URL ini untuk konfigurasi frontend

**Catatan**: Untuk production, Anda bisa setup custom domain untuk worker juga.

---

## 🎨 4. Setup Frontend

### 4.1 Install Dependencies

```bash
npm install
```

### 4.2 Konfigurasi Environment Variables

1. Copy file `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

2. Edit file `.env` dan isi dengan credential yang sudah Anda dapatkan:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Cloudflare R2 Worker URL (untuk upload file)
VITE_R2_WORKER_URL=https://r2-upload-worker.your-account.workers.dev
```

**Catatan**: 
- Ganti `your-project-id` dengan Project ID dari Supabase
- Ganti `your_supabase_anon_key_here` dengan anon key dari Supabase
- Ganti `r2-upload-worker.your-account.workers.dev` dengan Worker URL Anda

### 4.3 Jalankan Frontend Development Server

```bash
npm run dev
```

Frontend akan berjalan di `http://localhost:3000`

---

## 🚀 5. Deploy ke Cloudflare Pages

### 5.1 Persiapan

1. Pastikan kode sudah di-push ke Git repository (GitHub, GitLab, atau Bitbucket)
2. Pastikan file `.env` sudah di-commit (atau setup environment variables di Cloudflare Pages)

### 5.2 Setup Cloudflare Pages Project

1. Di Cloudflare Dashboard, buka **Workers & Pages**
2. Klik **"Create Application"** > **"Pages"** > **"Connect to Git"**
3. Pilih repository yang berisi frontend code
4. Klik **"Begin setup"**

### 5.3 Konfigurasi Build Settings

1. **Project name**: `finance-prasasti` (atau nama lain)
2. **Production branch**: `main` (atau branch utama Anda)
3. **Build command**: `npm run build`
4. **Build output directory**: `dist`

### 5.4 Setup Environment Variables

1. Di halaman project, buka **Settings** > **Environment Variables**
2. Tambahkan environment variables:
   - `VITE_SUPABASE_URL`: URL Supabase project Anda
   - `VITE_SUPABASE_ANON_KEY`: Anon key Supabase
   - `VITE_R2_WORKER_URL`: URL Cloudflare Worker untuk upload

### 5.5 Deploy

1. Klik **"Save and Deploy"**
2. Tunggu hingga build selesai
3. Setelah deploy berhasil, Anda akan mendapatkan URL: `https://finance-prasasti.pages.dev`

### 5.6 Setup Custom Domain (Optional)

1. Di halaman project, buka **Custom domains**
2. Klik **"Set up a custom domain"**
3. Ikuti instruksi untuk setup DNS
4. Setelah DNS propagasi selesai, domain akan aktif

---

## ✅ 6. Verifikasi Setup

### 6.1 Test Koneksi Supabase

1. Buka aplikasi di browser (localhost atau Cloudflare Pages URL)
2. Coba login dengan user yang sudah dibuat di database
3. Pastikan bisa login dan melihat dashboard

### 6.2 Test Upload File ke R2

1. Login ke aplikasi
2. Buka halaman **Payment Request** atau halaman lain yang memiliki upload file
3. Coba upload file (PDF, gambar, dll)
4. Pastikan file berhasil diupload dan bisa di-preview
5. Cek di Cloudflare R2 bucket, pastikan file sudah tersimpan dengan struktur folder yang benar

### 6.3 Test Struktur Folder R2

File yang diupload seharusnya tersimpan dengan struktur:
```
payment-requests/
  └── 2024/
      └── 11/
          └── pr-0001/
              └── 1699123456789-abc123-filename.pdf
```

---

## 🐛 Troubleshooting

### Worker tidak bisa generate presigned URL

**Error**: `Failed to get presigned URL`

**Solusi**:
1. Pastikan environment variables di Worker sudah benar
2. Pastikan R2 credentials sudah benar
3. Pastikan Worker URL sudah benar di frontend `.env`
4. Cek log di Cloudflare Workers dashboard

### File tidak bisa diupload

**Error**: `Failed to upload file to R2`

**Solusi**:
1. Pastikan presigned URL sudah benar
2. Pastikan CORS sudah di-setup di R2 bucket (jika diperlukan)
3. Pastikan file size tidak melebihi limit
4. Cek browser console untuk error detail

### File tidak bisa diakses via URL publik

**Error**: File tidak bisa dibuka atau 403 Forbidden

**Solusi**:
1. Pastikan public access sudah di-enable di R2 bucket
2. Pastikan custom domain sudah terhubung dengan benar (jika menggunakan custom domain)
3. Pastikan `R2_PUBLIC_URL` di Worker menggunakan URL yang benar

### Frontend tidak bisa connect ke Supabase

**Error**: `Missing Supabase environment variables`

**Solusi**:
1. Pastikan environment variables sudah di-setup di Cloudflare Pages
2. Pastikan variable dimulai dengan `VITE_` untuk Vite
3. Rebuild dan re-deploy aplikasi setelah mengubah environment variables

---

## 📝 Checklist Setup

- [ ] Supabase project dibuat
- [ ] Database schema dijalankan (migration)
- [ ] User default dibuat di database
- [ ] Supabase credentials disimpan
- [ ] R2 bucket dibuat
- [ ] R2 API token dibuat
- [ ] R2 public access di-setup (custom domain atau R2.dev)
- [ ] Cloudflare Worker dibuat
- [ ] Worker code di-deploy
- [ ] Worker environment variables di-setup
- [ ] Frontend `.env` dikonfigurasi
- [ ] Frontend dependencies diinstall
- [ ] Frontend development server berjalan
- [ ] Login berhasil
- [ ] Upload file berhasil
- [ ] File bisa di-preview
- [ ] Code di-push ke Git repository
- [ ] Cloudflare Pages project dibuat
- [ ] Build settings dikonfigurasi
- [ ] Environment variables di Cloudflare Pages di-setup
- [ ] Deploy ke Cloudflare Pages berhasil

---

## 📚 Dokumentasi Tambahan

- [R2 Folder Structure](./R2_FOLDER_STRUCTURE.md) - Dokumentasi struktur folder R2
- [Supabase Documentation](https://supabase.com/docs)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)

---

## 🆘 Butuh Bantuan?

Jika mengalami masalah saat setup, silakan:
1. Cek bagian **Troubleshooting** di atas
2. Cek log error di console (browser dan Cloudflare dashboard)
3. Pastikan semua credential sudah benar
4. Pastikan semua dependencies sudah terinstall

---

**Selamat! Setup selesai. Aplikasi Finance Prasasti siap digunakan! 🎉**
