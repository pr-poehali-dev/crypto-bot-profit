"""
Скальпинг-бот КиберБот — краткосрочные сделки с авто-продажей по заданному %.
Анализирует волатильность, объём, RSI на коротких таймфреймах.
Продаёт при достижении target_pct прибыли или stop_pct убытка.
"""
import os, json, requests, random
from datetime import datetime, timedelta, timezone
import psycopg2

DB_URL = os.environ.get("DATABASE_URL", "")
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p28097026_crypto_bot_profit")

CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Session-Id"}

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
    rows = db(f"SELECT s.user_id, u.username, u.role, u.tbank_token FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id WHERE s.id = %s AND s.expires_at > NOW()", (sid,))
    return rows[0] if rows else None

def money(m):
    if not m: return 0.0
    return float(m.get("units", 0)) + float(m.get("nano", 0)) / 1_000_000_000

def tb(path, payload, token):
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    r = requests.post(f"https://invest-public-api.tinkoff.ru/rest/{path}", headers=h, json=payload, timeout=15)
    return r.json()

def get_candles(figi, token, interval="CANDLE_INTERVAL_5_MIN", hours=6):
    now = datetime.now(timezone.utc)
    d = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetCandles", {
        "figi": figi,
        "from": (now - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "interval": interval,
    }, token)
    return d.get("candles", [])

def rsi(prices, period=14):
    if len(prices) < period + 1: return 50
    gains = [max(prices[i]-prices[i-1], 0) for i in range(1, len(prices))]
    losses = [max(prices[i-1]-prices[i], 0) for i in range(1, len(prices))]
    ag = sum(gains[-period:]) / period
    al = sum(losses[-period:]) / period
    if al == 0: return 100
    return round(100 - 100 / (1 + ag / al), 1)

def volatility_score(candles):
    """Оценка волатильности — чем выше тем лучше для скальпинга."""
    if len(candles) < 5: return 0
    ranges = [(money(c.get("high")) - money(c.get("low"))) / max(money(c.get("low")), 0.01) * 100 for c in candles[-10:]]
    return sum(ranges) / len(ranges)

def volume_score(candles):
    """Рост объёма относительно среднего."""
    if len(candles) < 5: return 0
    vols = [float(c.get("volume", 0)) for c in candles]
    avg = sum(vols[:-3]) / max(len(vols[:-3]), 1)
    recent = sum(vols[-3:]) / 3
    return recent / max(avg, 1)

def score_instrument(figi, token):
    """Комплексная оценка инструмента для скальпинга (0-100)."""
    candles = get_candles(figi, token, interval="CANDLE_INTERVAL_5_MIN", hours=3)
    if len(candles) < 15: return 0, 50, 0
    prices = [money(c.get("close")) for c in candles if c.get("isComplete")]
    if len(prices) < 14: return 0, 50, 0
    r = rsi(prices)
    vol = volatility_score(candles)
    vm = volume_score(candles)
    # Хороший скальпинг: RSI в зоне 35-45 (дно) или 55-65 (рост), волатильность > 0.3%, объём растёт
    rsi_score = 0
    if 30 <= r <= 45: rsi_score = 80  # перепроданность — хорошая покупка
    elif 45 <= r <= 55: rsi_score = 40
    elif 55 <= r <= 70: rsi_score = 60
    vol_score = min(vol * 20, 100)
    vm_score = min((vm - 1) * 50, 100) if vm > 1 else 0
    total = rsi_score * 0.4 + vol_score * 0.35 + vm_score * 0.25
    return round(total, 1), r, round(vol, 3)

