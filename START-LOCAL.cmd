@echo off
setlocal
cd /d "%~dp0"
set "STUDIOSHELF_RUNTIME=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
if exist "%STUDIOSHELF_RUNTIME%\node.exe" set "PATH=%STUDIOSHELF_RUNTIME%;%PATH%"
node -e "if(Number(process.versions.node.split('.')[0])<22){console.error('Install Node.js 22.13+ before starting StudioShelf.');process.exit(1)}"
if errorlevel 1 goto finish
if not exist "node_modules\next\dist\bin\next" (
  echo Install project dependencies first using npm install or pnpm install.
  goto finish
)
echo Open http://127.0.0.1:3000 after the Ready message appears.
node node_modules\next\dist\bin\next dev --webpack --hostname 127.0.0.1
:finish
pause
