"""
Получение рыночных данных с Binance (публичный API, ключи не нужны).
Возвращает котировки, свечи, ордербук и статистику 24ч.
"""
import json
import urllib.request
import urllib.error

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
}

BINANCE_BASE = "https://api.binance.com/api/v3"

def fetch(url: str) -> dict | list:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    params = event.get("queryStringParameters") or {}
    action = params.get("action", "ticker24h")

    try:
        if action == "ticker24h":
            symbols_raw = params.get("symbols", "BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT")
            symbols = [s.strip() for s in symbols_raw.split(",")]
            result = []
            for sym in symbols:
                data = fetch(f"{BINANCE_BASE}/ticker/24hr?symbol={sym}")
                result.append({
                    "symbol": data["symbol"],
                    "price": data["lastPrice"],
                    "change": data["priceChangePercent"],
                    "high": data["highPrice"],
                    "low": data["lowPrice"],
                    "volume": data["quoteVolume"],
                })
            return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps(result)}

        elif action == "klines":
            symbol = params.get("symbol", "BTCUSDT")
            interval = params.get("interval", "1h")
            limit = params.get("limit", "24")
            data = fetch(f"{BINANCE_BASE}/klines?symbol={symbol}&interval={interval}&limit={limit}")
            candles = [{"t": int(c[0]), "o": c[1], "h": c[2], "l": c[3], "c": c[4], "v": c[5]} for c in data]
            return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps(candles)}

        elif action == "orderbook":
            symbol = params.get("symbol", "BTCUSDT")
            limit = params.get("limit", "10")
            data = fetch(f"{BINANCE_BASE}/depth?symbol={symbol}&limit={limit}")
            return {
                "statusCode": 200,
                "headers": CORS_HEADERS,
                "body": json.dumps({"bids": data["bids"][:8], "asks": data["asks"][:8]})
            }

        elif action == "price":
            symbol = params.get("symbol", "BTCUSDT")
            data = fetch(f"{BINANCE_BASE}/ticker/price?symbol={symbol}")
            return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"price": data["price"]})}

        else:
            return {"statusCode": 400, "headers": CORS_HEADERS, "body": json.dumps({"error": "Unknown action"})}

    except urllib.error.HTTPError as e:
        return {"statusCode": 502, "headers": CORS_HEADERS, "body": json.dumps({"error": f"Binance error: {e.code}"})}
    except Exception as e:
        return {"statusCode": 500, "headers": CORS_HEADERS, "body": json.dumps({"error": str(e)})}
