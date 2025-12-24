#!/bin/bash

echo "========================================"
echo "Deploy Cloudflare Worker dengan Wrangler"
echo "========================================"
echo ""

cd cloudflare-worker

echo "[1/4] Checking Wrangler installation..."
if ! command -v wrangler &> /dev/null; then
    echo "Wrangler tidak ditemukan!"
    echo "Installing Wrangler..."
    npm install -g wrangler
fi

wrangler --version

echo ""
echo "[2/4] Checking Cloudflare login..."
if ! wrangler whoami &> /dev/null; then
    echo "Belum login ke Cloudflare!"
    echo "Silakan login terlebih dahulu..."
    wrangler login
fi

echo ""
echo "[3/4] Checking configuration..."
echo "Pastikan wrangler.toml sudah dikonfigurasi dengan benar:"
echo "- bucket_name: Nama bucket R2 Anda"
echo "- R2_PUBLIC_URL: URL public R2 Anda"
echo ""
read -p "Press Enter to continue..."

echo ""
echo "[4/4] Deploying Worker..."
wrangler deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "Deploy berhasil!"
    echo "========================================"
    echo ""
    echo "Worker URL akan ditampilkan di atas."
    echo "Copy Worker URL tersebut dan update di frontend .env:"
    echo "VITE_R2_WORKER_URL=https://r2-upload-worker.xxxxx.workers.dev"
    echo ""
else
    echo ""
    echo "Deploy gagal! Cek error di atas."
    exit 1
fi

