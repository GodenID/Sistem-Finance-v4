@echo off
echo ========================================
echo Setup Frontend - Finance Prasasti
echo ========================================
echo.

echo [1/3] Installing dependencies...
call npm install

echo.
echo [2/3] Creating .env file...
if not exist .env (
    copy .env.example .env
    echo .env file created from .env.example
    echo Please edit .env with your Supabase credentials
) else (
    echo .env file already exists
)

echo.
echo [3/3] Setup complete!
echo.
echo Next steps:
echo 1. Edit .env with your Supabase credentials
echo 2. Run: npm run dev
echo.
pause

