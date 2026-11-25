@echo off
rem Shift from source on Windows, Node 24 through fnm (the machine's Node can stay older).
rem Renderer edits hot-reload; Rust edits need a relaunch. CDP on 9333 for scripts/rea/shot.mjs.
rem Usage: scripts\rea\dev-windows.cmd [font.shift]
setlocal
set "REPO=%~dp0..\.."
for /f "tokens=*" %%i in ('fnm env --shell cmd') do %%i
fnm use 24 --silent-if-unchanged
cd /d "%REPO%"
call corepack enable pnpm >nul 2>&1
call pnpm install --frozen-lockfile
call pnpm run build:native:debug || exit /b 1
cd apps\desktop
if "%~1"=="" (
  call pnpm exec electron-forge start -- --remote-debugging-port=9333
) else (
  call pnpm exec electron-forge start -- --remote-debugging-port=9333 "%~1"
)
