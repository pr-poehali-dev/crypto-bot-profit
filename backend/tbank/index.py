"""
Т-Банк Invest API — торговля акциями, фьючерсами и ETF.
Поддерживает: баланс, портфель, операции, поиск инструментов, ордера.
"""
import os, json, requests
from datetime import datetime, timedelta, timezone
import psycopg2

TOKEN = os.environ.get("TBANK_INVEST_TOKEN", "")
BASE = "https://invest-public-api.tinkoff.ru/rest"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
DB_URL = os.environ.get("DATABASE_URL", "")
SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p28097026_crypto_bot_profit")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
}

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

def tbank_post(path, payload):
    r = requests.post(f"{BASE}/{path}", headers=HEADERS, json=payload, timeout=15)
    return r.json()

def money(m):
    if not m:
        return 0.0
    units = float(m.get("units", 0))
    nano = float(m.get("nano", 0))
    return units + nano / 1_000_000_000

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    headers_in = event.get("headers") or {}
    session_id = headers_in.get("x-session-id") or headers_in.get("X-Session-Id") or ""
    if not check_session(session_id):
        return resp({"error": "Не авторизован"}, 401)

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    if not TOKEN:
        return resp({"error": "TBANK_INVEST_TOKEN не задан."}, 500)

    # ─── GET ───────────────────────────────────────────────────────────────────
    if method == "GET":

        # Список счетов
        if action == "accounts":
            data = tbank_post("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {})
            if "code" in data:
                return resp({"error": data.get("message", "Ошибка API")}, 400)
            accounts = []
            for a in data.get("accounts", []):
                accounts.append({
                    "id": a.get("id"),
                    "name": a.get("name"),
                    "type": a.get("type"),
                    "status": a.get("status"),
                    "opened_date": a.get("openedDate"),
                })
            return resp(accounts)

        # Полный баланс счёта
        if action == "balance":
            account_id = params.get("account_id", "")

            # Если account_id не передан — берём первый счёт
            if not account_id:
                acc_data = tbank_post("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {})
                accounts = acc_data.get("accounts", [])
                if not accounts:
                    return resp({"error": "Счета не найдены"}, 404)
                account_id = accounts[0].get("id", "")

            # Портфель
            portfolio = tbank_post("tinkoff.public.invest.api.contract.v1.OperationsService/GetPortfolio", {
                "accountId": account_id, "currency": "RUB"
            })

            total_shares = money(portfolio.get("totalAmountShares"))
            total_bonds = money(portfolio.get("totalAmountBonds"))
            total_etf = money(portfolio.get("totalAmountEtf"))
            total_futures = money(portfolio.get("totalAmountFutures"))
            total_currencies = money(portfolio.get("totalAmountCurrencies"))
            expected_yield = money(portfolio.get("expectedYield"))

            invested = total_shares + total_bonds + total_etf + total_futures
            total = invested + total_currencies

            # Позиции
            positions = []
            for p in portfolio.get("positions", []):
                qty        = money(p.get("quantity"))
                cur_price  = money(p.get("currentPrice"))
                # averagePositionPrice — рублёвая цена (не пункты!)
                avg_price  = money(p.get("averagePositionPrice")) or money(p.get("averagePositionPricePt"))
                pnl        = money(p.get("expectedYield"))
                isin       = p.get("isin") or p.get("figi", "")
                # pnl_pct = pnl / (avg_price * qty) * 100
                cost_basis = avg_price * qty
                pnl_pct    = round(pnl / cost_basis * 100, 2) if cost_basis and cost_basis > 0 else 0
                positions.append({
                    "figi":            p.get("figi"),
                    "isin":            isin,
                    "instrument_type": p.get("instrumentType", "share"),
                    "name":            isin,
                    "quantity":        qty,
                    "current_price":   cur_price,
                    "avg_price":       avg_price,
                    "pnl":             pnl,
                    "pnl_pct":         pnl_pct,
                    "currency":        p.get("currentPrice", {}).get("currency", "RUB"),
                })

            # История операций за 30 дней для подсчёта P&L
            now = datetime.now(timezone.utc)
            ops_data = tbank_post("tinkoff.public.invest.api.contract.v1.OperationsService/GetOperations", {
                "accountId": account_id,
                "from": (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "state": "OPERATION_STATE_EXECUTED",
            })

            ops = ops_data.get("operations", [])
            trades_total = 0
            trades_win = 0
            trades_loss = 0
            profit_total = 0.0
            spent_total = 0.0
            commission_total = 0.0
            profit_today = 0.0
            profit_week = 0.0
            today = now.date()
            week_ago = today - timedelta(days=7)

            daily_pnl = {}

            for o in ops:
                op_type = o.get("operationType", "")
                pay = money(o.get("payment"))
                date_str = o.get("date", "")
                op_date = None
                if date_str:
                    op_date = datetime.fromisoformat(date_str.replace("Z", "+00:00")).date()

                if op_type == "OPERATION_TYPE_BROKER_FEE":
                    commission_total += abs(pay)
                elif op_type in ("OPERATION_TYPE_BUY", "OPERATION_TYPE_BUY_CARD"):
                    spent_total += abs(pay)
                elif op_type == "OPERATION_TYPE_SELL":
                    pnl_op = pay  # положительный = прибыль
                    profit_total += pnl_op
                    trades_total += 1
                    if pnl_op > 0:
                        trades_win += 1
                    else:
                        trades_loss += 1
                    if op_date:
                        day_key = op_date.isoformat()
                        daily_pnl[day_key] = daily_pnl.get(day_key, 0) + pnl_op
                        if op_date == today:
                            profit_today += pnl_op
                        if op_date >= week_ago:
                            profit_week += pnl_op

            # Дневной P&L для графика (7 дней)
            daily_chart = []
            for i in range(6, -1, -1):
                d = today - timedelta(days=i)
                daily_chart.append({
                    "day": d.strftime("%-d %b"),
                    "date": d.isoformat(),
                    "pnl": round(daily_pnl.get(d.isoformat(), 0), 2),
                })

            return resp({
                "account_id": account_id,
                "total": round(total, 2),
                "free": round(total_currencies, 2),
                "invested": round(invested, 2),
                "expected_yield": round(expected_yield, 2),
                "profit_total": round(profit_total, 2),
                "profit_today": round(profit_today, 2),
                "profit_week": round(profit_week, 2),
                "spent_total": round(spent_total, 2),
                "commission_total": round(commission_total, 2),
                "profit_pct": round(expected_yield / invested * 100, 2) if invested else 0,
                "trades_total": trades_total,
                "trades_win": trades_win,
                "trades_loss": trades_loss,
                "positions": positions,
                "daily_chart": daily_chart,
            })

        # Портфель по счёту
        if action == "portfolio":
            account_id = params.get("account_id", "")
            data = tbank_post("tinkoff.public.invest.api.contract.v1.OperationsService/GetPortfolio", {"accountId": account_id})
            positions = []
            for p in data.get("positions", []):
                positions.append({
                    "figi": p.get("figi"),
                    "instrument_type": p.get("instrumentType"),
                    "quantity": money(p.get("quantity")),
                    "current_price": money(p.get("currentPrice")),
                    "avg_price": money(p.get("averagePositionPrice")),
                    "pnl": money(p.get("expectedYield")),
                    "currency": p.get("currentPrice", {}).get("currency", "RUB"),
                })
            total = data.get("totalAmountPortfolio", {})
            return resp({
                "positions": positions,
                "total_rub": money(total),
                "currency": total.get("currency", "RUB"),
            })

        # Поиск инструментов
        if action == "search":
            query = params.get("query", "")
            kind = params.get("kind", "share")
            data = tbank_post("tinkoff.public.invest.api.contract.v1.InstrumentsService/FindInstrument", {
                "query": query, "instrumentKind": kind.upper(), "apiTradeAvailableFlag": True
            })
            instruments = []
            for i in data.get("instruments", [])[:20]:
                instruments.append({
                    "figi": i.get("figi"),
                    "ticker": i.get("ticker"),
                    "name": i.get("name"),
                    "type": i.get("instrumentType"),
                    "currency": i.get("currency"),
                    "lot": i.get("lot"),
                    "exchange": i.get("exchange"),
                })
            return resp(instruments)

        # История операций
        if action == "operations":
            account_id = params.get("account_id", "")
            now = datetime.now(timezone.utc)
            data = tbank_post("tinkoff.public.invest.api.contract.v1.OperationsService/GetOperations", {
                "accountId": account_id,
                "from": (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "state": "OPERATION_STATE_EXECUTED",
            })
            ops = []
            for o in data.get("operations", [])[:50]:
                ops.append({
                    "id": o.get("id"),
                    "type": o.get("operationType"),
                    "figi": o.get("figi"),
                    "quantity": o.get("quantity"),
                    "price": money(o.get("price")),
                    "payment": money(o.get("payment")),
                    "currency": o.get("payment", {}).get("currency", "RUB"),
                    "date": o.get("date"),
                    "status": o.get("state"),
                })
            return resp(ops)

        # Открытые ордера
        if action == "orders":
            account_id = params.get("account_id", "")
            data = tbank_post("tinkoff.public.invest.api.contract.v1.OrdersService/GetOrders", {"accountId": account_id})
            orders = []
            for o in data.get("orders", []):
                orders.append({
                    "order_id": o.get("orderId"),
                    "figi": o.get("figi"),
                    "direction": o.get("direction"),
                    "type": o.get("orderType"),
                    "status": o.get("executionReportStatus"),
                    "lots": o.get("lotsRequested"),
                    "lots_done": o.get("lotsExecuted"),
                    "price": money(o.get("initialOrderPrice")),
                    "currency": o.get("initialOrderPrice", {}).get("currency", "RUB"),
                })
            return resp(orders)

        return resp({"error": f"Неизвестный action: {action}"}, 400)

    # ─── POST ──────────────────────────────────────────────────────────────────
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        action = body.get("action", "")

        if action == "place_order":
            account_id = body.get("account_id", "")
            figi = body.get("figi", "")
            direction = body.get("direction", "ORDER_DIRECTION_BUY")
            lots = int(body.get("lots", 1))
            order_type = body.get("order_type", "ORDER_TYPE_MARKET")
            price = body.get("price")
            payload = {
                "accountId": account_id,
                "figi": figi,
                "direction": direction,
                "quantity": lots,
                "orderType": order_type,
            }
            if price and order_type == "ORDER_TYPE_LIMIT":
                payload["price"] = {"units": str(int(price)), "nano": 0, "currency": "rub"}
            data = tbank_post("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", payload)
            return resp({
                "order_id": data.get("orderId"),
                "status": data.get("executionReportStatus"),
                "message": data.get("message", ""),
                "figi": figi,
                "direction": direction,
                "lots": lots,
            })

        if action == "cancel_order":
            account_id = body.get("account_id", "")
            order_id = body.get("order_id", "")
            data = tbank_post("tinkoff.public.invest.api.contract.v1.OrdersService/CancelOrder", {
                "accountId": account_id, "orderId": order_id
            })
            return resp({"success": True, "time": data.get("time")})

        return resp({"error": f"Неизвестный action: {action}"}, 400)

    return resp({"error": "Метод не поддерживается"}, 405)