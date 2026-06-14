"""
Платёжный бэкенд КиберБот — подписки через Robokassa и ЮKassa.
Поддерживает: создание платежа, вебхук подтверждения, статус подключения.
"""
import os, json, hashlib, uuid, time, urllib.request, base64
import psycopg2

DB_URL  = os.environ.get("DATABASE_URL", "")
SCHEMA  = os.environ.get("MAIN_DB_SCHEMA", "t_p28097026_crypto_bot_profit")

# Robokassa
RK_LOGIN    = os.environ.get("ROBOKASSA_LOGIN", "")
RK_PASS1    = os.environ.get("ROBOKASSA_PASS1", "")
RK_PASS2    = os.environ.get("ROBOKASSA_PASS2", "")
RK_TEST     = os.environ.get("ROBOKASSA_TEST", "1")   # "1" = тест, "0" = боевой

# ЮKassa
YK_SHOP     = os.environ.get("YOOKASSA_SHOP_ID", "")
YK_KEY      = os.environ.get("YOOKASSA_SECRET_KEY", "")

CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
}

PLANS = {
    "basic": {"name": "BASIC", "price_rub": 490,  "desc": "Автотрейдинг + Авто-продажа %"},
    "pro":   {"name": "PRO",   "price_rub": 990,  "desc": "Скальпинг + всё из BASIC"},
}

def resp(body, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False, default=str)}

def db(sql, params=()):
    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor()
    cur.execute(sql, params)
    conn.commit()
    rows = cur.fetchall() if cur.description else []
    cols = [d[0] for d in cur.description] if cur.description else []
    cur.close(); conn.close()
    return [dict(zip(cols, r)) for r in rows]

def check_session(sid):
    if not sid or len(sid) < 32: return None
    rows = db(f"SELECT s.user_id, u.username, u.role FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id=s.user_id WHERE s.id=%s AND s.expires_at>NOW()", (sid,))
    return rows[0] if rows else None

def get_plan_price(plan):
    """Читает актуальную цену из bot_settings (если admin изменил) или из PLANS."""
    row = db(f"SELECT value FROM {SCHEMA}.bot_settings WHERE user_id=1 AND key=%s", (f"price_{plan}_rub",))
    return int(float(row[0]["value"])) if row else PLANS.get(plan, {}).get("price_rub", 0)

def activate_subscription(user_id, plan, payment_id, provider):
    """Активирует подписку пользователю на 30 дней."""
    price = get_plan_price(plan)
    db(f"UPDATE {SCHEMA}.users SET plan=%s WHERE id=%s", (plan, user_id))
    db(f"INSERT INTO {SCHEMA}.subscriptions (user_id, plan, price_rub, expires_at, payment_id) VALUES (%s,%s,%s,NOW()+INTERVAL '30 days',%s)",
       (user_id, plan, price, payment_id))
    if price > 0:
        db(f"INSERT INTO {SCHEMA}.platform_revenue (user_id, source, trade_amount, fee_pct, revenue, description) VALUES (%s,'subscription',%s,100,%s,%s)",
           (user_id, price, price, f"Подписка {plan.upper()} через {provider}"))
    print(f"[subscription] uid={user_id} plan={plan} price={price} provider={provider} payment_id={payment_id}")

# ── Robokassa ──────────────────────────────────────────────────────────────────

def rk_sign1(amount, inv_id, desc=""):
    """Подпись для создания платежа (PASS1)."""
    raw = f"{RK_LOGIN}:{amount:.2f}:{inv_id}:{RK_PASS1}"
    return hashlib.md5(raw.encode()).hexdigest().upper()

def rk_sign2(amount, inv_id):
    """Подпись для верификации вебхука (PASS2)."""
    raw = f"{amount:.2f}:{inv_id}:{RK_PASS2}"
    return hashlib.md5(raw.encode()).hexdigest().upper()

def rk_payment_url(amount, inv_id, desc, user_id, plan):
    sig   = rk_sign1(amount, inv_id)
    test  = f"&IsTest={RK_TEST}" if RK_TEST == "1" else ""
    # shp_ параметры передаются обратно в вебхуке
    shp   = f"&shp_user_id={user_id}&shp_plan={plan}"
    url   = (f"https://auth.robokassa.ru/Merchant/Index.aspx"
             f"?MerchantLogin={RK_LOGIN}&OutSum={amount:.2f}&InvId={inv_id}"
             f"&Description={urllib.request.quote(desc)}&SignatureValue={sig}{shp}{test}")
    return url

# ── ЮKassa ────────────────────────────────────────────────────────────────────

