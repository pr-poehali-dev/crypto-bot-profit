"""Автоторговля КиберБот v4 — все акции Т-Банк, продажа только в плюс."""
import os, json, requests
from datetime import datetime, timedelta, timezone
import psycopg2

TBANK_TOKEN = os.environ.get("TBANK_INVEST_TOKEN", "")
TBANK_BASE = "https://invest-public-api.tinkoff.ru/rest"
TBANK_H = {"Authorization": f"Bearer {TBANK_TOKEN}", "Content-Type": "application/json"}
DB_URL = os.environ.get("DATABASE_URL", "")
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p28097026_crypto_bot_profit")
CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Session-Id"}

def check_session(session_id: str) -> bool:
    if not session_id or len(session_id) < 32: return False
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(f"SELECT id FROM {SCHEMA}.sessions WHERE id = %s AND expires_at > NOW()", (session_id,))
    ok = cur.fetchone() is not None
    cur.close(); conn.close()
    return ok

def resp(body, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(body, ensure_ascii=False, default=str)}

def tb(path, payload):
    r = requests.post(f"{TBANK_BASE}/{path}", headers=TBANK_H, json=payload, timeout=15)
    return r.json()

def money(m):
    if not m: return 0.0
    return float(m.get("units", 0)) + float(m.get("nano", 0)) / 1_000_000_000

def db_get(key):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(f"SELECT value FROM {SCHEMA}.bot_settings WHERE key = %s AND user_id = 1", (key,))
    row = cur.fetchone()
    cur.close(); conn.close()
    return row[0] if row else None

def db_set(key, value):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.bot_settings (user_id, key, value) VALUES (1, %s, %s) ON CONFLICT (user_id, key) DO UPDATE SET value = %s, updated_at = NOW()",
        (key, str(value), str(value))
    )
    conn.commit()
    cur.close(); conn.close()

def rsi_signal(prices, period=14):
    if len(prices) < period + 1: return "HOLD", 50
    gains = [max(prices[i]-prices[i-1], 0) for i in range(1, len(prices))]
    losses = [max(prices[i-1]-prices[i], 0) for i in range(1, len(prices))]
    ag = sum(gains[-period:]) / period
    al = sum(losses[-period:]) / period
    if al == 0: return "HOLD", 100
    rsi = round(100 - 100 / (1 + ag / al), 1)
    if rsi < 30: return "BUY", rsi
    if rsi > 70: return "SELL", rsi
    return "HOLD", rsi

def ema(prices, n):
    k = 2 / (n + 1); e = prices[0]
    for p in prices[1:]: e = p * k + e * (1 - k)
    return e

def ema_signal(prices):
    if len(prices) < 22: return "HOLD"
    f, s = ema(prices[-9:], 9), ema(prices[-21:], 21)
    fp, sp = ema(prices[-10:-1], 9), ema(prices[-22:-1], 21)
    if f > s and fp <= sp: return "BUY"
    if f < s and fp >= sp: return "SELL"
    return "HOLD"

def get_prices(figi):
    now = datetime.now(timezone.utc)
    d = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetCandles", {
        "figi": figi,
        "from": (now - timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "interval": "CANDLE_INTERVAL_HOUR",
    })
    return [money(c.get("close")) for c in d.get("candles", []) if c.get("isComplete")]

def get_all_shares():
    """Получить все рублёвые акции и ETF Мосбиржи из Т-Банк."""
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
    })
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
    })
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

