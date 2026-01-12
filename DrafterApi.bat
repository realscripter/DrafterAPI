@echo off
cd /d %~dp0
if "%1"=="" (
    node server\index.js
) else (
    node server\index.js %*
)
