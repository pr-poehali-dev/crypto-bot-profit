"""Автоторговля КиберБот v4 — все акции Т-Банк, продажа только в плюс.
Каждый пользователь торгует через собственный токен и собственные настройки бота."""
import os, json, requests
from datetime import datetime, timedelta, timezone
import psycopg2

TBANK_BASE = "https://invest-public-api.tinkoff.ru/rest"
DB_URL = os.environ.get("DATABASE_URL", "")
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p28097026_crypto_bot_profit")
CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Session-Id"}

def get_user_from_session(session_id: str):
    """Возвращает {user_id, tbank_token, plan} из сессии или None."""
    if not session_id or len(session_id) < 32: return None
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        f"SELECT u.id, u.tbank_token, u.plan FROM {SCHEMA}.sessions s "
        f"JOIN {SCHEMA}.users u ON u.id = s.user_id WHERE s.id = %s AND s.expires_at > NOW()",
        (session_id,))
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row: return None
    return {"user_id": row[0], "tbank_token": row[1] or "", "plan": row[2] or "free"}

MAX_MULTIPLIER_BY_PLAN = {"free": 1, "basic": 1, "pro": 3}

def resp(body, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(body, ensure_ascii=False, default=str)}

def tb(path, payload, token):
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    r = requests.post(f"{TBANK_BASE}/{path}", headers=h, json=payload, timeout=15)
    return r.json()

def money(m):
    if not m: return 0.0
    return float(m.get("units", 0)) + float(m.get("nano", 0)) / 1_000_000_000

def db_get(key, uid=1):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(f"SELECT value FROM {SCHEMA}.bot_settings WHERE key = %s AND user_id = %s", (key, uid))
    row = cur.fetchone()
    cur.close(); conn.close()
    return row[0] if row else None

def db_set(key, value, uid=1):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.bot_settings (user_id, key, value) VALUES (%s, %s, %s) ON CONFLICT (user_id, key) DO UPDATE SET value = %s, updated_at = NOW()",
        (uid, key, str(value), str(value))
    )
    conn.commit()
    cur.close(); conn.close()

def add_platform_revenue(user_id, trade_amount, source="autotrader_fee"):
    if user_id == 1: return
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(f"SELECT value FROM {SCHEMA}.bot_settings WHERE key='platform_fee_pct' AND user_id=1")
    row = cur.fetchone()
    pct = float(row[0]) if row else 0.3
    revenue = round(trade_amount * pct / 100, 2)
    if revenue > 0:
        cur.execute(
            f"INSERT INTO {SCHEMA}.platform_revenue (user_id, source, trade_amount, fee_pct, revenue, description) VALUES (%s,%s,%s,%s,%s,%s)",
            (user_id, source, trade_amount, pct, revenue, f"Комиссия {pct}% со сделки автотрейдинга пользователя {user_id}"))
        conn.commit()
    cur.close(); conn.close()

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
    """
    Комбо RSI + EMA + MACD.
    BUY:  RSI<40, EMA9>EMA21 (или пересечение вверх), MACD-гистограмма растёт — минимум 3 из 4 условий.
    SELL: RSI>60, EMA9<EMA21 (или пересечение вниз), MACD-гистограмма падает — минимум 3 из 4 условий.
    """
    if len(prices) < 35: return "HOLD", 50.0, 0.0
    rsi_val  = calc_rsi(prices)
    ema9     = calc_ema(prices, 9);  ema9_p  = calc_ema(prices[:-1], 9)
    ema21    = calc_ema(prices, 21); ema21_p = calc_ema(prices[:-1], 21)
    _, _, hist   = calc_macd(prices)
    _, _, hist_p = calc_macd(prices[:-1])

    ema_bull       = ema9 > ema21
    ema_cross_up   = ema9 > ema21 and ema9_p <= ema21_p
    ema_cross_down = ema9 < ema21 and ema9_p >= ema21_p
    macd_grow      = hist > hist_p
    macd_fall      = hist < hist_p

    buy_score = sum([
        rsi_val < 40,
        rsi_val < 35,
        ema_bull or ema_cross_up,
        macd_grow,
        hist > 0,
    ])
    sell_score = sum([
        rsi_val > 60,
        rsi_val > 65,
        (not ema_bull) or ema_cross_down,
        macd_fall,
        hist < 0,
    ])

    if buy_score >= 3:    return "BUY",  rsi_val, hist
    if sell_score >= 3:   return "SELL", rsi_val, hist
    return "HOLD", rsi_val, hist

