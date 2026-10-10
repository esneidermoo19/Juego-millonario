@echo off
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
    echo No se encontro Python. Instalalo desde https://www.python.org/downloads/ y vuelve a intentarlo.
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    py -3 -m venv .venv
    if errorlevel 1 goto :error
)

.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 goto :error

.venv\Scripts\python.exe -m backend.app
pause
exit /b 0

:error
echo No se pudo preparar el juego. Revisa que Python 3 y pip esten instalados.
pause
exit /b 1
