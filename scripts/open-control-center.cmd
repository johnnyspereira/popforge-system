@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
start "" "%~dp0..\node_modules\electron\dist\electron.exe" "%~dp0..\control-center\main.cjs"
