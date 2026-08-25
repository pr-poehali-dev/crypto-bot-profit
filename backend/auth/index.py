"""
Авторизация КиберБот — логин, регистрация, личный кабинет, токены.
"""
import os, json, secrets, hashlib, random, string
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
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(body, ensure_ascii=False, default=str)}

def db(sql, params=()):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(sql, params)
    conn.commit()
    rows = cur.fetchall() if cur.description else []
    cols = [d[0] for d in cur.description] if cur.description else []
    cur.close(); conn.close()
    return [dict(zip(cols, r)) for r in rows]

def hash_pw(p): return hashlib.sha256(p.encode("utf-8")).hexdigest()

def gen_ref_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

def check_session(session_id):
    if not session_id or len(session_id) < 32: return None
    rows = db(
        f"SELECT s.id, s.user_id, u.username, u.role, u.email FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id WHERE s.id = %s AND s.expires_at > NOW()",
        (session_id,)
    )
    return rows[0] if rows else None

def get_user_full(user_id):
    rows = db(f"SELECT id, username, email, role, tbank_token, binance_api_key, binance_secret_key, ref_code, referred_by, plan, created_at FROM {SCHEMA}.users WHERE id = %s", (user_id,))
    return rows[0] if rows else None

def create_session(user_id, ip="", ua=""):
    token = secrets.token_hex(32)
    db(f"INSERT INTO {SCHEMA}.sessions (id, user_id, ip, user_agent) VALUES (%s, %s, %s, %s)", (token, user_id, ip, ua[:250]))
    db(f"UPDATE {SCHEMA}.users SET last_login = NOW() WHERE id = %s", (user_id,))
    return token

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    headers = event.get("headers") or {}
    action = params.get("action", "")
    session_id = headers.get("x-session-id") or headers.get("X-Session-Id") or ""
    ip = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp", "")
    ua = headers.get("user-agent", "")

    # ── GET ────────────────────────────────────────────────────────────────
    if method == "GET":
        if action == "check":
            user = check_session(session_id)
            if not user:
                return resp({"ok": False, "error": "Сессия истекла"}, 401)
            return resp({"ok": True, "user": {"id": user["user_id"], "username": user["username"], "role": user["role"], "email": user["email"]}})

        if action == "profile":
            user = check_session(session_id)
            if not user: return resp({"ok": False, "error": "Не авторизован"}, 401)
            u = get_user_full(user["user_id"])
            if not u: return resp({"ok": False, "error": "Пользователь не найден"}, 404)
            # Скрываем секреты — показываем только наличие
            return resp({"ok": True, "user": {
                "id": u["id"], "username": u["username"], "email": u["email"] or "",
                "role": u["role"], "plan": u["plan"] or "free",
                "ref_code": u["ref_code"] or "",
                "has_tbank_token": bool(u["tbank_token"]),
                "has_binance_key": bool(u["binance_api_key"]),
                "created_at": str(u["created_at"]),
            }})

        if action == "admin_users":
            user = check_session(session_id)
            if not user or user["role"] != "admin": return resp({"ok": False, "error": "Нет доступа"}, 403)
            users = db(f"SELECT id, username, email, role, plan, ref_code, referred_by, is_active, created_at, last_login FROM {SCHEMA}.users ORDER BY id DESC")
            # Реферальный доход по каждому
            earnings = db(f"SELECT from_user_id, SUM(earned) as total FROM {SCHEMA}.referral_earnings WHERE owner_id = 1 GROUP BY from_user_id")
            earn_map = {e["from_user_id"]: float(e["total"]) for e in earnings}
            # Доход платформы по каждому пользователю
            platform_rev = db(f"SELECT user_id, SUM(revenue) as total FROM {SCHEMA}.platform_revenue GROUP BY user_id")
            platform_map = {p["user_id"]: float(p["total"]) for p in platform_rev}
            for u in users:
                u["ref_earn"]       = earn_map.get(u["id"], 0)
                u["platform_earn"]  = platform_map.get(u["id"], 0)
                u["created_at"]     = str(u["created_at"])
                u["last_login"]     = str(u["last_login"]) if u["last_login"] else None
            return resp({"ok": True, "users": users})

        if action == "admin_revenue":
            user = check_session(session_id)
            if not user or user["role"] != "admin": return resp({"ok": False, "error": "Нет доступа"}, 403)
            # Общий доход платформы
            total = db(f"SELECT COALESCE(SUM(revenue),0) as total FROM {SCHEMA}.platform_revenue")
            today = db(f"SELECT COALESCE(SUM(revenue),0) as total FROM {SCHEMA}.platform_revenue WHERE created_at > NOW() - INTERVAL '24 hours'")
            month = db(f"SELECT COALESCE(SUM(revenue),0) as total FROM {SCHEMA}.platform_revenue WHERE created_at > NOW() - INTERVAL '30 days'")
            # Доход по источникам
            by_source = db(f"SELECT source, COALESCE(SUM(revenue),0) as total, COUNT(*) as cnt FROM {SCHEMA}.platform_revenue GROUP BY source")
            # Последние транзакции
            recent = db(f"SELECT pr.id, u.username, pr.source, pr.trade_amount, pr.fee_pct, pr.revenue, pr.description, pr.created_at FROM {SCHEMA}.platform_revenue pr JOIN {SCHEMA}.users u ON u.id = pr.user_id ORDER BY pr.created_at DESC LIMIT 30")
            # Рефералы
            ref_total = db(f"SELECT COALESCE(SUM(earned),0) as total FROM {SCHEMA}.referral_earnings WHERE owner_id = 1")
            # Подписки
            subs = db(f"SELECT plan, COUNT(*) as cnt FROM {SCHEMA}.users WHERE plan != 'free' GROUP BY plan")
            # Настройки монетизации
            settings_rows = db(f"SELECT key, value FROM {SCHEMA}.bot_settings WHERE user_id = 1 AND key IN ('platform_fee_pct','price_basic_rub','price_pro_rub','ref_earn_pct')")
            settings = {r["key"]: r["value"] for r in settings_rows}
            return resp({"ok": True,
                "revenue_total":   float(total[0]["total"]),
                "revenue_today":   float(today[0]["total"]),
                "revenue_month":   float(month[0]["total"]),
                "ref_total":       float(ref_total[0]["total"]) if ref_total else 0,
                "by_source":       [{"source": s["source"], "total": float(s["total"]), "cnt": s["cnt"]} for s in by_source],
                "recent":          [{**r, "created_at": str(r["created_at"])} for r in recent],
                "subscriptions":   [{"plan": s["plan"], "cnt": s["cnt"]} for s in subs],
                "settings":        settings,
            })

        if action == "chat_messages":
            user = check_session(session_id)
            if not user: return resp({"ok": False, "error": "Не авторизован"}, 401)
            target_id = user["user_id"]
            if user["role"] == "admin" and params.get("user_id"):
                target_id = int(params.get("user_id"))
            rows = db(f"SELECT id, user_id, sender_role, message, is_broadcast, is_read, created_at FROM {SCHEMA}.chat_messages WHERE user_id = %s ORDER BY created_at ASC", (target_id,))
            # Отмечаем прочитанными сообщения от собеседника
            other_role = "admin" if user["role"] != "admin" else "user"
            db(f"UPDATE {SCHEMA}.chat_messages SET is_read = TRUE WHERE user_id = %s AND sender_role = %s AND is_read = FALSE", (target_id, other_role))
            return resp({"ok": True, "messages": [{**r, "created_at": str(r["created_at"])} for r in rows]})

        if action == "chat_unread":
            user = check_session(session_id)
            if not user: return resp({"ok": False, "error": "Не авторизован"}, 401)
            if user["role"] == "admin":
                cnt = db(f"SELECT COUNT(*) as c FROM {SCHEMA}.chat_messages WHERE sender_role = 'user' AND is_read = FALSE")
            else:
                cnt = db(f"SELECT COUNT(*) as c FROM {SCHEMA}.chat_messages WHERE user_id = %s AND sender_role = 'admin' AND is_read = FALSE", (user["user_id"],))
            return resp({"ok": True, "unread": cnt[0]["c"] if cnt else 0})

        if action == "chat_threads":
            user = check_session(session_id)
            if not user or user["role"] != "admin": return resp({"ok": False, "error": "Нет доступа"}, 403)
            rows = db(f"""
                SELECT u.id as user_id, u.username,
                    (SELECT message FROM {SCHEMA}.chat_messages m WHERE m.user_id = u.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
                    (SELECT created_at FROM {SCHEMA}.chat_messages m WHERE m.user_id = u.id ORDER BY m.created_at DESC LIMIT 1) as last_at,
                    (SELECT COUNT(*) FROM {SCHEMA}.chat_messages m WHERE m.user_id = u.id AND m.sender_role = 'user' AND m.is_read = FALSE) as unread
                FROM {SCHEMA}.users u
                WHERE EXISTS (SELECT 1 FROM {SCHEMA}.chat_messages m WHERE m.user_id = u.id)
                ORDER BY last_at DESC NULLS LAST
            """)
            return resp({"ok": True, "threads": [{**r, "last_at": str(r["last_at"]) if r["last_at"] else None} for r in rows]})

        if action == "ref_stats":
            user = check_session(session_id)
            if not user: return resp({"ok": False, "error": "Не авторизован"}, 401)
            uid = user["user_id"]
            # Рефералы этого пользователя
            refs = db(f"SELECT id, username, created_at FROM {SCHEMA}.users WHERE referred_by = %s", (uid,))
            total_earn = db(f"SELECT COALESCE(SUM(earned),0) as total FROM {SCHEMA}.referral_earnings WHERE owner_id = %s", (uid,))
            u = get_user_full(uid)
            return resp({"ok": True,
                "ref_code": u["ref_code"] or "",
                "ref_count": len(refs),
                "refs": [{"id": r["id"], "username": r["username"], "joined": str(r["created_at"])} for r in refs],
                "total_earned": float(total_earn[0]["total"]) if total_earn else 0,
            })

        return resp({"error": f"Неизвестный action: {action}"}, 400)

    # ── POST ───────────────────────────────────────────────────────────────
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        action = body.get("action", "")

        # ── Регистрация ──────────────────────────────────────────────────
        if action == "register":
            username = body.get("username", "").strip().lower()
            password = body.get("password", "")
            email = body.get("email", "").strip().lower()
            ref_code = body.get("ref_code", "").strip().upper()

            if len(username) < 3: return resp({"ok": False, "error": "Логин минимум 3 символа"}, 400)
            if len(password) < 6: return resp({"ok": False, "error": "Пароль минимум 6 символов"}, 400)
            if not username.replace("_","").replace("-","").isalnum():
                return resp({"ok": False, "error": "Логин: только буквы, цифры, _ -"}, 400)

            # Проверяем уникальность
            existing = db(f"SELECT id FROM {SCHEMA}.users WHERE username = %s", (username,))
            if existing: return resp({"ok": False, "error": "Логин уже занят"}, 400)

            # Реферер
            referrer_id = None
            if ref_code:
                ref_rows = db(f"SELECT id FROM {SCHEMA}.users WHERE ref_code = %s", (ref_code,))
                if ref_rows: referrer_id = ref_rows[0]["id"]

            # Генерируем реф-код для нового пользователя
            new_ref = gen_ref_code()
            while db(f"SELECT id FROM {SCHEMA}.users WHERE ref_code = %s", (new_ref,)):
                new_ref = gen_ref_code()

            # Создаём пользователя
            new_user = db(
                f"INSERT INTO {SCHEMA}.users (username, password_hash, role, email, ref_code, referred_by) VALUES (%s, %s, 'user', %s, %s, %s) RETURNING id, username, role",
                (username, hash_pw(password), email or None, new_ref, referrer_id)
            )
            user_id = new_user[0]["id"]

            # Создаём сессию сразу
            token = create_session(user_id, ip, ua)

            return resp({"ok": True, "session_id": token,
                "user": {"id": user_id, "username": username, "role": "user"},
                "ref_code": new_ref,
            })

        # ── Логин ────────────────────────────────────────────────────────
        if action == "login":
            username = body.get("username", "").strip().lower()
            password = body.get("password", "")
            if not username or not password:
                return resp({"ok": False, "error": "Введи логин и пароль"}, 400)
            rows = db(f"SELECT id, username, password_hash, role, is_active FROM {SCHEMA}.users WHERE username = %s", (username,))
            if not rows: return resp({"ok": False, "error": "Неверный логин или пароль"}, 401)
            u = rows[0]
            if not u["is_active"]: return resp({"ok": False, "error": "Аккаунт заблокирован"}, 403)
            if u["password_hash"] != hash_pw(password): return resp({"ok": False, "error": "Неверный логин или пароль"}, 401)
            token = create_session(u["id"], ip, ua)
            return resp({"ok": True, "session_id": token, "user": {"id": u["id"], "username": u["username"], "role": u["role"]}})

        # ── Логаут ───────────────────────────────────────────────────────
        if action == "logout":
            if session_id:
                db(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE id = %s", (session_id,))
            return resp({"ok": True})

        # ── Смена пароля ─────────────────────────────────────────────────
        if action == "change_password":
            user = check_session(session_id)
            if not user: return resp({"ok": False, "error": "Не авторизован"}, 401)
            old_pw = body.get("old_password", "")
            new_pw = body.get("new_password", "")
            if len(new_pw) < 6: return resp({"ok": False, "error": "Пароль минимум 6 символов"}, 400)
            rows = db(f"SELECT password_hash FROM {SCHEMA}.users WHERE id = %s", (user["user_id"],))
            if not rows or rows[0]["password_hash"] != hash_pw(old_pw):
                return resp({"ok": False, "error": "Старый пароль неверный"}, 401)
            db(f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE id = %s", (hash_pw(new_pw), user["user_id"]))
            return resp({"ok": True, "message": "Пароль изменён"})

        # ── Сохранить токены ─────────────────────────────────────────────
        if action == "save_tokens":
            user = check_session(session_id)
            if not user: return resp({"ok": False, "error": "Не авторизован"}, 401)
            uid = user["user_id"]
            tbank = body.get("tbank_token", "").strip()
            bkey = body.get("binance_api_key", "").strip()
            bsec = body.get("binance_secret_key", "").strip()
            # Обновляем только переданные поля
            if tbank: db(f"UPDATE {SCHEMA}.users SET tbank_token = %s WHERE id = %s", (tbank, uid))
            if bkey: db(f"UPDATE {SCHEMA}.users SET binance_api_key = %s WHERE id = %s", (bkey, uid))
            if bsec: db(f"UPDATE {SCHEMA}.users SET binance_secret_key = %s WHERE id = %s", (bsec, uid))
            return resp({"ok": True, "message": "Токены сохранены"})

        # ── Сброс токена ─────────────────────────────────────────────────
        if action == "clear_token":
            user = check_session(session_id)
            if not user: return resp({"ok": False, "error": "Не авторизован"}, 401)
            field = body.get("field", "")
            if field in ("tbank_token", "binance_api_key", "binance_secret_key"):
                db(f"UPDATE {SCHEMA}.users SET {field} = '' WHERE id = %s", (user["user_id"],))
            return resp({"ok": True})

        # ── Настройки реф.системы (только admin) ─────────────────────────
        if action == "save_ref_settings":
            user = check_session(session_id)
            if not user or user["role"] != "admin": return resp({"ok": False, "error": "Нет доступа"}, 403)
            pct = str(body.get("ref_earn_pct", "0.5"))
            mode = str(body.get("ref_earn_mode", "trade_amount"))
            db(f"INSERT INTO {SCHEMA}.bot_settings (user_id, key, value) VALUES (1, 'ref_earn_pct', %s) ON CONFLICT (user_id, key) DO UPDATE SET value = %s", (pct, pct))
            db(f"INSERT INTO {SCHEMA}.bot_settings (user_id, key, value) VALUES (1, 'ref_earn_mode', %s) ON CONFLICT (user_id, key) DO UPDATE SET value = %s", (mode, mode))
            return resp({"ok": True, "message": "Настройки реферальной системы сохранены"})

        # ── Настройки монетизации платформы (только admin) ───────────────
        if action == "save_monetization":
            user = check_session(session_id)
            if not user or user["role"] != "admin": return resp({"ok": False, "error": "Нет доступа"}, 403)
            for key in ("platform_fee_pct", "price_basic_rub", "price_pro_rub", "ref_earn_pct"):
                val = body.get(key)
                if val is not None:
                    db(f"INSERT INTO {SCHEMA}.bot_settings (user_id, key, value) VALUES (1, %s, %s) ON CONFLICT (user_id, key) DO UPDATE SET value = %s", (key, str(val), str(val)))
            return resp({"ok": True})

        # ── Назначить/убрать подписку пользователю (только admin) ────────
        if action == "set_user_plan":
            user = check_session(session_id)
            if not user or user["role"] != "admin": return resp({"ok": False, "error": "Нет доступа"}, 403)
            target_id = body.get("user_id")
            plan = body.get("plan", "free")
            if plan not in ("free", "basic", "pro"): return resp({"ok": False, "error": "Неверный план"}, 400)
            db(f"UPDATE {SCHEMA}.users SET plan = %s WHERE id = %s", (plan, target_id))
            # Записываем в subscriptions
            if plan != "free":
                price_row = db(f"SELECT value FROM {SCHEMA}.bot_settings WHERE user_id=1 AND key=%s", (f"price_{plan}_rub",))
                price = float(price_row[0]["value"]) if price_row else 0
                db(f"INSERT INTO {SCHEMA}.subscriptions (user_id, plan, price_rub, expires_at) VALUES (%s, %s, %s, NOW() + INTERVAL '30 days')", (target_id, plan, price))
                # Записываем доход платформы
                if price > 0:
                    db(f"INSERT INTO {SCHEMA}.platform_revenue (user_id, source, trade_amount, fee_pct, revenue, description) VALUES (%s, 'subscription', %s, 100, %s, %s)",
                       (target_id, price, price, f"Подписка {plan.upper()}"))
            return resp({"ok": True})

        # ── Сброс пароля (мастер-ключ) ────────────────────────────────────
        if action == "reset_password":
            if body.get("master_key") != "KIBERBOT_RESET_2024": return resp({"ok": False, "error": "Нет доступа"}, 403)
            new_pw = body.get("new_password", "")
            if len(new_pw) < 6: return resp({"ok": False, "error": "Пароль минимум 6 символов"}, 400)
            uname = body.get("username", "raziklon")
            new_hash = hash_pw(new_pw)
            db(f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE username = %s", (new_hash, uname))
            return resp({"ok": True, "hash": new_hash})

        # ── Отправка сообщения в чат (пользователь или админ отвечает) ────
        if action == "chat_send":
            user = check_session(session_id)
            if not user: return resp({"ok": False, "error": "Не авторизован"}, 401)
            message = body.get("message", "").strip()
            if not message: return resp({"ok": False, "error": "Пустое сообщение"}, 400)
            if len(message) > 2000: return resp({"ok": False, "error": "Слишком длинное сообщение"}, 400)
            if user["role"] == "admin":
                target_id = body.get("user_id")
                if not target_id: return resp({"ok": False, "error": "Не указан пользователь"}, 400)
                db(f"INSERT INTO {SCHEMA}.chat_messages (user_id, sender_role, message) VALUES (%s, 'admin', %s)", (target_id, message))
            else:
                db(f"INSERT INTO {SCHEMA}.chat_messages (user_id, sender_role, message) VALUES (%s, 'user', %s)", (user["user_id"], message))
            return resp({"ok": True})

        # ── Массовая рассылка всем пользователям (только admin) ───────────
        if action == "chat_broadcast":
            user = check_session(session_id)
            if not user or user["role"] != "admin": return resp({"ok": False, "error": "Нет доступа"}, 403)
            message = body.get("message", "").strip()
            if not message: return resp({"ok": False, "error": "Пустое сообщение"}, 400)
            if len(message) > 2000: return resp({"ok": False, "error": "Слишком длинное сообщение"}, 400)
            users = db(f"SELECT id FROM {SCHEMA}.users WHERE is_active = TRUE")
            for u in users:
                db(f"INSERT INTO {SCHEMA}.chat_messages (user_id, sender_role, message, is_broadcast) VALUES (%s, 'admin', %s, TRUE)", (u["id"], message))
            return resp({"ok": True, "sent_to": len(users)})

        # ── Забыл пароль (по username + email) ───────────────────────────
        if action == "forgot_password":
            username = body.get("username", "").strip().lower()
            email = body.get("email", "").strip().lower()
            if not username or not email:
                return resp({"ok": False, "error": "Введи логин и email"}, 400)
            rows = db(f"SELECT id, email FROM {SCHEMA}.users WHERE username = %s", (username,))
            if not rows:
                return resp({"ok": False, "error": "Пользователь не найден"}, 404)
            u = rows[0]
            if not u["email"] or u["email"].lower() != email:
                return resp({"ok": False, "error": "Email не совпадает с указанным при регистрации"}, 400)
            # Генерируем временный пароль
            new_pw = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
            db(f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE id = %s", (hash_pw(new_pw), u["id"]))
            return resp({"ok": True, "new_password": new_pw})

        return resp({"error": f"Неизвестный action: {action}"}, 400)

    return resp({"error": "Метод не поддерживается"}, 405)