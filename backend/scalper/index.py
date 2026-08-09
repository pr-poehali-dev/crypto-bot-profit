"""
Скальпинг-бот КиберБот — краткосрочные сделки с авто-продажей по заданному %.
Поддерживает два независимых счёта Т-Банк с разными настройками.
Счёт 1: быстрый скальпинг (маленькие суммы, частые входы).
Счёт 2: автобот на большую сумму (реже, но весомее).
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

# ── Индикаторы: RSI + EMA + MACD ─────────────────────────────────────────────

def calc_rsi(prices, period=14):
    if len(prices) < period + 1: return 50.0
    gains  = [max(prices[i]-prices[i-1], 0) for i in range(1, len(prices))]
    losses = [max(prices[i-1]-prices[i], 0) for i in range(1, len(prices))]
    ag = sum(gains[-period:])  / period
    al = sum(losses[-period:]) / period
    if al == 0: return 100.0
    return round(100 - 100 / (1 + ag / al), 2)

def calc_ema(prices, n):
    if len(prices) < n: return prices[-1] if prices else 0.0
    k = 2 / (n + 1); e = prices[0]
    for p in prices[1:]: e = p * k + e * (1 - k)
    return e

def calc_macd(prices, fast=12, slow=26, signal=9):
    if len(prices) < slow + signal: return 0.0, 0.0, 0.0
    ema_fast = [calc_ema(prices[:i+1], fast) for i in range(len(prices))]
    ema_slow = [calc_ema(prices[:i+1], slow) for i in range(len(prices))]
    macd_line = [f - s for f, s in zip(ema_fast, ema_slow)]
    sig_line  = calc_ema(macd_line[-signal*2:], signal)
    histogram = macd_line[-1] - sig_line
    return round(macd_line[-1], 6), round(sig_line, 6), round(histogram, 6)

def combo_signal(prices):
    if len(prices) < 20: return "HOLD", 50.0, 0.0, 0.0
    rsi_val = calc_rsi(prices)
    ema9    = calc_ema(prices, 9)
    ema21   = calc_ema(prices, 21)
    ema9_p  = calc_ema(prices[:-1], 9)
    ema21_p = calc_ema(prices[:-1], 21)

    ema_bull     = ema9 > ema21
    ema_cross_up = ema9 > ema21 and ema9_p <= ema21_p

    _, _, hist   = calc_macd(prices)      if len(prices) >= 35 else (0, 0, 0)
    _, _, hist_p = calc_macd(prices[:-1]) if len(prices) >= 36 else (0, 0, 0)
    macd_grow = hist > hist_p and hist > 0
    macd_fall = hist < hist_p

    momentum_up   = len(prices) >= 4 and prices[-1] > prices[-4]
    momentum_down = len(prices) >= 4 and prices[-1] < prices[-4]

    buy_support  = sum([ema_bull or ema_cross_up, macd_grow, momentum_up])
    sell_support = sum([(not ema_bull), macd_fall, momentum_down])

    if rsi_val < 48 and buy_support >= 1:
        sig = "BUY"
    elif rsi_val > 55 and sell_support >= 2:
        sig = "SELL"
    else:
        sig = "HOLD"

    return sig, rsi_val, hist, round(ema9 - ema21, 4)

def volume_score(candles):
    if len(candles) < 5: return 1.0
    vols   = [float(c.get("volume", 0)) for c in candles]
    avg    = sum(vols[:-3]) / max(len(vols[:-3]), 1)
    recent = sum(vols[-3:]) / 3
    return recent / max(avg, 0.001)

def score_instrument(figi, token):
    candles = get_candles(figi, token, interval="CANDLE_INTERVAL_5_MIN", hours=8)
    prices  = [money(c.get("close")) for c in candles if c.get("isComplete") and money(c.get("close")) > 0]

    print(f"[score] figi={figi[-6:]} candles={len(candles)} prices={len(prices)}")

    if len(prices) < 20:
        candles = get_candles(figi, token, interval="CANDLE_INTERVAL_HOUR", hours=72)
        prices  = [money(c.get("close")) for c in candles if c.get("isComplete") and money(c.get("close")) > 0]
        print(f"[score] fallback 1h figi={figi[-6:]} prices={len(prices)}")

    if len(prices) < 20: return 0, "HOLD", 50.0, 0.0

    signal, rsi_val, macd_hist, ema_diff = combo_signal(prices)
    vm = volume_score(candles)

    print(f"[score] figi={figi[-6:]} signal={signal} rsi={rsi_val:.1f} macd={macd_hist:.5f} ema_diff={ema_diff:.4f} vol={vm:.2f}")

    if signal == "BUY":
        rsi_bonus  = max(0, (48 - rsi_val) * 2.5)
        vol_bonus  = min(20, (vm - 1) * 12) if vm > 1 else 0
        macd_bonus = min(10, abs(macd_hist) * 6000)
        score = 60 + rsi_bonus + vol_bonus + macd_bonus
    else:
        score = 0

    return round(min(score, 100), 1), signal, round(rsi_val, 1), round(macd_hist, 6)

def add_referral_earning(user_id, trade_amount, token):
    ref = db(f"SELECT referred_by FROM {SCHEMA}.users WHERE id = %s", (user_id,))
    if not ref or not ref[0]["referred_by"]: return
    owner_id = ref[0]["referred_by"]
    pct_rows = db(f"SELECT value FROM {SCHEMA}.bot_settings WHERE key = 'ref_earn_pct' AND user_id = 1")
    pct = float(pct_rows[0]["value"]) if pct_rows else 0.5
    earned = round(trade_amount * pct / 100, 2)
    if earned <= 0: return
    db(f"INSERT INTO {SCHEMA}.referral_earnings (owner_id, from_user_id, trade_amount, earn_pct, earned) VALUES (%s, %s, %s, %s, %s)",
       (owner_id, user_id, trade_amount, pct, earned))

def add_platform_revenue(user_id, trade_amount):
    if user_id == 1: return
    pct_rows = db(f"SELECT value FROM {SCHEMA}.bot_settings WHERE key = 'platform_fee_pct' AND user_id = 1")
    pct = float(pct_rows[0]["value"]) if pct_rows else 0.3
    revenue = round(trade_amount * pct / 100, 2)
    if revenue <= 0: return
    db(f"INSERT INTO {SCHEMA}.platform_revenue (user_id, source, trade_amount, fee_pct, revenue, description) VALUES (%s, 'trade_fee', %s, %s, %s, %s)",
       (user_id, trade_amount, pct, revenue, f"Комиссия {pct}% со сделки пользователя {user_id}"))

def get_account_id(token, saved_acct):
    """Выбирает счёт по saved_acct или возвращает первый доступный."""
    accs = tb("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {}, token)
    all_accounts = accs.get("accounts", [])
    if saved_acct and any(a.get("id") == saved_acct for a in all_accounts):
        return saved_acct
    return all_accounts[0].get("id", "") if all_accounts else ""

def run_scalp_for_account(uid, token, acct_id, target_pct, stop_pct, amount, label=""):
    """
    Запускает один цикл скальпинга для конкретного счёта.
    Возвращает {"sold": [...], "bought": [...]}.
    """
    sold = []
    bought = []

    # ── 1. Закрываем открытые позиции этого счёта ─────────────────────────
    open_trades = db(
        f"SELECT * FROM {SCHEMA}.scalp_trades WHERE user_id = %s AND status = 'open' AND (account_id = %s OR account_id IS NULL)",
        (uid, acct_id)
    )
    print(f"[run_scalp{label}] account={acct_id} open={len(open_trades)} target={target_pct}% stop={stop_pct}% amount={amount}")

    for trade in open_trades:
        lp = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices", {"figi": [trade["figi"]]}, token)
        cur_price = money(lp.get("lastPrices", [{}])[0].get("price")) if lp.get("lastPrices") else 0
        if cur_price <= 0: continue
        buy_price  = float(trade["buy_price"])
        lot_size   = int(trade.get("lot_size") or 1)
        change_pct = (cur_price - buy_price) / buy_price * 100 if buy_price > 0 else 0
        t_pct = float(trade["target_pct"])
        s_pct = float(trade["stop_pct"])

        if change_pct >= t_pct or change_pct <= -s_pct:
            reason = "TARGET" if change_pct >= t_pct else "STOP"
            order0 = tb("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", {
                "accountId": acct_id, "figi": trade["figi"],
                "direction": "ORDER_DIRECTION_SELL",
                "quantity": int(trade["lots"]), "orderType": "ORDER_TYPE_MARKET",
            }, token)
            pnl0 = round((cur_price - buy_price) * int(trade["lots"]) * lot_size, 2)
            db(f"UPDATE {SCHEMA}.scalp_trades SET status='closed', sell_price=%s, pnl=%s, pnl_pct=%s, order_sell_id=%s, closed_at=NOW() WHERE id=%s",
               (cur_price, pnl0, round(change_pct, 4), order0.get("orderId",""), trade["id"]))
            print(f"[run_scalp{label}] SOLD {trade['ticker']} reason={reason} pnl={pnl0}")
            sold.append({"ticker": trade["ticker"], "pnl": pnl0, "pnl_pct": round(change_pct, 2), "reason": reason, "account": label})

    # ── 2. Ищем новые точки входа ─────────────────────────────────────────
    watchlist_rows = db(f"SELECT value FROM {SCHEMA}.bot_settings WHERE key = 'watchlist_cache' AND user_id = 1")
    if not watchlist_rows:
        return {"sold": sold, "bought": bought}

    all_inst   = json.loads(watchlist_rows[0]["value"])
    sample     = random.sample(all_inst, min(40, len(all_inst)))
    portfolio  = tb("tinkoff.public.invest.api.contract.v1.OperationsService/GetPortfolio", {"accountId": acct_id, "currency": "RUB"}, token)
    free_cash  = money(portfolio.get("totalAmountCurrencies"))
    open_count = len(db(f"SELECT id FROM {SCHEMA}.scalp_trades WHERE user_id = %s AND status = 'open' AND (account_id = %s OR account_id IS NULL)", (uid, acct_id)))

    print(f"[run_scalp{label}] free_cash={free_cash:.0f} open_count={open_count}")

    if open_count >= 8:
        return {"sold": sold, "bought": bought, "reason": "Максимум 8 открытых позиций"}
    if free_cash < amount * 0.5:
        return {"sold": sold, "bought": bought, "reason": f"Мало свободных средств: {free_cash:.0f} ₽"}

    for inst in sample:
        if free_cash < amount * 0.5: break
        if open_count >= 8: break

        score, signal, rsi_val, macd_hist = score_instrument(inst["figi"], token)
        if score < 60 or signal != "BUY": continue

        lp = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices", {"figi": [inst["figi"]]}, token)
        price = money(lp.get("lastPrices", [{}])[0].get("price")) if lp.get("lastPrices") else 0
        lot = inst.get("lot", 1)
        if price <= 0: continue

        lots = max(1, int(amount / (price * lot)))
        cost = lots * price * lot
        if cost > free_cash: continue

        buy_price_adj = round(price * 1.0015, 4)
        cost_adj = round(buy_price_adj * lots * lot, 2)

        order = tb("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", {
            "accountId": acct_id, "figi": inst["figi"],
            "direction": "ORDER_DIRECTION_BUY", "quantity": lots, "orderType": "ORDER_TYPE_MARKET",
        }, token)
        print(f"[run_scalp{label}] BUY {inst['ticker']} lots={lots} price={price} cost={cost:.0f}")

        db(f"INSERT INTO {SCHEMA}.scalp_trades (user_id, figi, ticker, lots, lot_size, buy_price, amount, target_pct, stop_pct, order_buy_id, account_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
           (uid, inst["figi"], inst["ticker"], lots, lot, buy_price_adj, cost_adj, target_pct, stop_pct, order.get("orderId",""), acct_id))
        add_referral_earning(uid, cost_adj, token)
        add_platform_revenue(uid, cost_adj)
        free_cash  -= cost
        open_count += 1
        bought.append({"ticker": inst["ticker"], "score": score, "rsi": rsi_val, "price": price, "lots": lots, "cost": round(cost,2), "account": label})

    return {"sold": sold, "bought": bought}


def handler(event: dict, context) -> dict:
    """Обёртка — гарантирует JSON+CORS ответ даже если Т-Банк API временно недоступен (SSL/сеть)."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    try:
        return _handler_impl(event, context)
    except requests.exceptions.RequestException as e:
        print(f"[scalper] connection error: {e}")
        return resp({"error": "Т-Банк временно недоступен, попробуйте позже", "tbank_unavailable": True}, 503)
    except Exception as e:
        print(f"[scalper] unexpected error: {e}")
        return resp({"error": "Внутренняя ошибка сервера"}, 500)

