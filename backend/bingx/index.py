"""
BingX API интеграция — баланс, спот-торговля, фьючерсы, скальпинг.
"""
import os, json, time, hmac, hashlib, requests
from datetime import datetime, timezone
import psycopg2

DB_URL = os.environ.get("DATABASE_URL", "")
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p28097026_crypto_bot_profit")
BINGX_BASE = "https://open-api.bingx.com"

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

def check_session(sid):
    if not sid or len(sid) < 32: return None
    rows = db(f"SELECT s.user_id, u.username, u.role, u.bingx_api_key, u.bingx_secret_key FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id WHERE s.id = %s AND s.expires_at > NOW()", (sid,))
    return rows[0] if rows else None

# ── BingX подпись ─────────────────────────────────────────────────────────────
def bx_sign(secret: str, params: dict) -> str:
    qs = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    return hmac.new(secret.encode(), qs.encode(), hashlib.sha256).hexdigest()

def bx(method: str, path: str, api_key: str, secret: str, params: dict = None) -> dict:
    params = params or {}
    params["timestamp"] = int(time.time() * 1000)
    params["signature"] = bx_sign(secret, params)
    headers = {"X-BX-APIKEY": api_key}
    url = BINGX_BASE + path
    if method == "GET":
        r = requests.get(url, params=params, headers=headers, timeout=15)
    else:
        r = requests.post(url, params=params, headers=headers, timeout=15)
    return r.json()

def bx_pub(path: str, params: dict = None) -> dict:
    r = requests.get(BINGX_BASE + path, params=params or {}, timeout=10)
    return r.json()