def yk_create_payment(amount, plan, user_id, return_url):
    """Создаёт платёж в ЮKassa, возвращает (payment_id, confirmation_url)."""
    idempotence = str(uuid.uuid4())
    payload = json.dumps({
        "amount":      {"value": f"{amount:.2f}", "currency": "RUB"},
        "confirmation": {"type": "redirect", "return_url": return_url},
        "capture": True,
        "description": f"Подписка {plan.upper()} КиберБот · uid={user_id}",
        "metadata":    {"user_id": str(user_id), "plan": plan},
    }).encode()
    creds = base64.b64encode(f"{YK_SHOP}:{YK_KEY}".encode()).decode()
    req   = urllib.request.Request(
        "https://api.yookassa.ru/v3/payments",
        data=payload,
        headers={"Authorization": f"Basic {creds}", "Content-Type": "application/json",
                 "Idempotence-Key": idempotence},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        d = json.loads(r.read().decode())
    return d["id"], d.get("confirmation", {}).get("confirmation_url", "")

# ── Handler ───────────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Платёжный эндпоинт: создание платежа и обработка вебхуков."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method  = event.get("httpMethod", "GET")
    params  = event.get("queryStringParameters") or {}
    headers = event.get("headers") or {}
    sid     = headers.get("x-session-id") or headers.get("X-Session-Id") or ""

    # ── GET: статус подключения и планы ───────────────────────────────────────
    if method == "GET":
        action = params.get("action", "status")

        if action == "status":
            plans_out = {}
            for key, p in PLANS.items():
                plans_out[key] = {**p, "price_rub": get_plan_price(key)}
            return resp({
                "robokassa": {
                    "connected": bool(RK_LOGIN and RK_PASS1 and RK_PASS2),
                    "test_mode": RK_TEST == "1",
                    "login":     RK_LOGIN or "",
                },
                "yookassa": {
                    "connected": bool(YK_SHOP and YK_KEY),
                    "shop_id":   YK_SHOP or "",
                },
                "plans": plans_out,
            })

        # Статус конкретного платежа ЮKassa (для polling)
        if action == "yk_payment" and params.get("payment_id"):
            if not (YK_SHOP and YK_KEY):
                return resp({"error": "ЮKassa не подключена"}, 400)
            pid   = params["payment_id"]
            creds = base64.b64encode(f"{YK_SHOP}:{YK_KEY}".encode()).decode()
            req   = urllib.request.Request(
                f"https://api.yookassa.ru/v3/payments/{pid}",
                headers={"Authorization": f"Basic {creds}"},
            )
            with urllib.request.urlopen(req, timeout=10) as r:
                d = json.loads(r.read().decode())
            return resp({"status": d.get("status"), "paid": d.get("paid", False)})

        return resp({"error": "Unknown action"}, 400)

    # ── POST ──────────────────────────────────────────────────────────────────
    if method == "POST":
        body   = json.loads(event.get("body") or "{}")
        action = body.get("action", "")

        # ── Создать платёж (пользователь выбирает тариф) ─────────────────────
        if action == "create_payment":
            user = check_session(sid)
            if not user: return resp({"error": "Не авторизован"}, 401)

            plan     = body.get("plan", "")
            provider = body.get("provider", "robokassa")  # robokassa | yookassa
            if plan not in PLANS:
                return resp({"error": "Неверный план"}, 400)

            uid    = user["user_id"]
            amount = float(get_plan_price(plan))
            if amount <= 0:
                return resp({"error": "Цена плана не задана"}, 400)

            if provider == "robokassa":
                if not (RK_LOGIN and RK_PASS1):
                    return resp({"error": "Robokassa не подключена. Добавь ключи в Настройки → Платёжки."}, 400)
                inv_id = int(time.time()) % 2147483647
                desc   = f"Подписка {plan.upper()} КиберБот"
                url    = rk_payment_url(amount, inv_id, desc, uid, plan)
                # Сохраняем pending-платёж
                db(f"INSERT INTO {SCHEMA}.subscriptions (user_id, plan, price_rub, payment_id, is_active) VALUES (%s,%s,%s,%s,false)",
                   (uid, plan, amount, str(inv_id)))
                return resp({"ok": True, "provider": "robokassa", "payment_url": url, "inv_id": inv_id})

            if provider == "yookassa":
                if not (YK_SHOP and YK_KEY):
                    return resp({"error": "ЮKassa не подключена. Добавь ключи в Настройки → Платёжки."}, 400)
                return_url = body.get("return_url", "https://crypto-bot-profit.poehali.dev/")
                pid, conf_url = yk_create_payment(amount, plan, uid, return_url)
                db(f"INSERT INTO {SCHEMA}.subscriptions (user_id, plan, price_rub, payment_id, is_active) VALUES (%s,%s,%s,%s,false)",
                   (uid, plan, amount, pid))
                return resp({"ok": True, "provider": "yookassa", "payment_url": conf_url, "payment_id": pid})

            return resp({"error": "Неверный провайдер"}, 400)

        # ── Вебхук Robokassa (ResultURL) ──────────────────────────────────────
        if action == "robokassa_webhook":
            out_sum  = body.get("OutSum", "")
            inv_id   = body.get("InvId", "")
            sign_in  = (body.get("SignatureValue") or "").upper()
            user_id  = body.get("shp_user_id", "")
            plan     = body.get("shp_plan", "")

            if not (RK_PASS2 and out_sum and inv_id):
                return resp({"error": "Неверные параметры"}, 400)

            expected = rk_sign2(float(out_sum), int(inv_id))
            if sign_in != expected:
                print(f"[rk_webhook] INVALID SIG: got={sign_in} expected={expected}")
                return resp({"error": "Неверная подпись"}, 400)

            activate_subscription(int(user_id), plan, str(inv_id), "robokassa")
            # Robokassa ожидает ответ "OK{InvId}"
            return {"statusCode": 200, "headers": CORS, "body": f"OK{inv_id}"}

        # ── Вебхук ЮKassa ─────────────────────────────────────────────────────
        if action == "yookassa_webhook":
            event_type = body.get("event", "")
            obj        = body.get("object", {})
            if event_type != "payment.succeeded":
                return resp({"ok": True, "skipped": event_type})

            pid      = obj.get("id", "")
            meta     = obj.get("metadata", {})
            user_id  = meta.get("user_id", "")
            plan     = meta.get("plan", "")

            if not (pid and user_id and plan):
                return resp({"error": "Нет метаданных"}, 400)

            # Проверяем IP ЮKassa (опционально, для надёжности)
            activate_subscription(int(user_id), plan, pid, "yookassa")
            return resp({"ok": True})

        return resp({"error": f"Unknown action: {action}"}, 400)

    return resp({"error": "Method not allowed"}, 405)
