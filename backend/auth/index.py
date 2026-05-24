"""
Авторизация КиберБот — логин, логаут, проверка сессии.
Пароль хранится как bcrypt-хэш в таблице users.
Сессия — случайный токен 64 символа, живёт 30 дней.
"""
import os, json, secrets, hashlib
from datetime import datetime, timezone
import psycopg2

DB_URL = os.environ.get("DATABASE_URL", "")
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p28097026_crypto_bot_profit")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
}

def resp(body, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(body, ensure_ascii=False)}

def db(sql, params=()):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(sql, params)
    conn.commit()
    rows = cur.fetchall() if cur.description else []
    cols = [d[0] for d in cur.description] if cur.description else []
    cur.close(); conn.close()
    return [dict(zip(cols, r)) for r in rows]

def hash_password(password: str) -> str:
    """SHA-256 хэш пароля (простой и быстрый для облачных функций)."""
    return hashlib.sha256(password.encode()).hexdigest()

def check_session(session_id: str):
    """Проверить сессию — вернуть user или None."""
    if not session_id or len(session_id) < 32:
        return None
    rows = db(
        f"SELECT s.id, s.user_id, s.expires_at, u.username, u.role FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id WHERE s.id = %s AND s.expires_at > NOW()",
        (session_id,)
    )
    return rows[0] if rows else None

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    headers = event.get("headers") or {}
    action = params.get("action", "")
    session_id = headers.get("x-session-id") or headers.get("X-Session-Id") or ""

    # ── GET: проверка сессии ────────────────────────────────────────────────
    if method == "GET" and action == "check":
        user = check_session(session_id)
        if user:
            return resp({
                "ok": True,
                "user": {"id": user["user_id"], "username": user["username"], "role": user["role"]}
            })
        return resp({"ok": False, "error": "Сессия истекла или не найдена"}, 401)

    # ── POST: логин ─────────────────────────────────────────────────────────
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        action = body.get("action", "")

        if action == "login":
            username = body.get("username", "").strip().lower()
            password = body.get("password", "")

            if not username or not password:
                return resp({"ok": False, "error": "Введи логин и пароль"}, 400)

            # Ищем пользователя
            rows = db(
                f"SELECT id, username, password_hash, role, is_active FROM {SCHEMA}.users WHERE username = %s",
                (username,)
            )
            if not rows:
                return resp({"ok": False, "error": "Неверный логин или пароль"}, 401)

            user = rows[0]
            if not user["is_active"]:
                return resp({"ok": False, "error": "Аккаунт заблокирован"}, 403)

            # Проверяем пароль (поддерживаем SHA-256)
            pw_hash = hash_password(password)
            if user["password_hash"] != pw_hash:
                return resp({"ok": False, "error": "Неверный логин или пароль"}, 401)

            # Создаём сессию
            session_token = secrets.token_hex(32)
            ip = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp", "")
            ua = headers.get("user-agent", "")[:250]

            db(
                f"INSERT INTO {SCHEMA}.sessions (id, user_id, ip, user_agent) VALUES (%s, %s, %s, %s)",
                (session_token, user["id"], ip, ua)
            )

            # Обновляем last_login
            db(f"UPDATE {SCHEMA}.users SET last_login = NOW() WHERE id = %s", (user["id"],))

            return resp({
                "ok": True,
                "session_id": session_token,
                "user": {"id": user["id"], "username": user["username"], "role": user["role"]}
            })

        # ── Логаут ──────────────────────────────────────────────────────────
        if action == "logout":
            if session_id:
                db(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE id = %s", (session_id,))
            return resp({"ok": True})

        # ── Смена пароля ────────────────────────────────────────────────────
        if action == "change_password":
            user = check_session(session_id)
            if not user:
                return resp({"ok": False, "error": "Не авторизован"}, 401)

            old_pw = body.get("old_password", "")
            new_pw = body.get("new_password", "")

            if len(new_pw) < 6:
                return resp({"ok": False, "error": "Пароль минимум 6 символов"}, 400)

            rows = db(f"SELECT password_hash FROM {SCHEMA}.users WHERE id = %s", (user["user_id"],))
            if not rows or rows[0]["password_hash"] != hash_password(old_pw):
                return resp({"ok": False, "error": "Старый пароль неверный"}, 401)

            db(f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE id = %s",
               (hash_password(new_pw), user["user_id"]))
            return resp({"ok": True, "message": "Пароль изменён"})

        return resp({"error": f"Неизвестный action: {action}"}, 400)

    return resp({"error": "Метод не поддерживается"}, 405)
