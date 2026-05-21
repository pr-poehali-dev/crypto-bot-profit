"""
Торговый бэкенд: размещение/отмена ордеров, баланс, позиции через Binance API.
Использует HMAC-SHA256 подпись запросов. Требует BINANCE_API_KEY и BINANCE_SECRET_KEY.
"""
import os
import json
import hmac
import hashlib
import time
import urllib.request
import urllib.parse
import urllib.error

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
    "Content-Type": "application/json"
}

BASE_SPOT = "https://api.binance.com"
BASE_FUTURES = "https://fapi.binance.com"


def sign(params: dict, secret: str) -> str:
    query = urllib.parse.urlencode(params)
    return hmac.new(secret.encode(), query.encode(), hashlib.sha256).hexdigest()


def binance_get(path: str, params: dict, api_key: str, secret: str, futures: bool = False) -> dict | list:
    base = BASE_FUTURES if futures else BASE_SPOT
    params["timestamp"] = int(time.time() * 1000)
    params["recvWindow"] = 5000
    params["signature"] = sign(params, secret)
    url = f"{base}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"X-MBX-APIKEY": api_key, "User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def binance_post(path: str, params: dict, api_key: str, secret: str, futures: bool = False) -> dict:
    base = BASE_FUTURES if futures else BASE_SPOT
    params["timestamp"] = int(time.time() * 1000)
    params["recvWindow"] = 5000
    params["signature"] = sign(params, secret)
    data = urllib.parse.urlencode(params).encode()
    url = f"{base}{path}"
    req = urllib.request.Request(url, data=data, headers={
        "X-MBX-APIKEY": api_key,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0"
    }, method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def binance_delete(path: str, params: dict, api_key: str, secret: str, futures: bool = False) -> dict:
    base = BASE_FUTURES if futures else BASE_SPOT
    params["timestamp"] = int(time.time() * 1000)
    params["recvWindow"] = 5000
    params["signature"] = sign(params, secret)
    url = f"{base}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"X-MBX-APIKEY": api_key, "User-Agent": "Mozilla/5.0"}, method="DELETE")
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def ok(data) -> dict:
    return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps(data)}


