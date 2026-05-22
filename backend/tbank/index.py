"""
Т-Банк Invest API — торговля акциями, фьючерсами и ETF.
Поддерживает: поиск инструментов, портфель, размещение и отмену ордеров, история сделок.
"""
import os, json, requests

TOKEN = os.environ.get("TBANK_INVEST_TOKEN", "")
BASE = "https://invest-public-api.tinkoff.ru/rest"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
}

def resp(body, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(body, ensure_ascii=False)}

def tbank_post(path, payload):
    r = requests.post(f"{BASE}/{path}", headers=HEADERS, json=payload, timeout=15)
    return r.json()

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    if not TOKEN:
        return resp({"error": "TBANK_INVEST_TOKEN не задан. Добавьте токен в настройках."}, 500)

    # ─── GET ───────────────────────────────────────────────────────────────────
    if method == "GET":

        # Список счетов
        if action == "accounts":
            data = tbank_post("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {})
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

        # Портфель по счёту
        if action == "portfolio":
            account_id = params.get("account_id", "")
            data = tbank_post("tinkoff.public.invest.api.contract.v1.OperationsService/GetPortfolio", {"accountId": account_id})
            positions = []
            for p in data.get("positions", []):
                qty = p.get("quantity", {})
                cur_price = p.get("currentPrice", {})
                avg_price = p.get("averagePositionPrice", {})
                pnl = p.get("expectedYield", {})
                positions.append({
                    "figi": p.get("figi"),
                    "instrument_type": p.get("instrumentType"),
                    "quantity": float(qty.get("units", 0)),
                    "current_price": float(cur_price.get("units", 0)),
                    "avg_price": float(avg_price.get("units", 0)),
                    "pnl": float(pnl.get("units", 0)),
                    "currency": cur_price.get("currency", "RUB"),
                })
            total = data.get("totalAmountPortfolio", {})
            return resp({
                "positions": positions,
                "total_rub": float(total.get("units", 0)),
                "currency": total.get("currency", "RUB"),
            })

        # Поиск инструментов (акции, ETF, фьючерсы)
        if action == "search":
            query = params.get("query", "")
            kind = params.get("kind", "share")  # share | etf | futures | bond
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

        # Цена инструмента
        if action == "price":
            figi = params.get("figi", "")
            data = tbank_post("tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices", {"figi": [figi]})
            prices = data.get("lastPrices", [])
            if prices:
                p = prices[0]
                price_val = p.get("price", {})
                return resp({"figi": figi, "price": float(price_val.get("units", 0)), "currency": "RUB"})
            return resp({"error": "Цена не найдена"}, 404)

        # История операций
        if action == "operations":
            account_id = params.get("account_id", "")
            from datetime import datetime, timedelta, timezone
            now = datetime.now(timezone.utc)
            data = tbank_post("tinkoff.public.invest.api.contract.v1.OperationsService/GetOperations", {
                "accountId": account_id,
                "from": (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "state": "OPERATION_STATE_EXECUTED",
            })
            ops = []
            for o in data.get("operations", [])[:50]:
                pay = o.get("payment", {})
                price = o.get("price", {})
                ops.append({
                    "id": o.get("id"),
                    "type": o.get("operationType"),
                    "figi": o.get("figi"),
                    "quantity": o.get("quantity"),
                    "price": float(price.get("units", 0)),
                    "payment": float(pay.get("units", 0)),
                    "currency": pay.get("currency", "RUB"),
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
                ip = o.get("initialOrderPrice", {})
                orders.append({
                    "order_id": o.get("orderId"),
                    "figi": o.get("figi"),
                    "direction": o.get("direction"),
                    "type": o.get("orderType"),
                    "status": o.get("executionReportStatus"),
                    "lots": o.get("lotsRequested"),
                    "lots_done": o.get("lotsExecuted"),
                    "price": float(ip.get("units", 0)),
                    "currency": ip.get("currency", "RUB"),
                })
            return resp(orders)

        return resp({"error": f"Неизвестный action: {action}"}, 400)

    # ─── POST ──────────────────────────────────────────────────────────────────
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        action = body.get("action", "")

        # Выставить рыночный ордер
        if action == "place_order":
            account_id = body.get("account_id", "")
            figi = body.get("figi", "")
            direction = body.get("direction", "ORDER_DIRECTION_BUY")  # BUY | SELL
            lots = int(body.get("lots", 1))
            order_type = body.get("order_type", "ORDER_TYPE_MARKET")
            price = body.get("price")  # для лимитного ордера

            payload = {
                "accountId": account_id,
                "figi": figi,
                "direction": direction,
                "quantity": lots,
                "orderType": order_type,
            }
            if price and order_type == "ORDER_TYPE_LIMIT":
                units = int(price)
                payload["price"] = {"units": str(units), "nano": 0, "currency": "rub"}

            data = tbank_post("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", payload)
            return resp({
                "order_id": data.get("orderId"),
                "status": data.get("executionReportStatus"),
                "message": data.get("message", ""),
                "figi": figi,
                "direction": direction,
                "lots": lots,
            })

        # Отмена ордера
        if action == "cancel_order":
            account_id = body.get("account_id", "")
            order_id = body.get("order_id", "")
            data = tbank_post("tinkoff.public.invest.api.contract.v1.OrdersService/CancelOrder", {
                "accountId": account_id, "orderId": order_id
            })
            return resp({"success": True, "time": data.get("time")})

        return resp({"error": f"Неизвестный action: {action}"}, 400)

    return resp({"error": "Метод не поддерживается"}, 405)
