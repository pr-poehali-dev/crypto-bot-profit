#!/usr/bin/env python3
"""
╔═══════════════════════════════════════════════════════╗
║          КиберБот — Автономный планировщик            ║
║         Работает без браузера 24/7                    ║
╚═══════════════════════════════════════════════════════╝

Установка:
  pip install requests schedule

Запуск:
  python kiberbot.py

Автозапуск Windows:
  Положи в папку Автозагрузки или создай задачу в Планировщике задач.

Автозапуск Mac/Linux:
  Добавь в crontab: @reboot python3 /path/to/kiberbot.py
"""

import requests
import schedule
import time
import os
import sys
import json
import logging
from datetime import datetime, timezone

# ─── НАСТРОЙКИ (заполни перед запуском) ──────────────────────────────────────
SCHEDULER_URL = "https://functions.poehali.dev/682bcb35-b68e-46b3-931e-ae304700cefd"
SCHEDULER_KEY = "KIBERBOT_CRON_2024"   # Вставь свой ключ из настроек
INTERVAL_MINUTES = 15                   # Интервал запуска (5, 10, 15, 30, 60)
BOT_NAME = "КиберБот"
VERSION = "1.0.0"

# ─── ЛОГИРОВАНИЕ ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("kiberbot.log", encoding="utf-8"),
    ]
)
log = logging.getLogger("КиберБот")

# ─── БАННЕР ───────────────────────────────────────────────────────────────────
def print_banner():
    print("""
╔══════════════════════════════════════════════════════╗
║                                                      ║
║        ██╗  ██╗██╗██████╗ ███████╗██████╗           ║
║        ██║ ██╔╝██║██╔══██╗██╔════╝██╔══██╗          ║
║        █████╔╝ ██║██████╔╝█████╗  ██████╔╝          ║
║        ██╔═██╗ ██║██╔══██╗██╔══╝  ██╔══██╗          ║
║        ██║  ██╗██║██████╔╝███████╗██║  ██║          ║
║        ╚═╝  ╚═╝╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝          ║
║                      БОТ                            ║
║                                                      ║
║         Автономный торговый планировщик v1.0         ║
║         Работает 24/7 независимо от браузера         ║
╚══════════════════════════════════════════════════════╝
    """)

# ─── ОСНОВНАЯ ФУНКЦИЯ ЗАПУСКА ─────────────────────────────────────────────────
def run_cycle():
    now = datetime.now(timezone.utc)
    msk_hour = (now.hour + 3) % 24
    log.info(f"▶ Запуск цикла | МСК {msk_hour:02d}:{now.minute:02d}")

    try:
        response = requests.get(
            SCHEDULER_URL,
            headers={"X-Scheduler-Key": SCHEDULER_KEY},
            timeout=30
        )

        if response.status_code == 401:
            log.error("❌ Неверный ключ планировщика. Проверь SCHEDULER_KEY")
            return

        data = response.json()

        if not data.get("success"):
            log.warning(f"⚠ Планировщик вернул: {json.dumps(data, ensure_ascii=False)}")
            return

        # Результаты автобота
        for bot in data.get("autobot", []):
            if bot.get("error"):
                log.error(f"❌ Автобот [{bot.get('user')}]: {bot['error']}")
            elif bot.get("stopped"):
                log.warning(f"🛑 Автобот остановлен (дневной стоп)")
            else:
                trades = bot.get("trades", 0)
                pnl = bot.get("daily_pnl", 0)
                log.info(f"✅ Автобот: сделок={trades}, P&L={pnl:+.0f}₽")

        # Результаты скальпера
        for sc in data.get("scalper", []):
            if sc.get("error"):
                log.error(f"❌ Скальпер [{sc.get('user')}]: {sc['error']}")
            else:
                log.info(f"⚡ Скальпер [{sc.get('user')}]: куплено={sc.get('bought',0)}, продано={sc.get('sold',0)}")

        # Пропуски
        for skip in data.get("skipped", []):
            log.debug(f"⏭ {skip.get('bot')} [{skip.get('user','main')}]: {skip.get('reason')}")

        log.info(f"✓ Цикл завершён | {data.get('time', '')}")

    except requests.exceptions.Timeout:
        log.error("❌ Таймаут — сервер не ответил за 30 секунд")
    except requests.exceptions.ConnectionError:
        log.error("❌ Нет соединения с интернетом")
    except Exception as e:
        log.error(f"❌ Ошибка: {e}")

# ─── СТАТУС ────────────────────────────────────────────────────────────────────
def print_status():
    log.info(f"📊 КиберБот работает | Интервал: {INTERVAL_MINUTES} мин | Следующий цикл через {INTERVAL_MINUTES} мин")

# ─── ЗАПУСК ────────────────────────────────────────────────────────────────────
def main():
    print_banner()
    log.info(f"🚀 КиберБот v{VERSION} запущен")
    log.info(f"⏱ Интервал: каждые {INTERVAL_MINUTES} минут")
    log.info(f"🔗 Планировщик: {SCHEDULER_URL}")
    log.info("─" * 55)

    # Запускаем сразу при старте
    log.info("▶ Первый запуск...")
    run_cycle()

    # Расписание
    schedule.every(INTERVAL_MINUTES).minutes.do(run_cycle)
    schedule.every(60).minutes.do(print_status)

    log.info(f"✅ Планировщик запущен. Нажми Ctrl+C для остановки.")

    try:
        while True:
            schedule.run_pending()
            time.sleep(10)
    except KeyboardInterrupt:
        log.info("⏹ КиберБот остановлен пользователем")
        sys.exit(0)

if __name__ == "__main__":
    main()