def err(msg: str, code: int = 400) -> dict:
    return {"statusCode": code, "headers": CORS_HEADERS, "body": json.dumps({"error": msg})}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    api_key = os.environ.get("BINANCE_API_KEY", "")
    secret = os.environ.get("BINANCE_SECRET_KEY", "")

    if not api_key or not secret:
        return ok({
            "connected": False,
            "message": "API ключи не настроены. Добавьте BINANCE_API_KEY и BINANCE_SECRET_KEY в секреты проекта."
        })

    method = event.get("httpMethod", "GET")
    params_q = event.get("queryStringParameters") or {}
    action = params_q.get("action", "status")

    try:
        # ---- GET запросы ----
        if method == "GET":

            if action == "status":
                # Проверка соединения: получаем информацию об аккаунте
                data = binance_get("/api/v3/account", {}, api_key, secret)
                balances = [b for b in data.get("balances", []) if float(b["free"]) > 0 or float(b["locked"]) > 0]
                return ok({
                    "connected": True,
                    "can_trade": data.get("canTrade", False),
                    "can_withdraw": data.get("canWithdraw", False),
                    "maker_commission": data.get("makerCommission", 0),
                    "taker_commission": data.get("takerCommission", 0),
                    "balances": balances[:20],
                    "account_type": data.get("accountType", "SPOT"),
                })

            elif action == "balance":
                data = binance_get("/api/v3/account", {}, api_key, secret)
                balances = [b for b in data.get("balances", []) if float(b["free"]) > 0 or float(b["locked"]) > 0]
                return ok({"balances": balances})

            elif action == "futures_balance":
                data = binance_get("/fapi/v2/balance", {}, api_key, secret, futures=True)
                return ok({"balances": data})

            elif action == "futures_positions":
                data = binance_get("/fapi/v2/positionRisk", {}, api_key, secret, futures=True)
                open_positions = [p for p in data if float(p.get("positionAmt", 0)) != 0]
                return ok({"positions": open_positions})

            elif action == "open_orders":
                symbol = params_q.get("symbol", "")
                p = {}
                if symbol:
                    p["symbol"] = symbol
                data = binance_get("/api/v3/openOrders", p, api_key, secret)
                return ok({"orders": data})

            elif action == "my_trades":
                symbol = params_q.get("symbol", "BTCUSDT")
                limit = int(params_q.get("limit", "20"))
                data = binance_get("/api/v3/myTrades", {"symbol": symbol, "limit": limit}, api_key, secret)
                return ok({"trades": data})

            elif action == "futures_orders":
                symbol = params_q.get("symbol", "BTCUSDT")
                data = binance_get("/fapi/v1/openOrders", {"symbol": symbol}, api_key, secret, futures=True)
                return ok({"orders": data})

            else:
                return err("Unknown action")

        # ---- POST запросы ----
        elif method == "POST":
            try:
                body = json.loads(event.get("body") or "{}")
            except Exception:
                return err("Invalid JSON")

            action_p = body.get("action", "")

            if action_p == "place_spot_order":
                symbol = body.get("symbol", "BTCUSDT")
                side = body.get("side", "BUY").upper()
                order_type = body.get("type", "MARKET").upper()
                p = {
                    "symbol": symbol,
                    "side": side,
                    "type": order_type,
                }
                if order_type == "MARKET":
                    # Можно задать quoteOrderQty (сумма в USDT) или quantity
                    if body.get("quoteOrderQty"):
                        p["quoteOrderQty"] = str(body["quoteOrderQty"])
                    else:
                        p["quantity"] = str(body.get("quantity", ""))
                elif order_type == "LIMIT":
                    p["quantity"] = str(body.get("quantity", ""))
                    p["price"] = str(body.get("price", ""))
                    p["timeInForce"] = body.get("timeInForce", "GTC")

                data = binance_post("/api/v3/order", p, api_key, secret)
                return ok({"success": True, "order": data})

            elif action_p == "place_futures_order":
                symbol = body.get("symbol", "BTCUSDT")
                side = body.get("side", "BUY").upper()
                position_side = body.get("positionSide", "BOTH").upper()
                order_type = body.get("type", "MARKET").upper()
                quantity = str(body.get("quantity", ""))
                p = {
                    "symbol": symbol,
                    "side": side,
                    "positionSide": position_side,
                    "type": order_type,
                    "quantity": quantity,
                }
                if order_type == "LIMIT":
                    p["price"] = str(body.get("price", ""))
                    p["timeInForce"] = "GTC"

                # Установить плечо если передано
                leverage = body.get("leverage")
                if leverage:
                    binance_post("/fapi/v1/leverage", {"symbol": symbol, "leverage": int(leverage)}, api_key, secret, futures=True)

                # Стоп-лосс
                sl_price = body.get("sl_price")
                if sl_price:
                    sl_side = "SELL" if side == "BUY" else "BUY"
                    binance_post("/fapi/v1/order", {
                        "symbol": symbol, "side": sl_side, "positionSide": position_side,
                        "type": "STOP_MARKET", "stopPrice": str(sl_price), "closePosition": "true"
                    }, api_key, secret, futures=True)

                # Тейк-профит
                tp_price = body.get("tp_price")
                if tp_price:
                    tp_side = "SELL" if side == "BUY" else "BUY"
                    binance_post("/fapi/v1/order", {
                        "symbol": symbol, "side": tp_side, "positionSide": position_side,
                        "type": "TAKE_PROFIT_MARKET", "stopPrice": str(tp_price), "closePosition": "true"
                    }, api_key, secret, futures=True)

                data = binance_post("/fapi/v1/order", p, api_key, secret, futures=True)
                return ok({"success": True, "order": data})

            elif action_p == "set_leverage":
                symbol = body.get("symbol", "BTCUSDT")
                leverage = int(body.get("leverage", 1))
                data = binance_post("/fapi/v1/leverage", {"symbol": symbol, "leverage": leverage}, api_key, secret, futures=True)
                return ok({"success": True, "leverage": data})

            elif action_p == "close_position":
                symbol = body.get("symbol", "BTCUSDT")
                quantity = str(body.get("quantity", ""))
                side = body.get("side", "SELL").upper()
                data = binance_post("/fapi/v1/order", {
                    "symbol": symbol, "side": side, "positionSide": "BOTH",
                    "type": "MARKET", "quantity": quantity, "reduceOnly": "true"
                }, api_key, secret, futures=True)
                return ok({"success": True, "order": data})

            else:
                return err("Unknown POST action")

        # ---- DELETE запросы ----
        elif method == "DELETE":
            try:
                body = json.loads(event.get("body") or "{}")
            except Exception:
                return err("Invalid JSON")

            symbol = body.get("symbol", "BTCUSDT")
            order_id = body.get("orderId")
            futures = body.get("futures", False)

            path = "/fapi/v1/order" if futures else "/api/v3/order"
            data = binance_delete(path, {"symbol": symbol, "orderId": order_id}, api_key, secret, futures=futures)
            return ok({"success": True, "cancelled": data})

        return err("Method not allowed", 405)

    except urllib.error.HTTPError as e:
        body_bytes = e.read()
        try:
            binance_err = json.loads(body_bytes)
            msg = binance_err.get("msg", f"HTTP {e.code}")
        except Exception:
            msg = f"Binance HTTP {e.code}"
        return err(f"Binance: {msg}", 502)
    except Exception as e:
        return err(str(e), 500)
