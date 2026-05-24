"""
КиберБот Scheduler — серверный планировщик 24/7.
Работает независимо от браузера через cron-job.org.
Каждые N минут запускает автобот и скальпер.
"""
import os, json, requests, secrets
from datetime import datetime, timezone
import psycopg2

DB_URL = os.environ.get("DATABASE_URL", "")
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p28097026_crypto_bot_profit")
AUTOTRADER_URL = "https://functions.poehali.dev/f372165e-74bb-42e7-9a58-5830d08d29fb"
SCALPER_URL    = "https://functions.poehali.dev/069c26ed-4e40-418f-a3f1-c49541d79bf9"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
}

def resp(body, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False, default=str)}

def db_get(key, uid=1):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(f"SELECT value FROM {SCHEMA}.bot_settings WHERE key=%s AND user_id=%s", (key, uid))
    row = cur.fetchone(); cur.close(); conn.close()
    return row[0] if row else None

def db_set(key, value, uid=1):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.bot_settings (user_id,key,value) VALUES(%s,%s,%s) "
        f"ON CONFLICT (user_id,key) DO UPDATE SET value=%s, updated_at=NOW()",
        (uid, key, str(value), str(value))
    )
    conn.commit(); cur.close(); conn.close()

def make_session(user_id):
    """Создаём временную сессию для серверного вызова."""
    token = secrets.token_hex(32)
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.sessions (id, user_id, expires_at) VALUES (%s,%s, NOW()+INTERVAL '2 hours')",
        (token, user_id)
    )
    conn.commit(); cur.close(); conn.close()
    return token

def get_admin_user_id():
    """Получаем ID главного пользователя."""
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE role='admin' LIMIT 1")
    row = cur.fetchone(); cur.close(); conn.close()
    return row[0] if row else 1

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    params = event.get("queryStringParameters") or {}
    now = datetime.now(timezone.utc)
    now_str = now.strftime("%d.%m.%Y %H:%M МСК")
    msk_hour = (now.hour + 3) % 24

    result = {
        "time": now_str,
        "msk_hour": msk_hour,
        "autobot": None,
        "scalper": None,
        "skipped": [],
    }

    # ── Получаем сессию для авторизованных вызовов ─────────────────────────
    admin_id = get_admin_user_id()
    session_token = make_session(admin_id)
    auth_headers = {
        "Content-Type": "application/json",
        "X-Session-Id": session_token,
    }

    # ── АВТОБОТ ────────────────────────────────────────────────────────────
    bot_enabled = db_get("auto_bot_enabled") or "false"
    if bot_enabled == "true":
        if msk_hour < 7 or msk_hour >= 23:
            result["skipped"].append({"bot": "autobot", "reason": f"нерабочее время {msk_hour}:xx МСК"})
        else:
            try:
                r = requests.post(AUTOTRADER_URL,
                    json={"action": "run_once"},
                    headers=auth_headers, timeout=25)
                d = r.json()
                if d.get("stopped"):
                    db_set("auto_bot_enabled", "false")
                trades = [t for t in d.get("results", []) if t.get("order_id")]
                db_set("scheduler_last_run", now_str)
                result["autobot"] = {
                    "ok": d.get("success", False),
                    "trades": len(trades),
                    "daily_pnl": d.get("daily_pnl", 0),
                    "stopped": d.get("stopped", False),
                    "free_cash": d.get("free_cash", 0),
                }
            except Exception as e:
                result["autobot"] = {"error": str(e)}
    else:
        result["skipped"].append({"bot": "autobot", "reason": "выключен"})

    # ── СКАЛЬПЕР ───────────────────────────────────────────────────────────
    scalp_enabled = db_get("scalp_enabled") or "false"

    # Проверяем user_settings тоже
    if scalp_enabled != "true":
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        cur.execute(f"SELECT value FROM {SCHEMA}.user_settings WHERE key='scalp_enabled' AND user_id=%s", (admin_id,))
        row = cur.fetchone(); cur.close(); conn.close()
        if row: scalp_enabled = row[0]

    if scalp_enabled == "true":
        try:
            r = requests.post(SCALPER_URL,
                json={"action": "run_scalp"},
                headers=auth_headers, timeout=25)
            d = r.json()
            result["scalper"] = {
                "ok": d.get("ok", False),
                "bought": len(d.get("bought", [])),
                "sold": len(d.get("sold", [])),
                "reason": d.get("reason"),
            }
        except Exception as e:
            result["scalper"] = {"error": str(e)}
    else:
        result["skipped"].append({"bot": "scalper", "reason": "выключен"})

    # ── Логируем ──────────────────────────────────────────────────────────
    db_set("scheduler_last_run", now_str)
    db_set("scheduler_last_result", json.dumps(result, ensure_ascii=False)[:800])

    return resp({"success": True, **result})
