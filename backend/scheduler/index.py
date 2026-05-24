"""
КиберБот Scheduler v2 — автономный планировщик.
Запускается каждые 10-60 минут через cron-job.org или GitHub Actions.
Работает независимо от браузера пользователя 24/7.
Запускает: автоторговлю + скальпер для всех активных пользователей.
"""
import os, json, requests
from datetime import datetime, timezone
import psycopg2

DB_URL = os.environ.get("DATABASE_URL", "")
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p28097026_crypto_bot_profit")
AUTOTRADER_URL = "https://functions.poehali.dev/f372165e-74bb-42e7-9a58-5830d08d29fb"
SCALPER_URL = "https://functions.poehali.dev/069c26ed-4e40-418f-a3f1-c49541d79bf9"
AUTH_URL = "https://functions.poehali.dev/caebbeb5-e41f-40ce-9f6c-3a86058c804d"
SCHEDULER_SECRET = os.environ.get("SCHEDULER_SECRET", "KIBERBOT_CRON_2024")

CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Scheduler-Key"}

def resp(body, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(body, ensure_ascii=False, default=str)}

def db_get(key, user_id=1):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(f"SELECT value FROM {SCHEMA}.bot_settings WHERE key = %s AND user_id = %s", (key, user_id))
    row = cur.fetchone()
    cur.close(); conn.close()
    return row[0] if row else None

def db_set(key, value, user_id=1):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.bot_settings (user_id, key, value) VALUES (%s, %s, %s) ON CONFLICT (user_id, key) DO UPDATE SET value = %s, updated_at = NOW()",
        (user_id, key, str(value), str(value))
    )
    conn.commit()
    cur.close(); conn.close()

def get_all_active_users():
    """Все пользователи у которых включён бот или скальпер."""
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    # Пользователи с токеном Т-Банк
    cur.execute(f"""
        SELECT DISTINCT u.id, u.username, u.tbank_token
        FROM {SCHEMA}.users u
        WHERE u.is_active = true AND u.tbank_token IS NOT NULL AND u.tbank_token != ''
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()
    return [{"id": r[0], "username": r[1], "tbank_token": r[2]} for r in rows]

def get_user_settings(user_id):
    """Настройки бота для конкретного пользователя."""
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    # Глобальные настройки (user_id=1 для main bot)
    cur.execute(f"SELECT key, value FROM {SCHEMA}.bot_settings WHERE user_id = 1 AND key IN ('auto_bot_enabled','scalp_enabled','trade_mode','trade_fixed_amount','max_daily_loss_pct')")
    global_rows = {r[0]: r[1] for r in cur.fetchall()}
    # Пользовательские настройки
    cur.execute(f"SELECT key, value FROM {SCHEMA}.user_settings WHERE user_id = %s", (user_id,))
    user_rows = {r[0]: r[1] for r in cur.fetchall()}
    cur.close(); conn.close()
    return {**global_rows, **user_rows}

def create_temp_session(user_id):
    """Создаём временную сессию для скальпера."""
    import secrets
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    token = secrets.token_hex(32)
    cur.execute(
        f"INSERT INTO {SCHEMA}.sessions (id, user_id, expires_at) VALUES (%s, %s, NOW() + INTERVAL '1 hour')",
        (token, user_id)
    )
    conn.commit()
    cur.close(); conn.close()
    return token

def cleanup_temp_sessions():
    """Удаляем истёкшие сессии."""
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE expires_at < NOW()")
    conn.commit()
    cur.close(); conn.close()

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    headers = event.get("headers") or {}
    params = event.get("queryStringParameters") or {}

    # Проверка секретного ключа (защита от несанкционированных вызовов)
    scheduler_key = headers.get("x-scheduler-key") or params.get("key") or ""
    if scheduler_key != SCHEDULER_SECRET:
        return resp({"error": "Unauthorized"}, 401)

    now = datetime.now(timezone.utc)
    now_str = now.strftime("%d.%m.%Y %H:%M МСК")
    msk_hour = (now.hour + 3) % 24
    results = {"time": now_str, "msk_hour": msk_hour, "autobot": [], "scalper": [], "skipped": []}

    # ── Рабочие часы Мосбиржи ─────────────────────────────────────────────
    market_open = 7 <= msk_hour < 24  # Расширенные часы (крипто + премаркет)

    # ── Автобот (main user) ───────────────────────────────────────────────
    enabled = db_get("auto_bot_enabled") or "false"
    if enabled == "true" and market_open:
        try:
            r = requests.post(AUTOTRADER_URL, json={"action": "run_once"},
                            headers={"Content-Type": "application/json",
                                    "X-Session-Id": db_get("scheduler_session") or ""},
                            timeout=25)
            result = r.json()
            if result.get("stopped"):
                db_set("auto_bot_enabled", "false")
            db_set("scheduler_last_run", now_str)
            trades = [t for t in result.get("results", []) if t.get("order_id")]
            results["autobot"].append({
                "user": "main",
                "trades": len(trades),
                "daily_pnl": result.get("daily_pnl", 0),
                "stopped": result.get("stopped", False),
            })
        except Exception as e:
            results["autobot"].append({"user": "main", "error": str(e)})
    else:
        results["skipped"].append({"bot": "autobot", "reason": "выключен или нерабочее время"})

    # ── Скальпер для всех пользователей ──────────────────────────────────
    active_users = get_all_active_users()
    for user in active_users:
        uid = user["id"]
        settings = get_user_settings(uid)
        scalp_enabled = settings.get("scalp_enabled", "false")

        if scalp_enabled != "true":
            results["skipped"].append({"bot": "scalper", "user": user["username"], "reason": "выключен"})
            continue

        try:
            # Создаём временную сессию для этого пользователя
            session_token = create_temp_session(uid)
            r = requests.post(SCALPER_URL, json={"action": "run_scalp"},
                            headers={"Content-Type": "application/json", "X-Session-Id": session_token},
                            timeout=25)
            result = r.json()
            sold = len(result.get("sold", []))
            bought = len(result.get("bought", []))
            results["scalper"].append({
                "user": user["username"],
                "bought": bought,
                "sold": sold,
                "ok": result.get("ok", False),
            })
        except Exception as e:
            results["scalper"].append({"user": user["username"], "error": str(e)})

    # Чистим старые сессии
    try:
        cleanup_temp_sessions()
    except: pass

    # Логируем итог
    db_set("scheduler_last_run", now_str)
    db_set("scheduler_last_result", json.dumps(results, ensure_ascii=False)[:1000])

    return resp({"success": True, **results})
