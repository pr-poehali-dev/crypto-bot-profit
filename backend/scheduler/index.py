"""
Планировщик КиберБот — запускается каждый час через cron.
Проверяет флаг auto_bot_enabled, если true — вызывает autotrader/run_once.
Логирует результат в БД.
"""
import os, json, requests
from datetime import datetime, timezone
import psycopg2

DB_URL = os.environ.get("DATABASE_URL", "")
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p28097026_crypto_bot_profit")
AUTOTRADER_URL = "https://functions.poehali.dev/f372165e-74bb-42e7-9a58-5830d08d29fb"

CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"}

def resp(body, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(body, ensure_ascii=False, default=str)}

def db_get(key):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(f"SELECT value FROM {SCHEMA}.bot_settings WHERE key = %s AND user_id = 1", (key,))
    row = cur.fetchone()
    cur.close(); conn.close()
    return row[0] if row else None

def db_set(key, value):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.bot_settings (user_id, key, value) VALUES (1, %s, %s) ON CONFLICT (user_id, key) DO UPDATE SET value = %s, updated_at = NOW()",
        (key, str(value), str(value))
    )
    conn.commit()
    cur.close(); conn.close()

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    now = datetime.now(timezone.utc)
    now_str = now.strftime("%d.%m.%Y %H:%M МСК")

    # Проверяем флаг — включён ли бот
    enabled = db_get("auto_bot_enabled") or "false"

    if enabled != "true":
        return resp({
            "skipped": True,
            "reason": "Бот выключен (auto_bot_enabled = false)",
            "time": now_str
        })

    # Рабочие часы МСК: 10:00 — 23:45 (биржа работает 10:00-18:50, крипто круглосуточно)
    msk_hour = (now.hour + 3) % 24
    if msk_hour < 7 or msk_hour >= 23:
        return resp({
            "skipped": True,
            "reason": f"Нерабочее время {msk_hour}:xx МСК (торгуем 07:00–23:00)",
            "time": now_str
        })

    # Запускаем торговый цикл
    try:
        r = requests.post(
            AUTOTRADER_URL,
            json={"action": "run_once"},
            headers={"Content-Type": "application/json"},
            timeout=25
        )
        result = r.json()
    except Exception as e:
        db_set("scheduler_last_error", str(e))
        return resp({"error": str(e), "time": now_str}, 500)

    # Логируем результат
    db_set("scheduler_last_run", now_str)
    db_set("scheduler_last_result", json.dumps(result, ensure_ascii=False)[:500])

    if result.get("stopped"):
        db_set("auto_bot_enabled", "false")
        return resp({
            "stopped": True,
            "reason": result.get("reason", "Дневной стоп"),
            "time": now_str
        })

    trades_done = [t for t in result.get("results", []) if t.get("order_id")]
    return resp({
        "success": True,
        "time": now_str,
        "free_cash": result.get("free_cash"),
        "order_amount": result.get("order_amount"),
        "daily_pnl": result.get("daily_pnl"),
        "trades_executed": len(trades_done),
        "signals": [{"ticker": t["ticker"], "signal": t["signal"]} for t in result.get("results", [])],
    })