def _handler_impl(event: dict, context) -> dict:
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
        user_settings = db(
            f"SELECT key, value FROM {SCHEMA}.user_settings WHERE user_id = %s AND key IN ("
            f"'scalp_target_pct','scalp_stop_pct','scalp_amount','scalp_enabled','scalp_account_id',"
            f"'scalp_target_pct_2','scalp_stop_pct_2','scalp_amount_2','scalp_enabled_2','scalp_account_id_2')",
            (uid,)
        )
        us = {r["key"]: r["value"] for r in user_settings}

        acc_data = tb("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {}, token)
        accounts = [{"id": a.get("id"), "name": a.get("name", a.get("id"))} for a in acc_data.get("accounts", []) if a.get("id")]

        first_acct = accounts[0]["id"] if accounts else ""
        second_acct = accounts[1]["id"] if len(accounts) > 1 else first_acct

        return resp({
            "open_trades": open_trades,
            "trades_today": int(closed_today[0]["cnt"]) if closed_today else 0,
            "pnl_today": float(closed_today[0]["pnl"]) if closed_today else 0,
            "accounts": accounts,
            "settings": {
                "target_pct": float(us.get("scalp_target_pct", settings.get("scalp_default_target_pct", 1.0))),
                "stop_pct": float(us.get("scalp_stop_pct", settings.get("scalp_default_stop_pct", 2.0))),
                "amount": float(us.get("scalp_amount", 1000)),
                "enabled": us.get("scalp_enabled", "false") == "true",
                "account_id": us.get("scalp_account_id", first_acct),
            },
            "settings2": {
                "target_pct": float(us.get("scalp_target_pct_2", settings.get("scalp_default_target_pct", 1.0))),
                "stop_pct": float(us.get("scalp_stop_pct_2", settings.get("scalp_default_stop_pct", 2.0))),
                "amount": float(us.get("scalp_amount_2", 5000)),
                "enabled": us.get("scalp_enabled_2", "false") == "true",
                "account_id": us.get("scalp_account_id_2", second_acct),
            },
        })

    if method == "GET" and action == "history":
        trades = db(f"SELECT * FROM {SCHEMA}.scalp_trades WHERE user_id = %s ORDER BY opened_at DESC LIMIT 50", (uid,))
        return resp({"trades": trades})

    if method == "GET" and action == "scan":
        watchlist_rows = db(f"SELECT value FROM {SCHEMA}.bot_settings WHERE key = 'watchlist_cache' AND user_id = 1")
        if not watchlist_rows: return resp({"candidates": []})
        all_inst = json.loads(watchlist_rows[0]["value"])
        sample = random.sample(all_inst, min(20, len(all_inst)))
        candidates = []
        for inst in sample:
            score, signal, rsi_val, macd_hist = score_instrument(inst["figi"], token)
            if score >= 50 and signal == "BUY":
                lp = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices", {"figi": [inst["figi"]]}, token)
                price = money(lp.get("lastPrices", [{}])[0].get("price")) if lp.get("lastPrices") else 0
                if price > 0:
                    candidates.append({"figi": inst["figi"], "ticker": inst["ticker"], "name": inst["name"], "score": score, "signal": signal, "rsi": rsi_val, "macd": macd_hist, "price": price, "lot": inst.get("lot", 1)})
        candidates.sort(key=lambda x: x["score"], reverse=True)
        return resp({"candidates": candidates[:10]})

    # ── POST ───────────────────────────────────────────────────────────────
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        action = body.get("action", "")

        if action == "save_settings":
            acct_num = str(body.get("account_num", "1"))  # "1" или "2"
            sfx = "_2" if acct_num == "2" else ""
            target  = str(body.get("target_pct", 1.0))
            stop    = str(body.get("stop_pct", 2.0))
            amount  = str(body.get("amount", 1000))
            enabled = "true" if body.get("enabled") else "false"
            account = str(body.get("account_id", ""))
            pairs = [
                (f"scalp_target_pct{sfx}", target),
                (f"scalp_stop_pct{sfx}", stop),
                (f"scalp_amount{sfx}", amount),
                (f"scalp_enabled{sfx}", enabled),
            ]
            if account:
                pairs.append((f"scalp_account_id{sfx}", account))
            for k, v in pairs:
                db(f"INSERT INTO {SCHEMA}.user_settings (user_id, key, value) VALUES (%s, %s, %s) ON CONFLICT (user_id, key) DO UPDATE SET value = %s, updated_at = NOW()", (uid, k, v, v))
            return resp({"ok": True})

        if action == "buy":
            figi = body.get("figi", "")
            ticker = body.get("ticker", "")
            lots = int(body.get("lots", 1))
            target_pct = float(body.get("target_pct", 1.0))
            stop_pct = float(body.get("stop_pct", 2.0))
            acct_num = str(body.get("account_num", "1"))
            sfx = "_2" if acct_num == "2" else ""

            us = db(f"SELECT key, value FROM {SCHEMA}.user_settings WHERE user_id = %s AND key IN ('scalp_account_id','scalp_account_id_2')", (uid,))
            us_map = {r["key"]: r["value"] for r in us}
            saved_acct = us_map.get(f"scalp_account_id{sfx}", "")
            acct_id = get_account_id(token, saved_acct)

            instr = tb("tinkoff.public.invest.api.contract.v1.InstrumentsService/GetInstrumentBy", {"idType": "INSTRUMENT_ID_TYPE_FIGI", "id": figi}, token)
            lot_size = instr.get("instrument", {}).get("lot", 1)
            lp = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices", {"figi": [figi]}, token)
            price = money(lp.get("lastPrices", [{}])[0].get("price")) if lp.get("lastPrices") else 0
            if price <= 0:
                return resp({"error": "Не удалось получить цену инструмента"}, 400)
            buy_price_adj = round(price * 1.0015, 4)
            order = tb("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", {
                "accountId": acct_id, "figi": figi, "direction": "ORDER_DIRECTION_BUY",
                "quantity": lots, "orderType": "ORDER_TYPE_MARKET",
            }, token)
            order_id = order.get("orderId", "")
            amount = buy_price_adj * lots * lot_size
            trade = db(f"INSERT INTO {SCHEMA}.scalp_trades (user_id, figi, ticker, lots, lot_size, buy_price, amount, target_pct, stop_pct, order_buy_id, account_id) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (uid, figi, ticker, lots, lot_size, buy_price_adj, round(amount, 2), target_pct, stop_pct, order_id, acct_id))
            add_referral_earning(uid, amount, token)
            add_platform_revenue(uid, amount)
            return resp({"ok": True, "trade_id": trade[0]["id"] if trade else None, "price": buy_price_adj, "amount": round(amount, 2), "order_id": order_id})

        if action == "check_positions":
            open_trades = db(f"SELECT * FROM {SCHEMA}.scalp_trades WHERE user_id = %s AND status = 'open'", (uid,))
            if not open_trades: return resp({"ok": True, "checked": 0, "sold": []})
            accs = tb("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {}, token)
            account_id = accs.get("accounts", [{}])[0].get("id", "")
            sold = []
            for trade in open_trades:
                acct_id = trade.get("account_id") or account_id
                lp = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices", {"figi": [trade["figi"]]}, token)
                cur_price = money(lp.get("lastPrices", [{}])[0].get("price")) if lp.get("lastPrices") else 0
                if cur_price <= 0: continue
                buy_price  = float(trade["buy_price"])
                lot_size   = int(trade.get("lot_size") or 1)
                change_pct = (cur_price - buy_price) / buy_price * 100
                target = float(trade["target_pct"])
                stop   = float(trade["stop_pct"])
                should_sell = change_pct >= target or change_pct <= -stop
                if should_sell:
                    order = tb("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", {
                        "accountId": acct_id, "figi": trade["figi"],
                        "direction": "ORDER_DIRECTION_SELL",
                        "quantity": int(trade["lots"]), "orderType": "ORDER_TYPE_MARKET",
                    }, token)
                    pnl = round((cur_price - buy_price) * int(trade["lots"]) * lot_size, 2)
                    db(f"UPDATE {SCHEMA}.scalp_trades SET status='closed', sell_price=%s, pnl=%s, pnl_pct=%s, order_sell_id=%s, closed_at=NOW() WHERE id=%s",
                       (cur_price, pnl, round(change_pct, 4), order.get("orderId",""), trade["id"]))
                    reason = "TARGET" if change_pct >= target else "STOP"
                    sold.append({"ticker": trade["ticker"], "pnl": pnl, "pnl_pct": round(change_pct, 2), "reason": reason})
            return resp({"ok": True, "checked": len(open_trades), "sold": sold})

        if action == "run_scalp":
            us = db(f"SELECT key, value FROM {SCHEMA}.user_settings WHERE user_id = %s", (uid,))
            us_map = {r["key"]: r["value"] for r in us}
            force = body.get("force", False)

            # Счёт 1
            enabled1 = us_map.get("scalp_enabled", "false") == "true"
            # Счёт 2
            enabled2 = us_map.get("scalp_enabled_2", "false") == "true"

            if not enabled1 and not enabled2 and not force:
                return resp({"ok": False, "reason": "Оба счёта скальпинга выключены."})

            all_results = {"ok": True, "sold": [], "bought": [], "account1": {}, "account2": {}}

            # ── Счёт 1: скальпинг (быстрый доход) ──────────────────────
            if enabled1 or force:
                target1  = float(us_map.get("scalp_target_pct", 1.0))
                stop1    = float(us_map.get("scalp_stop_pct", 2.0))
                amount1  = float(us_map.get("scalp_amount", 1000))
                acct1_id = get_account_id(token, us_map.get("scalp_account_id", ""))
                r1 = run_scalp_for_account(uid, token, acct1_id, target1, stop1, amount1, label=" [счёт1]")
                all_results["account1"] = r1
                all_results["sold"].extend(r1.get("sold", []))
                all_results["bought"].extend(r1.get("bought", []))

            # ── Счёт 2: автобот (крупные сделки) ────────────────────────
            if enabled2:
                target2  = float(us_map.get("scalp_target_pct_2", 1.0))
                stop2    = float(us_map.get("scalp_stop_pct_2", 2.0))
                amount2  = float(us_map.get("scalp_amount_2", 5000))
                acct2_id = get_account_id(token, us_map.get("scalp_account_id_2", ""))
                r2 = run_scalp_for_account(uid, token, acct2_id, target2, stop2, amount2, label=" [счёт2]")
                all_results["account2"] = r2
                all_results["sold"].extend(r2.get("sold", []))
                all_results["bought"].extend(r2.get("bought", []))

            print(f"[run_scalp] total sold={len(all_results['sold'])} bought={len(all_results['bought'])}")
            return resp(all_results)

        return resp({"error": f"Неизвестный action: {action}"}, 400)

    return resp({"error": "Метод не поддерживается"}, 405)