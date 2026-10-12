@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Instalar-Worker-Impressora.ps1"
if errorlevel 1 (
  echo.
  echo A instalacao falhou. Leia a mensagem acima.
  pause
  exit /b 1
)
echo.
pause
