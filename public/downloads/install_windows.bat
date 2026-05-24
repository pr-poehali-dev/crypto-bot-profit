@echo off
chcp 65001 >nul
title КиберБот — Установка

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║     КиберБот — Установка (Windows)       ║
echo  ╚══════════════════════════════════════════╝
echo.

:: Проверка Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  ❌ Python не найден!
    echo.
    echo  Скачай Python с https://python.org/downloads
    echo  При установке отметь "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

echo  ✅ Python найден
echo.
echo  📦 Устанавливаю зависимости...
pip install requests schedule --quiet

if errorlevel 1 (
    echo  ❌ Ошибка установки зависимостей
    pause
    exit /b 1
)

echo  ✅ Зависимости установлены
echo.
echo  ⚙️  Настройка автозапуска...

:: Создаём bat для автозапуска
set SCRIPT_DIR=%~dp0
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

echo @echo off > "%STARTUP_DIR%\kiberbot_autostart.bat"
echo cd /d "%SCRIPT_DIR%" >> "%STARTUP_DIR%\kiberbot_autostart.bat"
echo start /min python kiberbot.py >> "%STARTUP_DIR%\kiberbot_autostart.bat"

echo  ✅ Автозапуск настроен (запустится при следующем входе в Windows)
echo.
echo  ══════════════════════════════════════════
echo  🚀 Запускаю КиберБот...
echo  ══════════════════════════════════════════
echo.

:: Запускаем бота
python kiberbot.py

pause
