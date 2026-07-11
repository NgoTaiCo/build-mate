@echo off
REM Check OpenClaw status

echo [*] Container status:
docker compose ps

echo.
echo [*] OpenClaw health:
docker compose exec -T openclaw-gateway curl -s http://localhost:18789/api/v1/gateway/status
echo.
