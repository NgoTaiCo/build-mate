@echo off
REM Restart OpenClaw

echo [*] Restarting OpenClaw...
docker compose restart openclaw-gateway

echo [+] Restarted. Logs follow (Ctrl+C to exit):
timeout /t 2 /nobreak
docker compose logs -f openclaw-gateway