# Обратная совместимость — используется в нескольких местах
def rsi_signal(prices, period=14):
    rsi = calc_rsi(prices, period)
    if rsi < 30: return "BUY", rsi
    if rsi > 70: return "SELL", rsi
    return "HOLD", rsi

def get_prices(figi, token):
    now = datetime.now(timezone.utc)
    d = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetCandles", {
        "figi": figi,
        "from": (now - timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "interval": "CANDLE_INTERVAL_HOUR",
    }, token)
    return [money(c.get("close")) for c in d.get("candles", []) if c.get("isComplete")]

def get_all_shares(token):
    """Получить все рублёвые акции и ETF Мосбиржи из Т-Банк (кэш общий — список инструментов не персонален)."""
    cached = db_get("watchlist_cache")
    cached_at = db_get("watchlist_cached_at")
    # Кэш 6 часов, но только если там рублёвые инструменты
    if cached and cached_at:
        try:
            cached_time = datetime.fromisoformat(cached_at)
            items = json.loads(cached)
            rub_count = sum(1 for i in items if i.get("currency") == "rub")
            if (datetime.now(timezone.utc) - cached_time).total_seconds() < 21600 and rub_count > 10:
                return items
        except: pass

    instruments = []
    # Акции
    data = tb("tinkoff.public.invest.api.contract.v1.InstrumentsService/Shares", {
        "instrumentStatus": "INSTRUMENT_STATUS_BASE"
    }, token)
    for i in data.get("instruments", []):
        if not i.get("apiTradeAvailableFlag"): continue
        if i.get("currency") != "rub": continue  # ТОЛЬКО РУБЛЁВЫЕ
        if i.get("lot", 0) <= 0: continue
        instruments.append({
            "figi": i.get("figi"),
            "ticker": i.get("ticker"),
            "name": i.get("name"),
            "lot": i.get("lot", 1),
            "currency": "rub",
            "type": "Акция",
        })
    # ETF
    data_etf = tb("tinkoff.public.invest.api.contract.v1.InstrumentsService/Etfs", {
        "instrumentStatus": "INSTRUMENT_STATUS_BASE"
    }, token)
    for i in data_etf.get("etfs", []):
        if not i.get("apiTradeAvailableFlag"): continue
        if i.get("currency") != "rub": continue  # ТОЛЬКО РУБЛЁВЫЕ
        if i.get("lot", 0) <= 0: continue
        instruments.append({
            "figi": i.get("figi"),
            "ticker": i.get("ticker"),
            "name": i.get("name"),
            "lot": i.get("lot", 1),
            "currency": "rub",
            "type": "ETF",
        })

    db_set("watchlist_cache", json.dumps(instruments, ensure_ascii=False))
    db_set("watchlist_cached_at", datetime.now(timezone.utc).isoformat())
    return instruments

def get_portfolio_positions(account_id, token):
    """Вернуть словарь figi -> позиция (средняя цена, кол-во лотов)."""
    data = tb("tinkoff.public.invest.api.contract.v1.OperationsService/GetPortfolio", {
        "accountId": account_id, "currency": "RUB"
    }, token)
    positions = {}
    for p in data.get("positions", []):
        figi = p.get("figi")
        qty = money(p.get("quantity"))
        avg = money(p.get("averagePositionPrice") or p.get("averagePositionPricePt"))
        cur_price = money(p.get("currentPrice"))
        if qty > 0:
            positions[figi] = {
                "qty": qty,
                "avg_price": avg,
                "current_price": cur_price,
                "pnl_pct": round((cur_price - avg) / avg * 100, 2) if avg > 0 else 0,
                "in_profit": cur_price > avg if avg > 0 else False,
            }
    return positions, data

