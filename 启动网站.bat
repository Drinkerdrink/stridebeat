@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if not errorlevel 1 (
  node server.mjs --open
  goto :done
)
where py >nul 2>nul
if not errorlevel 1 (
  py -3 --version >nul 2>nul
  if not errorlevel 1 (
    py -3 server.py --open
    goto :done
  )
)
where python >nul 2>nul
if not errorlevel 1 (
  python --version >nul 2>nul
  if not errorlevel 1 (
    python server.py --open
    goto :done
  )
)
echo.
echo Install Node.js or Python 3, then run this file again.
echo Node.js: https://nodejs.org/
echo Python:  https://www.python.org/downloads/
echo See README.md for instructions.
:done
echo.
pause
endlocal
