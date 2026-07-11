@echo off
REM Start OpenClaw

echo [*] Starting OpenClaw...
docker compose up -d

echo.
echo [+] OpenClaw is starting...
timeout /t 3 /nobreak

REM Try to show logs
docker compose logs openclaw-gateway 2>nul | findstr /E ".*" | for /f "tokens=*" %%A in ('more') do (
  echo %%A
)

echo.
echo [+] Open http://localhost:18789