# ── Вычислить RSI по свечам ───────────────────────────────────────────────────
def calc_rsi(closes: list, period=14) -> float:
    if len(closes) < period + 1: return 50.0
    gains, losses = [], []
    for i in range(1, len(closes)):
        d = closes[i] - closes[i-1]
        gains.append(max(d, 0)); losses.append(max(-d, 0))
    ag = sum(gains[-period:]) / period
    al = sum(losses[-period:]) / period
    if al == 0: return 100.0
    return round(100 - 100 / (1 + ag / al), 2)

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    headers = event.get("headers") or {}
    body = json.loads(event.get("body") or "{}") if method == "POST" else {}
    action = params.get("action") or body.get("action", "")
    sid = headers.get("x-session-id") or headers.get("X-Session-Id") or ""
    user = check_session(sid)
    if not user: return resp({"error": "Не авторизован"}, 401)

    uid = user["user_id"]
    api_key = user.get("bingx_api_key") or ""
    secret = user.get("bingx_secret_key") or ""

    # ── Сохранить API ключи ──────────────────────────────────────────────────
    if action == "save_keys":
        new_key = body.get("api_key", "").strip()
        new_secret = body.get("secret_key", "").strip()
        if not new_key or not new_secret:
            return resp({"error": "Введите оба ключа"}, 400)
        db(f"UPDATE {SCHEMA}.users SET bingx_api_key=%s, bingx_secret_key=%s WHERE id=%s",
           (new_key, new_secret, uid))
        return resp({"ok": True})

    # ── Проверить наличие ключей ─────────────────────────────────────────────
    has_keys = bool(api_key and secret)
    if action == "check_keys":
        return resp({"has_keys": has_keys, "api_key_preview": api_key[:8] + "..." if api_key else ""})

    if not has_keys:
        return resp({"error": "Добавьте API ключи BingX в настройках"}, 400)

    # ── Баланс (спот) ────────────────────────────────────────────────────────
    if action == "balance":
        data = bx("GET", "/openApi/spot/v1/account/balance", api_key, secret)
        balances = data.get("data", {}).get("balances", [])
        result = [b for b in balances if float(b.get("free", 0)) > 0 or float(b.get("locked", 0)) > 0]
        return resp({"ok": True, "balances": result})

    # ── Баланс фьючерсов ─────────────────────────────────────────────────────
    if action == "futures_balance":
        data = bx("GET", "/openApi/swap/v2/user/balance", api_key, secret)
        return resp({"ok": True, "data": data.get("data", {})})

    # ── Открытые фьючерс-позиции ─────────────────────────────────────────────
    if action == "futures_positions":
        data = bx("GET", "/openApi/swap/v2/user/positions", api_key, secret)
        positions = data.get("data", [])
        open_pos = [p for p in positions if float(p.get("positionAmt", 0)) != 0]
        return resp({"ok": True, "positions": open_pos})

    # ── Открыть фьючерс ─────────────────────────────────────────────────────
    if action == "futures_open":
        symbol = body.get("symbol", "BTC-USDT")
        side = body.get("side", "BUY")       # BUY=LONG, SELL=SHORT
        amount = float(body.get("amount", 10))
        leverage = int(body.get("leverage", 10))
        # Установить плечо
        bx("POST", "/openApi/swap/v2/trade/leverage", api_key, secret,
           {"symbol": symbol, "side": side, "leverage": leverage})
        # Открыть позицию
        order = bx("POST", "/openApi/swap/v2/trade/order", api_key, secret, {
            "symbol": symbol,
            "side": side,
            "positionSide": "LONG" if side == "BUY" else "SHORT",
            "type": "MARKET",
            "quantity": amount,
        })
        return resp({"ok": True, "order": order.get("data", order)})

    # ── Закрыть фьючерс-позицию ──────────────────────────────────────────────
    if action == "futures_close":
        symbol = body.get("symbol", "BTC-USDT")
        pos_side = body.get("pos_side", "LONG")
        amount = float(body.get("amount", 0))
        close_side = "SELL" if pos_side == "LONG" else "BUY"
        order = bx("POST", "/openApi/swap/v2/trade/order", api_key, secret, {
            "symbol": symbol,
            "side": close_side,
            "positionSide": pos_side,
            "type": "MARKET",
            "quantity": amount,
        })
        return resp({"ok": True, "order": order.get("data", order)})

    # ── Спот: список инструментов ────────────────────────────────────────────
    if action == "spot_tickers":
        data = bx_pub("/openApi/spot/v1/ticker/24hr")
        tickers = data.get("data", [])
        usdt = [t for t in tickers if t.get("symbol", "").endswith("-USDT")]
        usdt.sort(key=lambda x: float(x.get("quoteVolume", 0)), reverse=True)
        return resp({"ok": True, "tickers": usdt[:50]})

    # ── Спот: купить ─────────────────────────────────────────────────────────
    if action == "spot_buy":
        symbol = body.get("symbol", "BTC-USDT")
        quote_qty = float(body.get("amount", 10))
        order = bx("POST", "/openApi/spot/v1/trade/order", api_key, secret, {
            "symbol": symbol,
            "side": "BUY",
            "type": "MARKET",
            "quoteOrderQty": quote_qty,
        })
        err = order.get("msg") or order.get("error")
        if err and order.get("code", 0) != 0:
            return resp({"ok": False, "error": err})
        data = order.get("data", {})
        db(f"INSERT INTO {SCHEMA}.bingx_spot_trades (user_id, symbol, side, quantity, price, amount_usdt, order_id) VALUES (%s,%s,'BUY',%s,%s,%s,%s)",
           (uid, symbol, float(data.get("executedQty", 0)), float(data.get("price", 0)), quote_qty, data.get("orderId", "")))
        return resp({"ok": True, "order": data})

    # ── Спот: продать ────────────────────────────────────────────────────────
    if action == "spot_sell":
        symbol = body.get("symbol", "BTC-USDT")
        qty = float(body.get("quantity", 0))
        order = bx("POST", "/openApi/spot/v1/trade/order", api_key, secret, {
            "symbol": symbol,
            "side": "SELL",
            "type": "MARKET",
            "quantity": qty,
        })
        err = order.get("msg") or order.get("error")
        if err and order.get("code", 0) != 0:
            return resp({"ok": False, "error": err})
        data = order.get("data", {})
        return resp({"ok": True, "order": data})

    # ── Скальпинг: цикл (RSI+объём на 1m свечах) ─────────────────────────────
    if action == "scalp_cycle":
        us = db(f"SELECT key, value FROM {SCHEMA}.user_settings WHERE user_id = %s", (uid,))
        us_map = {r["key"]: r["value"] for r in us}
        amount = float(us_map.get("bingx_scalp_amount", 20))
        target_pct = float(us_map.get("bingx_scalp_target", 0.8))
        stop_pct = float(us_map.get("bingx_scalp_stop", 1.5))

        # 1. Закрываем прибыльные/убыточные спот-позиции
        open_trades = db(f"SELECT * FROM {SCHEMA}.bingx_spot_trades WHERE user_id=%s AND status='open'", (uid,))
        sold = []
        for trade in open_trades:
            lp = bx_pub("/openApi/spot/v1/ticker/price", {"symbol": trade["symbol"]})
            cur = float((lp.get("data") or {}).get("trades", [{}])[0].get("price", 0) if isinstance(lp.get("data"), list) else lp.get("data", {}).get("price", 0))
            if cur <= 0: continue
            bp = float(trade["price"]) if trade["price"] else 0
            if bp <= 0: continue
            chg = (cur - bp) / bp * 100
            if chg >= target_pct or chg <= -stop_pct:
                sell = bx("POST", "/openApi/spot/v1/trade/order", api_key, secret, {
                    "symbol": trade["symbol"], "side": "SELL", "type": "MARKET",
                    "quantity": float(trade["quantity"]),
                })
                pnl = round((cur - bp) * float(trade["quantity"]), 4)
                db(f"UPDATE {SCHEMA}.bingx_spot_trades SET status='closed', close_price=%s, pnl=%s, closed_at=NOW() WHERE id=%s",
                   (cur, pnl, trade["id"]))
                sold.append({"symbol": trade["symbol"], "pnl": pnl, "reason": "TARGET" if chg >= target_pct else "STOP"})

        # 2. Ищем сигналы RSI на топ-символах
        tickers_r = bx_pub("/openApi/spot/v1/ticker/24hr")
        tickers_all = tickers_r.get("data", [])
        usdt = [t for t in tickers_all if t.get("symbol", "").endswith("-USDT")]
        usdt.sort(key=lambda x: float(x.get("quoteVolume", 0)), reverse=True)
        candidates = usdt[:20]

        open_count = len(db(f"SELECT id FROM {SCHEMA}.bingx_spot_trades WHERE user_id=%s AND status='open'", (uid,)))
        bought = []

        bal_r = bx("GET", "/openApi/spot/v1/account/balance", api_key, secret)
        usdt_bal = next((float(b.get("free", 0)) for b in bal_r.get("data", {}).get("balances", []) if b["asset"] == "USDT"), 0)

        for t in candidates:
            if open_count >= 5 or usdt_bal < amount * 0.9: break
            sym = t["symbol"]
            # Получаем 1m свечи
            klines_r = bx_pub("/openApi/spot/v1/market/kline", {"symbol": sym, "interval": "1m", "limit": 30})
            klines = klines_r.get("data", [])
            if len(klines) < 16: continue
            closes = [float(k[4]) for k in klines]
            rsi = calc_rsi(closes)
            vol_ratio = float(klines[-1][5]) / (sum(float(k[5]) for k in klines[-10:-1]) / 9 + 0.0001)
            if rsi < 35 and vol_ratio > 1.3:
                price = closes[-1]
                qty = round(amount / price, 6)
                order = bx("POST", "/openApi/spot/v1/trade/order", api_key, secret, {
                    "symbol": sym, "side": "BUY", "type": "MARKET", "quoteOrderQty": amount,
                })
                if order.get("code", -1) == 0:
                    d = order.get("data", {})
                    exec_qty = float(d.get("executedQty", qty))
                    exec_price = float(d.get("price", price)) or price
                    db(f"INSERT INTO {SCHEMA}.bingx_spot_trades (user_id, symbol, side, quantity, price, amount_usdt, order_id, target_pct, stop_pct) VALUES (%s,%s,'BUY',%s,%s,%s,%s,%s,%s)",
                       (uid, sym, exec_qty, exec_price, amount, d.get("orderId",""), target_pct, stop_pct))
                    usdt_bal -= amount
                    open_count += 1
                    bought.append({"symbol": sym, "rsi": rsi, "price": exec_price, "qty": exec_qty})

        return resp({"ok": True, "sold": sold, "bought": bought, "open_count": open_count})

    # ── История спот-сделок ──────────────────────────────────────────────────
    if action == "spot_history":
        trades = db(f"SELECT * FROM {SCHEMA}.bingx_spot_trades WHERE user_id=%s ORDER BY created_at DESC LIMIT 50", (uid,))
        return resp({"ok": True, "trades": trades})

    # ── Настройки скальпера BingX ────────────────────────────────────────────
    if action == "save_scalp_settings":
        for key in ["bingx_scalp_amount", "bingx_scalp_target", "bingx_scalp_stop"]:
            val = str(body.get(key, ""))
            if val:
                existing = db(f"SELECT id FROM {SCHEMA}.user_settings WHERE user_id=%s AND key=%s", (uid, key))
                if existing:
                    db(f"UPDATE {SCHEMA}.user_settings SET value=%s WHERE user_id=%s AND key=%s", (val, uid, key))
                else:
                    db(f"INSERT INTO {SCHEMA}.user_settings (user_id, key, value) VALUES (%s,%s,%s)", (uid, key, val))
        return resp({"ok": True})

    return resp({"error": f"Неизвестный action: {action}"}, 400)
