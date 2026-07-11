@echo off
REM Stop OpenClaw

echo [*] Stopping OpenClaw...
docker compose down

echo [+] Stopped (data kept in Docker volumes)
