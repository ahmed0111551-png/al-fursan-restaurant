@echo off
REM Al Fursan Restaurant - Start Server
REM This script runs the backend server and keeps it running

cd /d "%~dp0"
title Al Fursan Server

:start
echo.
echo ===================================
echo Starting Al Fursan Server...
echo ===================================
echo.

node backend/server.js

REM If the process exits, restart it after 5 seconds
echo.
echo Server stopped. Restarting in 5 seconds...
timeout /t 5
goto start
