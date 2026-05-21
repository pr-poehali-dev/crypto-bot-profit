"""
Эндпоинт для пополнения и вывода средств.
Поддерживает методы: bank_card (банковская карта), yoomoney (ЮMoney), crypto (крипто-перевод).
Для реальных платежей требуется подключить ЮKassa (yookassa.ru) — добавьте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY в секреты.
"""
import json
import os
import uuid
import time

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
    "Content-Type": "application/json"
}

PAYMENT_METHODS = {
    "bank_card": {"name": "Банковская карта", "min": 100, "max": 500000, "fee_pct": 0, "time": "мгновенно"},
    "yoomoney": {"name": "ЮMoney", "min": 10, "max": 100000, "fee_pct": 0, "time": "мгновенно"},
    "crypto_usdt": {"name": "USDT (TRC-20)", "min": 10, "max": 1000000, "fee_pct": 0, "time": "10-30 мин"},
    "crypto_btc": {"name": "Bitcoin", "min": 10, "max": 1000000, "fee_pct": 0, "time": "30-60 мин"},
}

WITHDRAW_METHODS = {
    "bank_card": {"name": "Банковская карта", "min": 500, "max": 200000, "fee_pct": 1.5, "time": "1-3 дня"},
    "yoomoney": {"name": "ЮMoney", "min": 10, "max": 75000, "fee_pct": 0.5, "time": "мгновенно"},
    "crypto_usdt": {"name": "USDT (TRC-20)", "min": 20, "max": 1000000, "fee_pct": 1.0, "time": "10-30 мин"},
    "crypto_btc": {"name": "Bitcoin", "min": 50, "max": 1000000, "fee_pct": 1.0, "time": "30-60 мин"},
}

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    method = event.get("httpMethod", "GET")

    if method == "GET":
        params = event.get("queryStringParameters") or {}
        action = params.get("action", "methods")

        if action == "methods":
            return {
                "statusCode": 200,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "deposit": PAYMENT_METHODS,
                    "withdraw": WITHDRAW_METHODS,
                    "yookassa_connected": bool(os.environ.get("YOOKASSA_SECRET_KEY")),
                })
            }
        return {"statusCode": 400, "headers": CORS_HEADERS, "body": json.dumps({"error": "Unknown action"})}

    if method == "POST":
        try:
            body = json.loads(event.get("body") or "{}")
        except Exception:
            return {"statusCode": 400, "headers": CORS_HEADERS, "body": json.dumps({"error": "Invalid JSON"})}

        op_type = body.get("type")
        pay_method = body.get("method")
        amount = float(body.get("amount", 0))
        currency = body.get("currency", "RUB")

        if op_type not in ("deposit", "withdraw"):
            return {"statusCode": 400, "headers": CORS_HEADERS, "body": json.dumps({"error": "type must be deposit or withdraw"})}

        methods_map = PAYMENT_METHODS if op_type == "deposit" else WITHDRAW_METHODS
        if pay_method not in methods_map:
            return {"statusCode": 400, "headers": CORS_HEADERS, "body": json.dumps({"error": f"Unknown method: {pay_method}"})}

        meta = methods_map[pay_method]
        if amount < meta["min"] or amount > meta["max"]:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": f"Сумма должна быть от {meta['min']} до {meta['max']} {currency}"})
            }

        yookassa_key = os.environ.get("YOOKASSA_SECRET_KEY")
        yookassa_shop = os.environ.get("YOOKASSA_SHOP_ID")

        if yookassa_key and yookassa_shop and op_type == "deposit" and pay_method in ("bank_card", "yoomoney"):
            import urllib.request
            import base64
            pay_method_yk = "bank_card" if pay_method == "bank_card" else "yoo_money"
            idempotence = str(uuid.uuid4())
            payload = json.dumps({
                "amount": {"value": f"{amount:.2f}", "currency": currency},
                "payment_method_data": {"type": pay_method_yk},
                "confirmation": {"type": "redirect", "return_url": "https://poehali.dev"},
                "capture": True,
                "description": f"Пополнение КиберБот #{idempotence[:8]}"
            }).encode()
            creds = base64.b64encode(f"{yookassa_shop}:{yookassa_key}".encode()).decode()
            req = urllib.request.Request(
                "https://api.yookassa.ru/v3/payments",
                data=payload,
                headers={
                    "Authorization": f"Basic {creds}",
                    "Content-Type": "application/json",
                    "Idempotence-Key": idempotence
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=15) as r:
                yk_resp = json.loads(r.read().decode())
            return {
                "statusCode": 200,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "success": True,
                    "payment_id": yk_resp["id"],
                    "status": yk_resp["status"],
                    "confirmation_url": yk_resp.get("confirmation", {}).get("confirmation_url"),
                    "amount": amount,
                    "currency": currency,
                    "method": pay_method,
                })
            }
        else:
            fee = round(amount * meta["fee_pct"] / 100, 2)
            return {
                "statusCode": 200,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "success": True,
                    "demo": True,
                    "transaction_id": f"TX-{uuid.uuid4().hex[:10].upper()}",
                    "type": op_type,
                    "method": pay_method,
                    "method_name": meta["name"],
                    "amount": amount,
                    "fee": fee,
                    "net_amount": round(amount - fee, 2),
                    "currency": currency,
                    "time_estimate": meta["time"],
                    "status": "pending",
                    "message": "Для реальных платежей подключите ЮKassa: добавьте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY в секреты проекта.",
                    "created_at": int(time.time())
                })
            }