def handler(event: dict, context) -> dict:
    """Обёртка — гарантирует JSON+CORS ответ даже если Т-Банк API временно недоступен (SSL/сеть)."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    try:
        return _handler_impl(event, context)
    except requests.exceptions.RequestException as e:
        print(f"[autotrader] connection error: {e}")
        return resp({"error": "Т-Банк временно недоступен, попробуйте позже", "tbank_unavailable": True}, 503)
    except Exception as e:
        print(f"[autotrader] unexpected error: {e}")
        return resp({"error": "Внутренняя ошибка сервера"}, 500)

def _handler_impl(event: dict, context) -> dict:
    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    headers = event.get("headers") or {}
    action = params.get("action", "")

    # ── Проверка сессии ─────────────────────────────────────────────────────
    session_id = headers.get("x-session-id") or headers.get("X-Session-Id") or ""
    user = get_user_from_session(session_id)
    if not user:
        return resp({"error": "Не авторизован. Войдите в систему."}, 401)

    uid = user["user_id"]
    TBANK_TOKEN = user["tbank_token"]
    plan = user["plan"]

    if not TBANK_TOKEN:
        return resp({"error": "Добавьте токен Т-Банк в настройках профиля"}, 400)

    # ── GET статус ──────────────────────────────────────────────────────────
    if method == "GET" and action == "status":
        enabled  = db_get("auto_bot_enabled", uid) or "false"
        mode     = db_get("trade_mode", uid) or "10pct"
        fixed    = db_get("trade_fixed_amount", uid) or "5000"
        last_run = db_get("bot_last_run", uid) or "—"
        trades   = db_get("bot_last_trades", uid) or "[]"
        pnl      = db_get("bot_daily_pnl", uid) or "0"
        saved_acct = db_get("trade_account_id", uid) or ""
        multiplier = float(db_get("trade_multiplier", uid) or 1)
        total_instruments = db_get("watchlist_cache")
        count = len(json.loads(total_instruments)) if total_instruments else 0
        # Список счетов
        acc_data = tb("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {}, TBANK_TOKEN)
        accounts = [{"id": a.get("id"), "name": a.get("name", a.get("id"))} for a in acc_data.get("accounts", []) if a.get("id")]
        return resp({
            "enabled": enabled == "true",
            "mode": mode,
            "fixed_amount": float(fixed),
            "stop_pct": 3.0,
            "last_run": last_run,
            "last_trades": json.loads(trades),
            "daily_pnl": float(pnl),
            "instruments_count": count,
            "accounts": accounts,
            "account_id": saved_acct or (accounts[0]["id"] if accounts else ""),
            "multiplier": multiplier,
            "max_multiplier": MAX_MULTIPLIER_BY_PLAN.get(plan, 1),
        })

    # ── GET список инструментов ─────────────────────────────────────────────
    if method == "GET" and action == "instruments":
        instruments = get_all_shares(TBANK_TOKEN)
        return resp({"count": len(instruments), "instruments": instruments[:50]})

    # ── POST ────────────────────────────────────────────────────────────────
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        action = body.get("action", "")

        if action == "save_settings":
            db_set("trade_mode", body.get("mode", "10pct"), uid)
            db_set("trade_fixed_amount", str(body.get("fixed_amount", 5000)), uid)
            db_set("max_daily_loss_pct", str(body.get("stop_pct", 3)), uid)
            db_set("auto_bot_enabled", "true" if body.get("enabled") else "false", uid)
            if body.get("account_id"):
                db_set("trade_account_id", str(body.get("account_id")), uid)
            if "multiplier" in body:
                max_mult = MAX_MULTIPLIER_BY_PLAN.get(plan, 1)
                mult = float(body.get("multiplier", 1))
                if mult > max_mult:
                    return resp({"error": f"Множитель до x{max_mult} доступен на твоём тарифе. Оформи PRO для множителя до x{MAX_MULTIPLIER_BY_PLAN['pro']}"}, 403)
                if mult < 1: mult = 1
                db_set("trade_multiplier", str(mult), uid)
            return resp({"success": True})

        if action == "refresh_instruments":
            # Сбросить кэш и перезагрузить
            db_set("watchlist_cached_at", "2000-01-01T00:00:00+00:00")
            instruments = get_all_shares(TBANK_TOKEN)
            return resp({"success": True, "count": len(instruments)})

        if action == "run_once":
            mode         = db_get("trade_mode", uid) or "10pct"
            fixed_amount = float(db_get("trade_fixed_amount", uid) or 5000)
            stop_pct     = float(db_get("max_daily_loss_pct", uid) or 3)

            # Счёт — используем сохранённый или первый из доступных
            saved_acct = db_get("trade_account_id", uid) or ""
            accs_data  = tb("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {}, TBANK_TOKEN)
            accs       = accs_data.get("accounts", [])
            if not accs: return resp({"error": "Счёт не найден"}, 404)
            if saved_acct and any(a.get("id") == saved_acct for a in accs):
                account_id = saved_acct
            else:
                account_id = accs[0]["id"]
            print(f"[run_once] uid={uid} account_id={account_id}")

            # Портфель и позиции
            positions, portfolio_data = get_portfolio_positions(account_id, TBANK_TOKEN)
            free_cash = money(portfolio_data.get("totalAmountCurrencies"))
            total_bal = sum([
                money(portfolio_data.get("totalAmountShares")),
                money(portfolio_data.get("totalAmountBonds")),
                money(portfolio_data.get("totalAmountEtf")),
                money(portfolio_data.get("totalAmountFutures")),
                free_cash,
            ])

            # Дневной стоп
            now = datetime.now(timezone.utc)
            ops = tb("tinkoff.public.invest.api.contract.v1.OperationsService/GetOperations", {
                "accountId": account_id,
                "from": now.replace(hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "state": "OPERATION_STATE_EXECUTED",
            }, TBANK_TOKEN)
            daily_pnl = sum(money(o.get("payment")) for o in ops.get("operations", [])
                           if o.get("operationType") == "OPERATION_TYPE_SELL")
            max_loss = -total_bal * stop_pct / 100
            if daily_pnl < max_loss:
                db_set("auto_bot_enabled", "false", uid)
                return resp({"stopped": True, "reason": f"Дневной убыток {daily_pnl:.0f} ₽ > лимит {max_loss:.0f} ₽", "daily_pnl": daily_pnl})

            # Сумма на одну сделку
            if mode == "10pct":   order_amt = free_cash * 0.10
            elif mode == "25pct": order_amt = free_cash * 0.25
            elif mode == "50pct": order_amt = free_cash * 0.50
            else:                 order_amt = min(fixed_amount, free_cash * 0.90)

            # Множитель объёма — ограничен тарифом (PRO)
            max_mult = MAX_MULTIPLIER_BY_PLAN.get(plan, 1)
            multiplier = min(float(db_get("trade_multiplier", uid) or 1), max_mult)
            if multiplier < 1: multiplier = 1
            order_amt = min(order_amt * multiplier, free_cash * 0.90)

            # Если денег мало — используем всё что есть (минимум 100 ₽)
            if order_amt < 100:
                order_amt = free_cash * 0.90
            if free_cash < 100:
                db_set("bot_last_trades", json.dumps([{"ticker": "—", "signal": "SKIP", "reason": f"Недостаточно средств: {free_cash:.0f} ₽ (нужно минимум 100 ₽)"}], ensure_ascii=False), uid)
                return resp({"success": False, "reason": f"Недостаточно средств: {free_cash:.0f} ₽", "free_cash": free_cash})

            # Загружаем список всех рублёвых инструментов
            watchlist = get_all_shares(TBANK_TOKEN)

            results = []

            # ── Шаг 1: ПРОДАЖА позиций которые в плюсе ──────────────────
            for figi, pos in positions.items():
                if not pos["in_profit"]: continue  # ПРОДАЁМ ТОЛЬКО В ПЛЮС
                if pos["pnl_pct"] < 0.5: continue  # Минимум +0.5% прибыли

                prices = get_prices(figi, TBANK_TOKEN)
                if len(prices) < 35: continue
                signal, rsi_val, macd_hist = combo_signal(prices)

                if signal != "SELL": continue  # Продаём только если комбо-сигнал SELL

                ticker = next((i["ticker"] for i in watchlist if i["figi"] == figi), figi)
                lot    = next((i["lot"]    for i in watchlist if i["figi"] == figi), 1)
                lots_to_sell = max(1, int(pos["qty"] / lot))

                order = tb("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", {
                    "accountId": account_id, "figi": figi,
                    "direction": "ORDER_DIRECTION_SELL",
                    "quantity": lots_to_sell, "orderType": "ORDER_TYPE_MARKET",
                }, TBANK_TOKEN)
                profit_rub = round((pos["current_price"] - pos["avg_price"]) * pos["qty"], 2)
                results.append({
                    "ticker": ticker, "signal": "SELL",
                    "rsi": rsi_val, "macd": macd_hist,
                    "lots": lots_to_sell, "price": pos["current_price"],
                    "avg_price": pos["avg_price"], "pnl_pct": pos["pnl_pct"],
                    "profit_rub": profit_rub,
                    "reason": f"✅ RSI+EMA+MACD SELL · прибыль +{pos['pnl_pct']}%",
                    "order_id": order.get("orderId", ""),
                    "status": order.get("executionReportStatus", ""),
                })

            # ── Шаг 2: ПОКУПКА по комбо-сигналу ─────────────────────────
            import random
            sample = random.sample(watchlist, min(30, len(watchlist)))

            buy_count = 0
            for inst in sample:
                if free_cash < order_amt * 0.5: break
                if buy_count >= 5: break
                if inst["figi"] in positions: continue

                prices = get_prices(inst["figi"], TBANK_TOKEN)
                if len(prices) < 35: continue

                signal, rsi_val, macd_hist = combo_signal(prices)

                if signal != "BUY": continue

                # Цена
                lp = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices", {"figi": [inst["figi"]]}, TBANK_TOKEN)
                last_price = money(lp.get("lastPrices", [{}])[0].get("price")) if lp.get("lastPrices") else 0
                if last_price <= 0: continue

                lot = inst.get("lot", 1)
                lot_price = last_price * lot
                if lot_price <= 0: continue

                lots = max(1, int(order_amt / lot_price))
                cost = lots * lot_price
                if cost > free_cash: continue

                order = tb("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", {
                    "accountId": account_id,
                    "figi": inst["figi"],
                    "direction": "ORDER_DIRECTION_BUY",
                    "quantity": lots,
                    "orderType": "ORDER_TYPE_MARKET",
                }, TBANK_TOKEN)
                free_cash -= cost
                buy_count += 1
                add_platform_revenue(uid, round(cost, 2), source="autotrader_buy_fee")
                results.append({
                    "ticker": inst["ticker"],
                    "signal": "BUY",
                    "rsi": rsi_val,
                    "macd": macd_hist,
                    "lots": lots,
                    "price": last_price,
                    "total": round(cost, 2),
                    "reason": f"RSI {rsi_val:.1f} + EMA + MACD",
                    "order_id": order.get("orderId", ""),
                    "status": order.get("executionReportStatus", ""),
                })

            run_at = now.strftime("%d.%m.%Y %H:%M МСК")
            db_set("bot_last_run", run_at, uid)
            db_set("bot_last_trades", json.dumps(results[:20], ensure_ascii=False), uid)
            db_set("bot_daily_pnl", str(round(daily_pnl, 2)), uid)

            return resp({
                "success": True,
                "free_cash": round(free_cash, 2),
                "order_amount": round(order_amt, 2),
                "daily_pnl": round(daily_pnl, 2),
                "positions_checked": len(positions),
                "instruments_scanned": len(sample),
                "results": results,
                "run_at": run_at,
            })

        return resp({"error": f"Неизвестный action: {action}"}, 400)

    return resp({"error": "Метод не поддерживается"}, 405)