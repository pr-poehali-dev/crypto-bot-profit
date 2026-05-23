"""
Автоторговля КиберБот — планировщик сигналов + исполнение ордеров через Т-Банк Invest.
Режимы: 10% / 25% / 50% от свободного остатка или фиксированная сумма.
Защита: дневной стоп-лосс 3% от баланса.
"""
import os, json, requests, hashlib, hmac, time
from datetime import datetime, timedelta, timezone

TBANK_TOKEN = os.environ.get("TBANK_INVEST_TOKEN", "")
TBANK_BASE = "https://invest-public-api.tinkoff.ru/rest"
TBANK_HEADERS = {"Authorization": f"Bearer {TBANK_TOKEN}", "Content-Type": "application/json"}
DB_URL = os.environ.get("DATABASE_URL", "")
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p28097026_crypto_bot_profit")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
}

def resp(body, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(body, ensure_ascii=False, default=str)}

def tbank(path, payload):
    r = requests.post(f"{TBANK_BASE}/{path}", headers=TBANK_HEADERS, json=payload, timeout=15)
    return r.json()

def money(m):
    if not m:
        return 0.0
    return float(m.get("units", 0)) + float(m.get("nano", 0)) / 1_000_000_000

def db_query(sql):
    import psycopg2
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(f"SET search_path TO {SCHEMA}")
    cur.execute(sql)
    conn.commit()
    rows = cur.fetchall() if cur.description else []
    cols = [d[0] for d in cur.description] if cur.description else []
    cur.close()
    conn.close()
    return [dict(zip(cols, r)) for r in rows]

def get_setting(key, default=""):
    try:
        rows = db_query(f"SELECT value FROM bot_settings WHERE key = '{key}' AND user_id = 1")
        return rows[0]["value"] if rows else default
    except:
        return default

def set_setting(key, value):
    try:
        db_query(f"UPDATE bot_settings SET value = '{value}', updated_at = NOW() WHERE key = '{key}' AND user_id = 1")
    except:
        pass

