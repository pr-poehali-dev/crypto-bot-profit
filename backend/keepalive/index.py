"""
КиберБот KeepAlive — серверный планировщик 24/7 без внешних сервисов.
Принцип: после выполнения запускает сам себя через fire-and-forget HTTP-запрос.
Цепочка не прерывается — бот работает даже с закрытым браузером.
"""
import os, json, secrets, threading, requests
from datetime import datetime, timezone, timedelta
import psycopg2

DB_URL    = os.environ.get("DATABASE_URL", "")
SCHEMA    = os.environ.get("MAIN_DB_SCHEMA", "t_p28097026_crypto_bot_profit")
SELF_URL  = os.environ.get("KEEPALIVE_SELF_URL", "")   # URL этой функции (из func2url.json)
AUTOTRADER_URL = "https://functions.poehali.dev/f372165e-74bb-42e7-9a58-5830d08d29fb"
SCALPER_URL    = "https://functions.poehali.dev/069c26ed-4e40-418f-a3f1-c49541d79bf9"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
}

# ── БД helpers ────────────────────────────────────────────────────────────────
def cron_get(key: str) -> str:
    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor()
    cur.execute(f"SELECT value FROM {SCHEMA}.cron_state WHERE key=%s", (key,))
    row  = cur.fetchone()
    cur.close(); conn.close()
    return row[0] if row else ""

def cron_set(key: str, value: str):
    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.cron_state (key,value,updated_at) VALUES(%s,%s,NOW()) "
        f"ON CONFLICT (key) DO UPDATE SET value=%s, updated_at=NOW()",
        (key, value, value)
    )
    conn.commit(); cur.close(); conn.close()

def make_session(user_id: int) -> str:
    token = secrets.token_hex(32)
    conn  = psycopg2.connect(DB_URL)
    cur   = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.sessions (id,user_id,expires_at) VALUES(%s,%s,NOW()+INTERVAL '4 hours')",
        (token, user_id)
    )
    conn.commit(); cur.close(); conn.close()
    return token

def get_admin_id() -> int:
    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor()
    cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE role='admin' LIMIT 1")
    row  = cur.fetchone()
    cur.close(); conn.close()
    return row[0] if row else 1

def db_get_setting(key: str, uid: int = 1) -> str:
    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor()
    cur.execute(f"SELECT value FROM {SCHEMA}.bot_settings WHERE key=%s AND user_id=%s", (key, uid))
    row  = cur.fetchone()
    cur.close(); conn.close()
    return row[0] if row else ""

def db_set_setting(key: str, value: str, uid: int = 1):
    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.bot_settings (user_id,key,value) VALUES(%s,%s,%s) "
        f"ON CONFLICT (user_id,key) DO UPDATE SET value=%s, updated_at=NOW()",
        (uid, key, value, value)
    )
    conn.commit(); cur.close(); conn.close()

# ── Fire-and-forget: запускаем сами себя через N секунд ──────────────────────
def schedule_next(delay_sec: int, self_url: str):
    """Отправляет запрос к самому себе в отдельном потоке — не блокирует ответ."""
    def _call():
        import time
        time.sleep(delay_sec)
        try:
            requests.get(self_url + "?action=tick", timeout=60)
        except Exception:
            pass  # если не дозвонились — цепочка прервётся, фронтенд перезапустит
    t = threading.Thread(target=_call, daemon=True)
    t.start()

# ── Запуск торгового цикла ────────────────────────────────────────────────────
def run_trade_cycle(admin_id: int) -> dict:
    session = make_session(admin_id)
    auth    = {"Content-Type": "application/json", "X-Session-Id": session}
    now     = datetime.now(timezone.utc)
    msk_h   = (now.hour + 3) % 24
    result  = {"autobot": None, "scalper": None, "skipped": []}

    # Автобот (только в рабочие часы 7:00–23:00 МСК)
    bot_on = db_get_setting("auto_bot_enabled") == "true"
    if bot_on:
        if 7 <= msk_h < 23:
            try:
                r = requests.post(AUTOTRADER_URL, json={"action": "run_once"},
                                  headers=auth, timeout=28)
                d = r.json()
                if d.get("stopped"):
                    db_set_setting("auto_bot_enabled", "false")
                trades = [t for t in d.get("results", []) if t.get("order_id")]
                result["autobot"] = {
                    "ok": d.get("success", False),
                    "trades": len(trades),
                    "daily_pnl": d.get("daily_pnl", 0),
                    "stopped": d.get("stopped", False),
                }
            except Exception as e:
                result["autobot"] = {"error": str(e)}
        else:
            result["skipped"].append("autobot: нерабочее время")
    else:
        result["skipped"].append("autobot: выключен")

    # Скальпер (user_settings)
    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor()
    cur.execute(f"SELECT value FROM {SCHEMA}.user_settings WHERE key='scalp_enabled' AND user_id=%s", (admin_id,))
    row  = cur.fetchone(); cur.close(); conn.close()
    scalp_on = (row[0] if row else "") == "true"

    if scalp_on:
        try:
            r = requests.post(SCALPER_URL, json={"action": "run_scalp", "force": True},
                              headers=auth, timeout=28)
            d = r.json()
            result["scalper"] = {
                "ok": d.get("ok", False),
                "bought": len(d.get("bought", [])),
                "sold": len(d.get("sold", [])),
            }
        except Exception as e:
            result["scalper"] = {"error": str(e)}
    else:
        result["skipped"].append("scalper: выключен")

    return result

