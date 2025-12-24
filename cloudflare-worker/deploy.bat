@echo off
echo ========================================
echo Deploy Cloudflare Worker dengan Wrangler
echo ========================================
echo.

cd cloudflare-worker

echo [1/4] Checking Wrangler installation...
wrangler --version
if errorlevel 1 (
    echo.
    echo Wrangler tidak ditemukan!
    echo Installing Wrangler...
    call npm install -g wrangler
)

echo.
echo [2/4] Checking Cloudflare login...
wrangler whoami
if errorlevel 1 (
    echo.
    echo Belum login ke Cloudflare!
    echo Silakan login terlebih dahulu...
    call wrangler login
)

echo.
echo [3/4] Checking configuration...
echo Pastikan wrangler.toml sudah dikonfigurasi dengan benar:
echo - bucket_name: Nama bucket R2 Anda
echo - R2_PUBLIC_URL: URL public R2 Anda
echo.
pause

echo.
echo [4/4] Deploying Worker...
call wrangler deploy

if errorlevel 1 (
    echo.
    echo Deploy gagal! Cek error di atas.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Deploy berhasil!
echo ========================================
echo.
echo Worker URL akan ditampilkan di atas.
echo Copy Worker URL tersebut dan update di frontend .env:
echo VITE_R2_WORKER_URL=https://r2-upload-worker.xxxxx.workers.dev
echo.
pause