def get_portfolio_positions(account_id):
    """Вернуть словарь figi -> позиция (средняя цена, кол-во лотов)."""
    data = tb("tinkoff.public.invest.api.contract.v1.OperationsService/GetPortfolio", {
        "accountId": account_id, "currency": "RUB"
    })
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
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    headers = event.get("headers") or {}
    action = params.get("action", "")

    # ── Проверка сессии ─────────────────────────────────────────────────────
    session_id = headers.get("x-session-id") or headers.get("X-Session-Id") or ""
    if not check_session(session_id):
        return resp({"error": "Не авторизован. Войдите в систему."}, 401)

    if not TBANK_TOKEN:
        return resp({"error": "TBANK_INVEST_TOKEN не задан"}, 500)

    # ── GET статус ──────────────────────────────────────────────────────────
    if method == "GET" and action == "status":
        enabled  = db_get("auto_bot_enabled") or "false"
        mode     = db_get("trade_mode") or "10pct"
        fixed    = db_get("trade_fixed_amount") or "5000"
        last_run = db_get("bot_last_run") or "—"
        trades   = db_get("bot_last_trades") or "[]"
        pnl      = db_get("bot_daily_pnl") or "0"
        total_instruments = db_get("watchlist_cache")
        count = len(json.loads(total_instruments)) if total_instruments else 0
        return resp({
            "enabled": enabled == "true",
            "mode": mode,
            "fixed_amount": float(fixed),
            "stop_pct": 3.0,
            "last_run": last_run,
            "last_trades": json.loads(trades),
            "daily_pnl": float(pnl),
            "instruments_count": count,
        })

    # ── GET список инструментов ─────────────────────────────────────────────
    if method == "GET" and action == "instruments":
        instruments = get_all_shares()
        return resp({"count": len(instruments), "instruments": instruments[:50]})

    # ── POST ────────────────────────────────────────────────────────────────
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        action = body.get("action", "")

        if action == "save_settings":
            db_set("trade_mode", body.get("mode", "10pct"))
            db_set("trade_fixed_amount", str(body.get("fixed_amount", 5000)))
            db_set("max_daily_loss_pct", str(body.get("stop_pct", 3)))
            db_set("auto_bot_enabled", "true" if body.get("enabled") else "false")
            return resp({"success": True})

        if action == "refresh_instruments":
            # Сбросить кэш и перезагрузить
            db_set("watchlist_cached_at", "2000-01-01T00:00:00+00:00")
            instruments = get_all_shares()
            return resp({"success": True, "count": len(instruments)})

        if action == "run_once":
            mode         = db_get("trade_mode") or "10pct"
            fixed_amount = float(db_get("trade_fixed_amount") or 5000)
            stop_pct     = float(db_get("max_daily_loss_pct") or 3)

            # Счёт
            accounts = tb("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {})
            accs = accounts.get("accounts", [])
            if not accs: return resp({"error": "Счёт не найден"}, 404)
            account_id = accs[0]["id"]

            # Портфель и позиции
            positions, portfolio_data = get_portfolio_positions(account_id)
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
            })
            daily_pnl = sum(money(o.get("payment")) for o in ops.get("operations", [])
                           if o.get("operationType") == "OPERATION_TYPE_SELL")
            max_loss = -total_bal * stop_pct / 100
            if daily_pnl < max_loss:
                db_set("auto_bot_enabled", "false")
                return resp({"stopped": True, "reason": f"Дневной убыток {daily_pnl:.0f} ₽ > лимит {max_loss:.0f} ₽", "daily_pnl": daily_pnl})

            # Сумма на одну сделку
            if mode == "10pct":   order_amt = free_cash * 0.10
            elif mode == "25pct": order_amt = free_cash * 0.25
            elif mode == "50pct": order_amt = free_cash * 0.50
            else:                 order_amt = min(fixed_amount, free_cash * 0.90)

            # Если денег мало — используем всё что есть (минимум 100 ₽)
            if order_amt < 100:
                order_amt = free_cash * 0.90
            if free_cash < 100:
                db_set("bot_last_trades", json.dumps([{"ticker": "—", "signal": "SKIP", "reason": f"Недостаточно средств: {free_cash:.0f} ₽ (нужно минимум 100 ₽)"}], ensure_ascii=False))
                return resp({"success": False, "reason": f"Недостаточно средств: {free_cash:.0f} ₽", "free_cash": free_cash})

            # Загружаем список всех рублёвых инструментов
            watchlist = get_all_shares()

            results = []

            # ── Шаг 1: ПРОДАЖА позиций которые в плюсе ──────────────────
            for figi, pos in positions.items():
                if not pos["in_profit"]: continue  # ПРОДАЁМ ТОЛЬКО В ПЛЮС
                if pos["pnl_pct"] < 0.5: continue  # Минимум +0.5% прибыли

                # Проверяем сигнал на продажу
                prices = get_prices(figi)
                if len(prices) < 15: continue
                sig_rsi, rsi_val = rsi_signal(prices)
                sig_ema = ema_signal(prices)
                signal = sig_rsi if sig_rsi != "HOLD" else sig_ema

                if signal != "SELL": continue  # Продаём только если есть сигнал

                # Найти тикер
                ticker = next((i["ticker"] for i in watchlist if i["figi"] == figi), figi)
                lot = next((i["lot"] for i in watchlist if i["figi"] == figi), 1)
                lots_to_sell = max(1, int(pos["qty"] / lot))

                order = tb("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", {
                    "accountId": account_id,
                    "figi": figi,
                    "direction": "ORDER_DIRECTION_SELL",
                    "quantity": lots_to_sell,
                    "orderType": "ORDER_TYPE_MARKET",
                })
                profit_rub = round((pos["current_price"] - pos["avg_price"]) * pos["qty"], 2)
                results.append({
                    "ticker": ticker,
                    "signal": "SELL",
                    "rsi": rsi_val,
                    "lots": lots_to_sell,
                    "price": pos["current_price"],
                    "avg_price": pos["avg_price"],
                    "pnl_pct": pos["pnl_pct"],
                    "profit_rub": profit_rub,
                    "reason": f"✅ Прибыль +{pos['pnl_pct']}%",
                    "order_id": order.get("orderId", ""),
                    "status": order.get("executionReportStatus", ""),
                })

            # ── Шаг 2: ПОКУПКА по сигналам ──────────────────────────────
            import random
            sample = random.sample(watchlist, min(30, len(watchlist)))  # 30 случайных за цикл

            buy_count = 0
            for inst in sample:
                if free_cash < order_amt * 0.5: break  # Кончились деньги
                if buy_count >= 5: break  # Не более 5 покупок за цикл
                if inst["figi"] in positions: continue  # Уже держим

                prices = get_prices(inst["figi"])
                if len(prices) < 15: continue

                sig_rsi, rsi_val = rsi_signal(prices)
                sig_ema = ema_signal(prices)
                signal = sig_rsi if sig_rsi != "HOLD" else sig_ema

                if signal != "BUY": continue

                # Цена
                lp = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices", {"figi": [inst["figi"]]})
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
                })
                free_cash -= cost
                buy_count += 1
                results.append({
                    "ticker": inst["ticker"],
                    "signal": "BUY",
                    "rsi": rsi_val,
                    "lots": lots,
                    "price": last_price,
                    "total": round(cost, 2),
                    "order_id": order.get("orderId", ""),
                    "status": order.get("executionReportStatus", ""),
                })

            run_at = now.strftime("%d.%m.%Y %H:%M МСК")
            db_set("bot_last_run", run_at)
            db_set("bot_last_trades", json.dumps(results[:20], ensure_ascii=False))
            db_set("bot_daily_pnl", str(round(daily_pnl, 2)))

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