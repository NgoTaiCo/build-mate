@echo off
REM Setup script for Windows (no make needed)

if not exist .env (
  copy .env.example .env
  echo [*] .env created
) else (
  echo [*] .env already exists
)

REM Check if bash is available (Git Bash)
where /q bash
if errorlevel 1 (
  echo [!] bash not found. Using PowerShell to generate config...
  powershell -ExecutionPolicy Bypass -File generate-config.ps1
) else (
  echo [*] Using bash to generate config...
  bash generate-config.sh
)

echo.
echo [+] Setup complete! Run: docker compose up -d
