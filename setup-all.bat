@echo off
echo ========================================
echo Setup Complete Application
echo Finance Prasasti
echo ========================================
echo.

echo Setting up Frontend...
call setup-frontend.bat

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Please configure:
echo 1. .env - Supabase credentials dan R2 Worker URL
echo.
echo Then run:
echo - Frontend: npm run dev
echo.
echo Note: Backend menggunakan Supabase (database) dan Cloudflare Worker (file upload)
echo Tidak perlu backend Express terpisah.
echo.
pause

