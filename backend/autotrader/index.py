"""Автоторговля КиберБот v3 — RSI+EMA сигналы, Т-Банк Invest."""
import os, json, requests
from datetime import datetime, timedelta, timezone
import psycopg2

TBANK_TOKEN = os.environ.get("TBANK_INVEST_TOKEN", "")
TBANK_BASE = "https://invest-public-api.tinkoff.ru/rest"
TBANK_H = {"Authorization": f"Bearer {TBANK_TOKEN}", "Content-Type": "application/json"}
DB_URL = os.environ.get("DATABASE_URL", "")
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p28097026_crypto_bot_profit")
CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"}

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

WATCHLIST = [
    {"figi": "BBG004730N88", "ticker": "SBER"},
    {"figi": "BBG004RVFCY3", "ticker": "YNDX"},
    {"figi": "TCS00A106YF0", "ticker": "TMOS"},
    {"figi": "BBG000BVPV84", "ticker": "AAPL"},
    {"figi": "BBG004731354", "ticker": "GAZP"},
]

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

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
        return resp({
            "enabled": enabled == "true",
            "mode": mode,
            "fixed_amount": float(fixed),
            "stop_pct": 3.0,
            "last_run": last_run,
            "last_trades": json.loads(trades),
            "daily_pnl": float(pnl),
        })

    # ── POST ────────────────────────────────────────────────────────────────
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        action = body.get("action", "")

        # Сохранить настройки
        if action == "save_settings":
            db_set("trade_mode", body.get("mode", "10pct"))
            db_set("trade_fixed_amount", str(body.get("fixed_amount", 5000)))
            db_set("max_daily_loss_pct", str(body.get("stop_pct", 3)))
            db_set("auto_bot_enabled", "true" if body.get("enabled") else "false")
            return resp({"success": True})

        # Запустить один цикл
        if action == "run_once":
            mode         = db_get("trade_mode") or "10pct"
            fixed_amount = float(db_get("trade_fixed_amount") or 5000)
            stop_pct     = float(db_get("max_daily_loss_pct") or 3)

            # Счёт
            accounts = tb("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {})
            accs = accounts.get("accounts", [])
            if not accs: return resp({"error": "Счёт не найден"}, 404)
            account_id = accs[0]["id"]

            # Портфель
            portfolio = tb("tinkoff.public.invest.api.contract.v1.OperationsService/GetPortfolio", {"accountId": account_id, "currency": "RUB"})
            free_cash = money(portfolio.get("totalAmountCurrencies"))
            total_bal = money(portfolio.get("totalAmountPortfolio", {})) + free_cash

            # Дневной стоп
            now = datetime.now(timezone.utc)
            ops = tb("tinkoff.public.invest.api.contract.v1.OperationsService/GetOperations", {
                "accountId": account_id,
                "from": now.replace(hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "state": "OPERATION_STATE_EXECUTED",
            })
            daily_pnl = sum(money(o.get("payment")) for o in ops.get("operations", []) if o.get("operationType") == "OPERATION_TYPE_SELL")
            max_loss = -total_bal * stop_pct / 100
            if daily_pnl < max_loss:
                db_set("auto_bot_enabled", "false")
                return resp({"stopped": True, "reason": f"Дневной убыток {daily_pnl:.0f} ₽ > лимит {max_loss:.0f} ₽", "daily_pnl": daily_pnl})

            # Сумма на сделку
            if mode == "10pct":   order_amt = free_cash * 0.10
            elif mode == "25pct": order_amt = free_cash * 0.25
            elif mode == "50pct": order_amt = free_cash * 0.50
            else:                 order_amt = min(fixed_amount, free_cash * 0.90)

            # Сигналы и ордера
            results = []
            for inst in WATCHLIST:
                prices = get_prices(inst["figi"])
                if len(prices) < 15:
                    results.append({"ticker": inst["ticker"], "signal": "SKIP", "reason": "мало данных"})
                    continue
                sig_rsi, rsi_val = rsi_signal(prices)
                sig_ema = ema_signal(prices)
                signal = sig_rsi if sig_rsi != "HOLD" else sig_ema
                if signal == "HOLD":
                    results.append({"ticker": inst["ticker"], "signal": "HOLD", "rsi": rsi_val})
                    continue
                # Цена и лоты
                lp = tb("tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices", {"figi": [inst["figi"]]})
                last_price = money(lp.get("lastPrices", [{}])[0].get("price")) if lp.get("lastPrices") else 0
                instr = tb("tinkoff.public.invest.api.contract.v1.InstrumentsService/GetInstrumentBy", {"idType": "INSTRUMENT_ID_TYPE_FIGI", "id": inst["figi"]})
                lot = instr.get("instrument", {}).get("lot", 1)
                if last_price <= 0:
                    results.append({"ticker": inst["ticker"], "signal": signal, "reason": "нет цены"})
                    continue
                lots = max(1, int(order_amt / (last_price * lot)))
                cost = lots * last_price * lot
                if cost > free_cash:
                    results.append({"ticker": inst["ticker"], "signal": signal, "reason": "недостаточно средств"})
                    continue
                direction = "ORDER_DIRECTION_BUY" if signal == "BUY" else "ORDER_DIRECTION_SELL"
                order = tb("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", {"accountId": account_id, "figi": inst["figi"], "direction": direction, "quantity": lots, "orderType": "ORDER_TYPE_MARKET"})
                results.append({"ticker": inst["ticker"], "signal": signal, "rsi": rsi_val, "lots": lots, "price": last_price, "total": round(cost, 2), "order_id": order.get("orderId", ""), "status": order.get("executionReportStatus", "")})

            run_at = now.strftime("%d.%m.%Y %H:%M МСК")
            db_set("bot_last_run", run_at)
            db_set("bot_last_trades", json.dumps(results, ensure_ascii=False))
            db_set("bot_daily_pnl", str(round(daily_pnl, 2)))
            return resp({"success": True, "free_cash": round(free_cash, 2), "order_amount": round(order_amt, 2), "daily_pnl": round(daily_pnl, 2), "results": results, "run_at": run_at})

        return resp({"error": f"Неизвестный action: {action}"}, 400)

    return resp({"error": "Метод не поддерживается"}, 405)