# ── HANDLER ───────────────────────────────────────────────────────────────────
def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    def resp(body, code=200):
        return {"statusCode": code,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps(body, ensure_ascii=False, default=str)}

    params  = event.get("queryStringParameters") or {}
    headers = event.get("headers") or {}
    body    = json.loads(event.get("body") or "{}") if event.get("httpMethod") == "POST" else {}
    action  = params.get("action") or body.get("action", "")
    sid     = headers.get("x-session-id") or headers.get("X-Session-Id") or ""

    # Проверяем авторизацию для управляющих действий
    def authed():
        if not sid or len(sid) < 32: return False
        conn = psycopg2.connect(DB_URL)
        cur  = conn.cursor()
        cur.execute(
            f"SELECT user_id FROM {SCHEMA}.sessions WHERE id=%s AND expires_at>NOW()", (sid,))
        row = cur.fetchone(); cur.close(); conn.close()
        return bool(row)

    # ── Статус (публичный для фронтенда) ─────────────────────────────────────
    if action == "status":
        return resp({
            "enabled":       cron_get("enabled") == "true",
            "interval_min":  int(cron_get("interval_min") or 15),
            "last_ping":     cron_get("last_ping"),
            "last_trade_run":cron_get("last_trade_run"),
            "cycle_count":   int(cron_get("cycle_count") or 0),
            "status":        cron_get("status"),
        })

    # ── Старт планировщика ────────────────────────────────────────────────────
    if action == "start":
        if not authed(): return resp({"error": "Не авторизован"}, 401)
        interval = int(body.get("interval_min", 15))
        self_url = body.get("self_url") or SELF_URL
        if not self_url:
            return resp({"error": "self_url не передан"}, 400)
        cron_set("enabled",      "true")
        cron_set("interval_min", str(interval))
        cron_set("status",       "running")
        cron_set("self_url",     self_url)
        # Запускаем первый тик немедленно
        schedule_next(3, self_url)
        return resp({"ok": True, "message": f"Планировщик запущен, интервал {interval} мин"})

    # ── Стоп планировщика ─────────────────────────────────────────────────────
    if action == "stop":
        if not authed(): return resp({"error": "Не авторизован"}, 401)
        cron_set("enabled", "false")
        cron_set("status",  "stopped")
        return resp({"ok": True, "message": "Планировщик остановлен"})

    # ── Изменить интервал ─────────────────────────────────────────────────────
    if action == "set_interval":
        if not authed(): return resp({"error": "Не авторизован"}, 401)
        interval = int(body.get("interval_min", 15))
        cron_set("interval_min", str(interval))
        return resp({"ok": True})

    # ── Тик — основной рабочий цикл ──────────────────────────────────────────
    if action == "tick":
        enabled  = cron_get("enabled")
        self_url = cron_get("self_url") or SELF_URL
        interval = int(cron_get("interval_min") or 15)

        now     = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        # Обновляем пульс
        cron_set("last_ping", now_iso)

        if enabled != "true" or not self_url:
            cron_set("status", "stopped")
            return resp({"ok": False, "reason": "остановлен"})

        cron_set("status", "running")

        # Проверяем — пора ли торговать
        last_run_str = cron_get("last_trade_run")
        should_trade = False
        try:
            last_run = datetime.fromisoformat(last_run_str)
            should_trade = (now - last_run) >= timedelta(minutes=interval)
        except Exception:
            should_trade = True

        trade_result = None
        if should_trade:
            admin_id    = get_admin_id()
            trade_result = run_trade_cycle(admin_id)
            count       = int(cron_get("cycle_count") or 0) + 1
            cron_set("last_trade_run", now_iso)
            cron_set("cycle_count",    str(count))
            # Сохраняем в bot_settings тоже
            db_set_setting("scheduler_last_run",
                           now.strftime("%d.%m.%Y %H:%M МСК"))
            db_set_setting("scheduler_last_result",
                           json.dumps(trade_result, ensure_ascii=False)[:800])

        # Планируем следующий тик через 60 секунд (пульс)
        # Торговля срабатывает внутри по интервалу
        schedule_next(60, self_url)

        return resp({
            "ok":           True,
            "traded":       should_trade,
            "trade_result": trade_result,
            "next_tick_sec": 60,
        })

    # ── Ручной запуск одного цикла ────────────────────────────────────────────
    if action == "run_now":
        if not authed(): return resp({"error": "Не авторизован"}, 401)
        admin_id    = get_admin_id()
        result      = run_trade_cycle(admin_id)
        now_iso     = datetime.now(timezone.utc).isoformat()
        cron_set("last_trade_run", now_iso)
        count = int(cron_get("cycle_count") or 0) + 1
        cron_set("cycle_count", str(count))
        return resp({"ok": True, "result": result})

    return resp({"error": f"Неизвестный action: {action}"}, 400)