def add_referral_earning(user_id, trade_amount, token):
    """Начислить реферальный доход владельцу."""
    ref = db(f"SELECT referred_by FROM {SCHEMA}.users WHERE id = %s", (user_id,))
    if not ref or not ref[0]["referred_by"]: return
    owner_id = ref[0]["referred_by"]
    pct_rows = db(f"SELECT value FROM {SCHEMA}.bot_settings WHERE key = 'ref_earn_pct' AND user_id = 1")
    pct = float(pct_rows[0]["value"]) if pct_rows else 0.5
    earned = round(trade_amount * pct / 100, 2)
    if earned <= 0: return
    db(f"INSERT INTO {SCHEMA}.referral_earnings (owner_id, from_user_id, trade_amount, earn_pct, earned) VALUES (%s, %s, %s, %s, %s)",
       (owner_id, user_id, trade_amount, pct, earned))

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    headers = event.get("headers") or {}
    action = params.get("action", "")
    sid = headers.get("x-session-id") or headers.get("X-Session-Id") or ""
    user = check_session(sid)
    if not user: return resp({"error": "Не авторизован"}, 401)

    uid = user["user_id"]
    token = user.get("tbank_token") or ""
    if not token: return resp({"error": "Добавьте токен Т-Банк в настройках профиля"}, 400)

    # ── GET: статус и открытые позиции ─────────────────────────────────────
    if method == "GET" and action == "status":
        open_trades = db(f"SELECT * FROM {SCHEMA}.scalp_trades WHERE user_id = %s AND status = 'open' ORDER BY opened_at DESC", (uid,))
        closed_today = db(f"SELECT COUNT(*) as cnt, COALESCE(SUM(pnl),0) as pnl FROM {SCHEMA}.scalp_trades WHERE user_id = %s AND status = 'closed' AND closed_at > NOW() - INTERVAL '24 hours'", (uid,))
        settings_rows = db(f"SELECT key, value FROM {SCHEMA}.bot_settings WHERE user_id = 1 AND key IN ('scalp_enabled','scalp_default_target_pct','scalp_default_stop_pct')")
        settings = {r["key"]: r["value"] for r in settings_rows}
        user_settings = db(f"SELECT key, value FROM {SCHEMA}.user_settings WHERE user_id = %s AND key IN ('scalp_target_pct','scalp_stop_pct','scalp_amount','scalp_enabled')", (uid,))
        us = {r["key"]: r["value"] for r in user_settings}
        return resp({
            "open_trades": open_trades,
            "trades_today": int(closed_today[0]["cnt"]) if closed_today else 0,
            "pnl_today": float(closed_today[0]["pnl"]) if closed_today else 0,
            "settings": {
                "target_pct": float(us.get("scalp_target_pct", settings.get("scalp_default_target_pct", 1.0))),
                "stop_pct": float(us.get("scalp_stop_pct", settings.get("scalp_default_stop_pct", 2.0))),
                "amount": float(us.get("scalp_amount", 1000)),
                "enabled": us.get("scalp_enabled", "false") == "true",
            }
        })

    if method == "GET" and action == "history":
        trades = db(f"SELECT * FROM {SCHEMA}.scalp_trades WHERE user_id = %s ORDER BY opened_at DESC LIMIT 50", (uid,))
        return resp({"trades": trades})

    if method == "GET" and action == "scan":
        # Сканируем рынок — топ инструментов для скальпинга
        watchlist_rows = db(f"SELECT value FROM {SCHEMA}.bot_settings WHERE key = 'watchlist_cache' AND user_id = 1")
        if not watchlist_rows: return resp({"candidates": []})
        all_inst = json.loads(watchlist_rows[0]["value"])
        sample = random.sample(all_inst, min(20, len(all_inst)))
        candidates = []
        for inst in sample:
            score, rsi_val, vol = score_instrument(inst["figi"], token)
            if score >= 50:
                lp = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices", {"figi": [inst["figi"]]}, token)
                price = money(lp.get("lastPrices", [{}])[0].get("price")) if lp.get("lastPrices") else 0
                if price > 0:
                    candidates.append({"figi": inst["figi"], "ticker": inst["ticker"], "name": inst["name"], "score": score, "rsi": rsi_val, "volatility": vol, "price": price, "lot": inst.get("lot", 1)})
        candidates.sort(key=lambda x: x["score"], reverse=True)
        return resp({"candidates": candidates[:10]})

    # ── POST ───────────────────────────────────────────────────────────────
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        action = body.get("action", "")

        if action == "save_settings":
            target = str(body.get("target_pct", 1.0))
            stop = str(body.get("stop_pct", 2.0))
            amount = str(body.get("amount", 1000))
            enabled = "true" if body.get("enabled") else "false"
            for k, v in [("scalp_target_pct", target), ("scalp_stop_pct", stop), ("scalp_amount", amount), ("scalp_enabled", enabled)]:
                db(f"INSERT INTO {SCHEMA}.user_settings (user_id, key, value) VALUES (%s, %s, %s) ON CONFLICT (user_id, key) DO UPDATE SET value = %s, updated_at = NOW()", (uid, k, v, v))
            return resp({"ok": True})

        if action == "buy":
            figi = body.get("figi", "")
            ticker = body.get("ticker", "")
            lots = int(body.get("lots", 1))
            target_pct = float(body.get("target_pct", 1.0))
            stop_pct = float(body.get("stop_pct", 2.0))
            # Выставляем рыночный ордер
            order = tb("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", {
                "accountId": (tb("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {}, token).get("accounts", [{}])[0].get("id", "")),
                "figi": figi, "direction": "ORDER_DIRECTION_BUY",
                "quantity": lots, "orderType": "ORDER_TYPE_MARKET",
            }, token)
            order_id = order.get("orderId", "")
            # Текущая цена
            lp = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices", {"figi": [figi]}, token)
            price = money(lp.get("lastPrices", [{}])[0].get("price")) if lp.get("lastPrices") else 0
            # Размер лота
            instr = tb("tinkoff.public.invest.api.contract.v1.InstrumentsService/GetInstrumentBy", {"idType": "INSTRUMENT_ID_TYPE_FIGI", "id": figi}, token)
            lot_size = instr.get("instrument", {}).get("lot", 1)
            amount = price * lots * lot_size
            # Записываем в БД
            trade = db(f"INSERT INTO {SCHEMA}.scalp_trades (user_id, figi, ticker, lots, buy_price, amount, target_pct, stop_pct, order_buy_id) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (uid, figi, ticker, lots, price, amount, target_pct, stop_pct, order_id))
            # Начисляем реферальный доход
            add_referral_earning(uid, amount, token)
            return resp({"ok": True, "trade_id": trade[0]["id"] if trade else None, "price": price, "amount": amount, "order_id": order_id})

        if action == "check_positions":
            # Проверить открытые позиции и продать если достигли target или stop
            open_trades = db(f"SELECT * FROM {SCHEMA}.scalp_trades WHERE user_id = %s AND status = 'open'", (uid,))
            if not open_trades: return resp({"ok": True, "checked": 0, "sold": []})
            accs = tb("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {}, token)
            account_id = accs.get("accounts", [{}])[0].get("id", "")
            sold = []
            for trade in open_trades:
                lp = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices", {"figi": [trade["figi"]]}, token)
                cur_price = money(lp.get("lastPrices", [{}])[0].get("price")) if lp.get("lastPrices") else 0
                if cur_price <= 0: continue
                buy_price = float(trade["buy_price"])
                change_pct = (cur_price - buy_price) / buy_price * 100
                target = float(trade["target_pct"])
                stop = float(trade["stop_pct"])
                should_sell = change_pct >= target or change_pct <= -stop
                if should_sell:
                    order = tb("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", {
                        "accountId": account_id, "figi": trade["figi"],
                        "direction": "ORDER_DIRECTION_SELL",
                        "quantity": trade["lots"], "orderType": "ORDER_TYPE_MARKET",
                    }, token)
                    pnl = (cur_price - buy_price) * trade["lots"] * 1  # упрощённо
                    pnl_pct = change_pct
                    db(f"UPDATE {SCHEMA}.scalp_trades SET status='closed', sell_price=%s, pnl=%s, pnl_pct=%s, order_sell_id=%s, closed_at=NOW() WHERE id=%s",
                       (cur_price, round(pnl, 2), round(pnl_pct, 4), order.get("orderId",""), trade["id"]))
                    sold.append({"ticker": trade["ticker"], "pnl": round(pnl, 2), "pnl_pct": round(pnl_pct, 2), "reason": "TARGET" if change_pct >= target else "STOP"})
            return resp({"ok": True, "checked": len(open_trades), "sold": sold})

        if action == "run_scalp":
            # Автоматический цикл скальпинга
            us = db(f"SELECT key, value FROM {SCHEMA}.user_settings WHERE user_id = %s", (uid,))
            us_map = {r["key"]: r["value"] for r in us}
            if us_map.get("scalp_enabled") != "true": return resp({"ok": False, "reason": "Скальпинг выключен"})
            target_pct = float(us_map.get("scalp_target_pct", 1.0))
            stop_pct = float(us_map.get("scalp_stop_pct", 2.0))
            amount = float(us_map.get("scalp_amount", 1000))
            # Сначала проверяем позиции
            check_result = handler({**event, "httpMethod": "POST", "body": json.dumps({"action": "check_positions"})}, context)
            check_data = json.loads(check_result["body"])
            # Ищем новые возможности
            watchlist_rows = db(f"SELECT value FROM {SCHEMA}.bot_settings WHERE key = 'watchlist_cache' AND user_id = 1")
            if not watchlist_rows: return resp({"ok": True, "sold": check_data.get("sold", []), "bought": []})
            all_inst = json.loads(watchlist_rows[0]["value"])
            sample = random.sample(all_inst, min(15, len(all_inst)))
            bought = []
            accs = tb("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {}, token)
            account_id = accs.get("accounts", [{}])[0].get("id", "")
            portfolio = tb("tinkoff.public.invest.api.contract.v1.OperationsService/GetPortfolio", {"accountId": account_id, "currency": "RUB"}, token)
            free_cash = money(portfolio.get("totalAmountCurrencies"))
            open_count = len(db(f"SELECT id FROM {SCHEMA}.scalp_trades WHERE user_id = %s AND status = 'open'", (uid,)))
            if open_count >= 5: return resp({"ok": True, "sold": check_data.get("sold", []), "bought": [], "reason": "Максимум 5 открытых позиций"})
            for inst in sample:
                if free_cash < amount * 0.9: break
                if open_count >= 5: break
                score, rsi_val, vol = score_instrument(inst["figi"], token)
                if score < 60: continue
                lp = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices", {"figi": [inst["figi"]]}, token)
                price = money(lp.get("lastPrices", [{}])[0].get("price")) if lp.get("lastPrices") else 0
                lot = inst.get("lot", 1)
                if price <= 0: continue
                lots = max(1, int(amount / (price * lot)))
                cost = lots * price * lot
                if cost > free_cash: continue
                order = tb("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", {
                    "accountId": account_id, "figi": inst["figi"],
                    "direction": "ORDER_DIRECTION_BUY", "quantity": lots, "orderType": "ORDER_TYPE_MARKET",
                }, token)
                db(f"INSERT INTO {SCHEMA}.scalp_trades (user_id, figi, ticker, lots, buy_price, amount, target_pct, stop_pct, order_buy_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                   (uid, inst["figi"], inst["ticker"], lots, price, round(cost,2), target_pct, stop_pct, order.get("orderId","")))
                add_referral_earning(uid, cost, token)
                free_cash -= cost
                open_count += 1
                bought.append({"ticker": inst["ticker"], "score": score, "price": price, "lots": lots, "cost": round(cost,2)})
            return resp({"ok": True, "sold": check_data.get("sold", []), "bought": bought})

        return resp({"error": f"Неизвестный action: {action}"}, 400)

    return resp({"error": "Метод не поддерживается"}, 405)
