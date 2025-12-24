# Setup Deployment Frontend di Cloudflare Pages

## Overview
Cloudflare Pages adalah platform hosting gratis untuk aplikasi frontend statis (React, Vue, Angular, dll).

## Step 1: Persiapan Proyek

1. Pastikan project sudah ready untuk production:
   ```bash
   npm run build
   ```

2. Pastikan ada file `package.json` dengan script build:
   ```json
   {
     "scripts": {
       "build": "vite build"
     }
   }
   ```

3. Pastikan folder `dist/` (output build) tidak di-commit ke git (sudah ada di `.gitignore`)

## Step 2: Setup Cloudflare Pages

### Opsi 1: Connect to Git (Recommended)

1. **Push code ke GitHub/GitLab/Bitbucket**
   ```bash
   git add .
   git commit -m "Prepare for Cloudflare Pages deployment"
   git push origin main
   ```

2. **Login ke Cloudflare Dashboard**
   - Kunjungi https://dash.cloudflare.com
   - Login dengan akun Cloudflare Anda

3. **Create Pages Project**
   - Klik **"Workers & Pages"** di sidebar
   - Klik **"Create application"**
   - Pilih **"Pages"** → **"Connect to Git"**

4. **Connect Repository**
   - Pilih provider (GitHub/GitLab/Bitbucket)
   - Authorize Cloudflare untuk akses repository
   - Pilih repository yang berisi frontend code

5. **Configure Build Settings**
   - **Project name**: `finance-prasasti` (atau nama lain)
   - **Production branch**: `main` (atau `master`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (atau folder frontend jika monorepo)

6. **Environment Variables**
   - Klik **"Add variable"** untuk setiap environment variable:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_R2_WORKER_URL` (atau `VITE_WASABI_WORKER_URL`)
     - `VITE_WASABI_PUBLIC_URL` (optional)

7. **Deploy**
   - Klik **"Save and Deploy"**
   - Tunggu build selesai (biasanya 2-5 menit)
   - Setelah selesai, dapatkan URL: `https://finance-prasasti.pages.dev`

### Opsi 2: Direct Upload (Manual)

1. **Build project lokal**
   ```bash
   npm run build
   ```

2. **Create Pages Project**
   - Cloudflare Dashboard → **Workers & Pages** → **Pages**
   - Klik **"Create a project"** → **"Upload assets"**
   - Pilih folder `dist/` yang sudah di-build
   - Klik **"Deploy site"**

3. **Setup Environment Variables**
   - Klik project → **Settings** → **Environment variables**
   - Tambahkan semua environment variables

## Step 3: Setup Custom Domain (Optional)

1. **Add Custom Domain**
   - Klik project → **Custom domains** → **Set up a custom domain**
   - Masukkan domain (contoh: `finance.yourdomain.com`)

2. **Update DNS**
   - Cloudflare akan memberikan instruksi DNS
   - Tambahkan CNAME record:
     ```
     finance.yourdomain.com → finance-prasasti.pages.dev
     ```

3. **SSL/TLS**
   - Cloudflare akan otomatis setup SSL certificate (gratis)
   - Tunggu beberapa menit untuk SSL aktif

## Step 4: Update Environment Variables

Setelah deploy, pastikan semua environment variables sudah di-set:

1. **Via Cloudflare Dashboard**
   - Klik project → **Settings** → **Environment variables**
   - Tambahkan:
     ```
     VITE_SUPABASE_URL=https://...
     VITE_SUPABASE_ANON_KEY=...
     VITE_R2_WORKER_URL=https://wasabi-upload-worker.workers.dev
     ```

2. **Via Wrangler CLI** (Alternative)
   ```bash
   wrangler pages project create finance-prasasti
   wrangler pages secret put VITE_SUPABASE_URL
   ```

## Step 5: Automatic Deployments

Cloudflare Pages akan otomatis deploy setiap kali ada push ke branch `main`:

1. **Push code ke GitHub**
2. **Cloudflare Pages detect perubahan**
3. **Auto build dan deploy**
4. **Preview URL** akan otomatis dibuat untuk setiap commit

## Step 6: Preview Deployments

Setiap pull request akan otomatis dapat preview deployment:

1. **Create Pull Request** di GitHub
2. **Cloudflare Pages** akan otomatis build PR
3. **Preview URL** akan muncul di PR comments
4. **Test preview** sebelum merge

## Troubleshooting

### Build Failed

**Error: "Build command failed"**
- Cek build command di Cloudflare Pages settings
- Test build lokal: `npm run build`
- Cek logs di Cloudflare Dashboard

**Error: "Module not found"**
- Pastikan semua dependencies ada di `package.json`
- Pastikan `node_modules` tidak di-commit (ada di `.gitignore`)

### Environment Variables Not Working

- Pastikan variable dimulai dengan `VITE_` untuk Vite project
- Pastikan variable sudah di-set di Cloudflare Pages settings
- Re-deploy setelah update environment variables

### 404 on Refresh

**Error: "404 Not Found" ketika refresh page**
- Ini terjadi karena routing client-side
- Tambahkan `_redirects` file di `public/` folder:
  ```
  /*    /index.html   200
  ```
- Atau setup di `vite.config.js`:
  ```js
  export default {
    build: {
      rollupOptions: {
        output: {
          manualChunks: undefined
        }
      }
    }
  }
  ```

## Best Practices

1. **Use Environment Variables**
   - Jangan hardcode API keys di code
   - Gunakan environment variables untuk semua config

2. **Optimize Build**
   - Gunakan code splitting
   - Optimize images
   - Enable compression

3. **Monitor Deployments**
   - Setup notifications untuk failed builds
   - Monitor deployment logs
   - Test preview deployments

4. **Security**
   - Jangan expose secrets di frontend code
   - Gunakan Cloudflare Workers untuk sensitive operations
   - Enable Cloudflare security features

## Referensi

- Cloudflare Pages Docs: https://developers.cloudflare.com/pages/
- Vite Deployment: https://vitejs.dev/guide/static-deploy.html
- Cloudflare Pages Pricing: Free tier sangat generous!