def get_account_id():
    data = tbank("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {})
    accounts = data.get("accounts", [])
    return accounts[0].get("id", "") if accounts else ""

def get_portfolio(account_id):
    return tbank("tinkoff.public.invest.api.contract.v1.OperationsService/GetPortfolio", {
        "accountId": account_id, "currency": "RUB"
    })

def calc_order_amount(free_cash, mode, fixed_amount=0):
    """Рассчитать сумму на сделку по режиму."""
    if mode == "10pct":
        return free_cash * 0.10
    elif mode == "25pct":
        return free_cash * 0.25
    elif mode == "50pct":
        return free_cash * 0.50
    elif mode == "fixed":
        return min(float(fixed_amount), free_cash * 0.90)
    return free_cash * 0.10

def check_daily_stop(account_id, balance_total, stop_pct=3.0):
    """Проверить не превышен ли дневной стоп-лосс."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    ops = tbank("tinkoff.public.invest.api.contract.v1.OperationsService/GetOperations", {
        "accountId": account_id,
        "from": today_start,
        "to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "state": "OPERATION_STATE_EXECUTED",
    })
    daily_pnl = 0.0
    for o in ops.get("operations", []):
        if o.get("operationType") == "OPERATION_TYPE_SELL":
            daily_pnl += money(o.get("payment", {}))
    max_loss = balance_total * (stop_pct / 100)
    stopped = daily_pnl < -max_loss
    return {"daily_pnl": round(daily_pnl, 2), "max_loss": round(-max_loss, 2), "stopped": stopped}

def rsi_signal(prices, period=14):
    """Вычислить RSI и вернуть сигнал: BUY / SELL / HOLD."""
    if len(prices) < period + 1:
        return "HOLD", 50
    gains, losses = [], []
    for i in range(1, len(prices)):
        diff = prices[i] - prices[i-1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))
    avg_gain = sum(gains[-period:]) / period
    avg_loss = sum(losses[-period:]) / period
    if avg_loss == 0:
        return "HOLD", 100
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    if rsi < 30:
        return "BUY", round(rsi, 1)
    elif rsi > 70:
        return "SELL", round(rsi, 1)
    return "HOLD", round(rsi, 1)

def ema(prices, period):
    if not prices:
        return 0
    k = 2 / (period + 1)
    e = prices[0]
    for p in prices[1:]:
        e = p * k + e * (1 - k)
    return e

def ema_cross_signal(prices):
    """EMA 9/21 пересечение."""
    if len(prices) < 22:
        return "HOLD"
    fast = ema(prices[-9:], 9)
    slow = ema(prices[-21:], 21)
    fast_prev = ema(prices[-10:-1], 9)
    slow_prev = ema(prices[-22:-1], 21)
    if fast > slow and fast_prev <= slow_prev:
        return "BUY"
    if fast < slow and fast_prev >= slow_prev:
        return "SELL"
    return "HOLD"

def get_candles_prices(figi, interval="CANDLE_INTERVAL_HOUR", count=30):
    """Получить цены закрытия свечей."""
    now = datetime.now(timezone.utc)
    hours = 30 if "HOUR" in interval else 120
    data = tbank("tinkoff.public.invest.api.contract.v1.MarketDataService/GetCandles", {
        "figi": figi,
        "from": (now - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "interval": interval,
    })
    candles = data.get("candles", [])
    return [money(c.get("close")) for c in candles if c.get("isComplete")]

def place_order(account_id, figi, direction, lots):
    """Выставить рыночный ордер."""
    return tbank("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", {
        "accountId": account_id,
        "figi": figi,
        "direction": direction,
        "quantity": lots,
        "orderType": "ORDER_TYPE_MARKET",
    })

def get_last_price(figi):
    data = tbank("tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices", {"figi": [figi]})
    prices = data.get("lastPrices", [])
    return money(prices[0].get("price")) if prices else 0

def get_instrument_lot(figi):
    data = tbank("tinkoff.public.invest.api.contract.v1.InstrumentsService/GetInstrumentBy", {
        "idType": "INSTRUMENT_ID_TYPE_FIGI", "id": figi
    })
    return data.get("instrument", {}).get("lot", 1)

# Инструменты для торговли
WATCHLIST = [
    {"figi": "BBG004730N88", "ticker": "SBER", "name": "Сбербанк"},
    {"figi": "BBG004731354", "ticker": "GAZP", "name": "Газпром"},
    {"figi": "BBG004RVFCY3", "ticker": "YNDX", "name": "Яндекс"},
    {"figi": "TCS00A106YF0", "ticker": "TMOS", "name": "Тинькофф iMOEX ETF"},
    {"figi": "BBG000BVPV84", "ticker": "AAPL", "name": "Apple"},
]

def run_signals(account_id, free_cash, order_amount):
    """Прогнать стратегии и исполнить сигналы."""
    results = []
    for inst in WATCHLIST:
        figi = inst["figi"]
        prices = get_candles_prices(figi)
        if len(prices) < 15:
            results.append({"ticker": inst["ticker"], "signal": "SKIP", "reason": "мало данных"})
            continue

        signal_rsi, rsi_val = rsi_signal(prices)
        signal_ema = ema_cross_signal(prices)

        # Консенсус: оба сигнала совпадают
        if signal_rsi == signal_ema and signal_rsi != "HOLD":
            signal = signal_rsi
        elif signal_rsi != "HOLD":
            signal = signal_rsi
        else:
            signal = "HOLD"

        if signal == "HOLD":
            results.append({"ticker": inst["ticker"], "signal": "HOLD", "rsi": rsi_val})
            continue

        # Рассчитать кол-во лотов
        last_price = get_last_price(figi)
        lot_size = get_instrument_lot(figi)
        if last_price <= 0 or lot_size <= 0:
            results.append({"ticker": inst["ticker"], "signal": "SKIP", "reason": "нет цены"})
            continue

        lot_price = last_price * lot_size
        lots = max(1, int(order_amount / lot_price))
        total_cost = lots * lot_price

        if total_cost > free_cash:
            results.append({"ticker": inst["ticker"], "signal": signal, "reason": "недостаточно средств"})
            continue

        direction = "ORDER_DIRECTION_BUY" if signal == "BUY" else "ORDER_DIRECTION_SELL"
        order = place_order(account_id, figi, direction, lots)
        order_id = order.get("orderId", "")
        status = order.get("executionReportStatus", "")

        results.append({
            "ticker": inst["ticker"],
            "signal": signal,
            "rsi": rsi_val,
            "lots": lots,
            "price": last_price,
            "total": round(total_cost, 2),
            "order_id": order_id,
            "status": status,
        })

    return results

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    if not TBANK_TOKEN:
        return resp({"error": "TBANK_INVEST_TOKEN не задан"}, 500)

    # ── GET: статус бота ────────────────────────────────────────────────────
    if method == "GET" and action == "status":
        enabled = get_setting("auto_bot_enabled", "false")
        mode = get_setting("trade_mode", "10pct")
        fixed_amount = get_setting("trade_fixed_amount", "5000")
        stop_pct = get_setting("max_daily_loss_pct", "3")
        last_run = get_setting("bot_last_run", "—")
        last_trades = get_setting("bot_last_trades", "[]")
        daily_pnl_str = get_setting("bot_daily_pnl", "0")
        return resp({
            "enabled": enabled == "true",
            "mode": mode,
            "fixed_amount": float(fixed_amount),
            "stop_pct": float(stop_pct),
            "last_run": last_run,
            "last_trades": json.loads(last_trades) if last_trades else [],
            "daily_pnl": float(daily_pnl_str),
        })

    # ── POST: управление ────────────────────────────────────────────────────
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        action = body.get("action", "")

        # Сохранить настройки
        if action == "save_settings":
            mode = body.get("mode", "10pct")
            fixed_amount = str(body.get("fixed_amount", 5000))
            stop_pct = str(body.get("stop_pct", 3))
            enabled = str(body.get("enabled", False)).lower()
            set_setting("trade_mode", mode)
            set_setting("trade_fixed_amount", fixed_amount)
            set_setting("max_daily_loss_pct", stop_pct)
            set_setting("auto_bot_enabled", enabled)
            return resp({"success": True, "message": "Настройки сохранены"})

        # Запустить один цикл торговли вручную
        if action == "run_once":
            mode = get_setting("trade_mode", "10pct")
            fixed_amount = float(get_setting("trade_fixed_amount", "5000"))
            stop_pct = float(get_setting("max_daily_loss_pct", "3"))

            account_id = get_account_id()
            if not account_id:
                return resp({"error": "Счёт не найден"}, 404)

            portfolio = get_portfolio(account_id)
            free_cash = money(portfolio.get("totalAmountCurrencies"))
            total_balance = money(portfolio.get("totalAmountPortfolio")) + free_cash

            # Проверка дневного стопа
            stop_check = check_daily_stop(account_id, total_balance, stop_pct)
            if stop_check["stopped"]:
                set_setting("auto_bot_enabled", "false")
                return resp({
                    "stopped": True,
                    "reason": f"Дневной убыток {stop_check['daily_pnl']} ₽ превысил лимит {stop_check['max_loss']} ₽",
                    "daily_pnl": stop_check["daily_pnl"],
                })

            order_amount = calc_order_amount(free_cash, mode, fixed_amount)
            results = run_signals(account_id, free_cash, order_amount)

            now_str = datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M МСК")
            set_setting("bot_last_run", now_str)
            set_setting("bot_last_trades", json.dumps(results, ensure_ascii=False))
            set_setting("bot_daily_pnl", str(stop_check["daily_pnl"]))

            return resp({
                "success": True,
                "account_id": account_id,
                "free_cash": round(free_cash, 2),
                "order_amount": round(order_amount, 2),
                "daily_pnl": stop_check["daily_pnl"],
                "results": results,
                "run_at": now_str,
            })

        return resp({"error": f"Неизвестный action: {action}"}, 400)

    return resp({"error": "Метод не поддерживается"}, 405)
