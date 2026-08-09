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

def get_uid_from_session(session_id: str):
    """Возвращает user_id из сессии или None."""
    if not session_id or len(session_id) < 32: return None
    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor()
    cur.execute(f"SELECT user_id FROM {SCHEMA}.sessions WHERE id=%s AND expires_at>NOW()", (session_id,))
    row = cur.fetchone(); cur.close(); conn.close()
    return row[0] if row else None

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

# Кэш тикеров FIGI→{ticker, name} на время жизни функции
_figi_cache: dict = {}

def resolve_figi(figi: str) -> dict:
    """Возвращает {'ticker': ..., 'name': ...} по FIGI через GetInstrumentBy."""
    if not figi:
        return {"ticker": "—", "name": "—"}
    if figi in _figi_cache:
        return _figi_cache[figi]
    try:
        r = tbank_post("tinkoff.public.invest.api.contract.v1.InstrumentsService/GetInstrumentBy", {
            "idType": "INSTRUMENT_ID_TYPE_FIGI",
            "id": figi,
        })
        inst = r.get("instrument", {})
        result = {
            "ticker": inst.get("ticker") or figi[-6:],
            "name":   inst.get("name")   or figi[-6:],
        }
    except Exception:
        result = {"ticker": figi[-6:], "name": figi[-6:]}
    _figi_cache[figi] = result
    return result

def handler(event: dict, context) -> dict:
    """Обёртка — гарантирует JSON+CORS ответ даже если Т-Банк API временно недоступен (SSL/сеть)."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    try:
        return _handler_impl(event, context)
    except requests.exceptions.RequestException as e:
        print(f"[tbank] connection error: {e}")
        return resp({"error": "Т-Банк временно недоступен, попробуйте позже", "tbank_unavailable": True}, 503)
    except Exception as e:
        print(f"[tbank] unexpected error: {e}")
        return resp({"error": "Внутренняя ошибка сервера"}, 500)

def _handler_impl(event: dict, context) -> dict:
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

            # Позиции — резолвим FIGI → тикер параллельно
            raw_positions = portfolio.get("positions", [])
            figi_list = [p.get("figi", "") for p in raw_positions if p.get("figi")]
            # Резолвим все FIGI за один проход (кэш ускоряет повторные вызовы)
            for figi in figi_list:
                resolve_figi(figi)

            positions = []
            for p in raw_positions:
                qty        = money(p.get("quantity"))
                cur_price  = money(p.get("currentPrice"))
                avg_price  = money(p.get("averagePositionPrice")) or money(p.get("averagePositionPricePt"))
                pnl        = money(p.get("expectedYield"))
                figi       = p.get("figi", "")
                inst_info  = resolve_figi(figi)
                cost_basis = avg_price * qty
                pnl_pct    = round(pnl / cost_basis * 100, 2) if cost_basis > 0 else 0
                positions.append({
                    "figi":            figi,
                    "ticker":          inst_info["ticker"],
                    "name":            inst_info["name"],
                    "instrument_type": p.get("instrumentType", "share"),
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
                figi      = o.get("figi") or ""
                inst_info = resolve_figi(figi) if figi else {"ticker": "—", "name": "—"}
                # Форматируем время: ISO → МСК читаемый вид
                date_raw  = o.get("date", "")
                date_msk  = "—"
                if date_raw:
                    try:
                        dt_utc = datetime.fromisoformat(date_raw.replace("Z", "+00:00"))
                        dt_msk = dt_utc + timedelta(hours=3)
                        date_msk = dt_msk.strftime("%d.%m.%Y %H:%M")
                    except Exception:
                        date_msk = date_raw[:16]
                ops.append({
                    "id":       o.get("id"),
                    "type":     o.get("operationType"),
                    "figi":     figi,
                    "ticker":   inst_info["ticker"],
                    "name":     inst_info["name"],
                    "quantity": o.get("quantity"),
                    "price":    money(o.get("price")),
                    "payment":  money(o.get("payment")),
                    "currency": o.get("payment", {}).get("currency", "RUB"),
                    "date":     o.get("date"),
                    "date_msk": date_msk,
                    "status":   o.get("state"),
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

        # ── Сохранить настройки портфельного скальпера ────────────────────────
        if action == "portfolio_scalp_save":
            uid = get_uid_from_session(session_id)
            if not uid: return resp({"error": "Пользователь не найден"}, 404)
            enabled    = bool(body.get("enabled", False))
            target_pct = float(body.get("target_pct", 2.0))
            stop_pct   = float(body.get("stop_pct", 3.0))
            account_id = str(body.get("account_id", ""))
            conn = psycopg2.connect(DB_URL)
            cur  = conn.cursor()
            cur.execute(
                f"INSERT INTO {SCHEMA}.portfolio_scalp_settings (user_id, enabled, target_pct, stop_pct, account_id, updated_at) "
                f"VALUES (%s,%s,%s,%s,%s,NOW()) ON CONFLICT (user_id) DO UPDATE "
                f"SET enabled=%s, target_pct=%s, stop_pct=%s, account_id=%s, updated_at=NOW()",
                (uid, enabled, target_pct, stop_pct, account_id, enabled, target_pct, stop_pct, account_id)
            )
            conn.commit(); cur.close(); conn.close()
            print(f"[portfolio_scalp_save] uid={uid} enabled={enabled} target={target_pct}% stop={stop_pct}% account={account_id}")
            return resp({"ok": True, "enabled": enabled, "target_pct": target_pct, "stop_pct": stop_pct, "account_id": account_id})

        # ── Получить настройки портфельного скальпера ────────────────────────
        if action == "portfolio_scalp_status":
            uid = get_uid_from_session(session_id)
            if not uid: return resp({"error": "Пользователь не найден"}, 404)
            conn = psycopg2.connect(DB_URL)
            cur  = conn.cursor()
            cur.execute(f"SELECT enabled, target_pct, stop_pct, account_id FROM {SCHEMA}.portfolio_scalp_settings WHERE user_id=%s", (uid,))
            s = cur.fetchone(); cur.close(); conn.close()
            # Список счетов для выбора
            acc_data = tbank_post("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {})
            accounts = [{"id": a.get("id"), "name": a.get("name", a.get("id"))} for a in acc_data.get("accounts", []) if a.get("id")]
            if not s:
                return resp({"enabled": False, "target_pct": 2.0, "stop_pct": 3.0, "account_id": accounts[0]["id"] if accounts else "", "accounts": accounts})
            saved_acct = s[3] or (accounts[0]["id"] if accounts else "")
            return resp({"enabled": bool(s[0]), "target_pct": float(s[1]), "stop_pct": float(s[2]), "account_id": saved_acct, "accounts": accounts})

        # ── Цикл авто-продажи по портфелю (вызывается keepalive) ─────────────
        if action == "portfolio_scalp_cycle":
            uid = get_uid_from_session(session_id)
            if not uid: return resp({"error": "Не авторизован"}, 401)

            conn = psycopg2.connect(DB_URL)
            cur  = conn.cursor()
            cur.execute(f"SELECT enabled, target_pct, stop_pct, account_id FROM {SCHEMA}.portfolio_scalp_settings WHERE user_id=%s", (uid,))
            s = cur.fetchone(); cur.close(); conn.close()
            if not s or not s[0]:
                return resp({"ok": True, "skipped": "авто-продажа выключена", "sold": []})

            target_pct = float(s[1])
            stop_pct   = float(s[2])
            saved_acct = s[3] or ""

            # Проверяем торговые часы Мосбиржи: 10:00–18:50 МСК пн-пт
            now_utc = datetime.now(timezone.utc)
            msk_h   = (now_utc.hour + 3) % 24
            msk_min = now_utc.minute
            msk_wd  = (now_utc.weekday() + (1 if now_utc.hour + 3 >= 24 else 0)) % 7  # 0=пн,6=вс
            market_open = (msk_wd < 5) and (
                (msk_h == 10 and msk_min >= 0) or
                (10 < msk_h < 18) or
                (msk_h == 18 and msk_min <= 49)
            )
            if not market_open:
                return resp({"ok": True, "skipped": f"Биржа закрыта (МСК {msk_h:02d}:{msk_min:02d}, торги 10:00–18:50 пн-пт)", "sold": []})

            acc_data  = tbank_post("tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts", {})
            accounts  = acc_data.get("accounts", [])
            if not accounts:
                return resp({"error": f"Счета не найдены: {acc_data}"}, 404)
            if saved_acct and any(a.get("id") == saved_acct for a in accounts):
                account_id = saved_acct
            else:
                account_id = accounts[0].get("id", "")
            print(f"[portfolio_scalp_cycle] uid={uid} account={account_id} target={target_pct}% stop={stop_pct}%")

            # Портфель
            portfolio = tbank_post("tinkoff.public.invest.api.contract.v1.OperationsService/GetPortfolio", {
                "accountId": account_id, "currency": "RUB"
            })
            positions = portfolio.get("positions", [])
            print(f"[portfolio_scalp_cycle] account={account_id} positions={len(positions)}")

            sold = []
            skipped_log = []
            for p in positions:
                inst_type = p.get("instrumentType", "")
                if inst_type == "currency": continue
                qty       = money(p.get("quantity"))
                if qty <= 0: continue
                avg_price = money(p.get("averagePositionPrice")) or money(p.get("averagePositionPricePt"))
                cur_price = money(p.get("currentPrice"))
                pnl       = money(p.get("expectedYield"))
                figi      = p.get("figi", "")
                cost      = avg_price * qty
                pnl_pct   = round(pnl / cost * 100, 2) if cost > 0 else 0
                inst_info = resolve_figi(figi)
                ticker    = inst_info["ticker"]

                print(f"[portfolio_scalp_cycle] {ticker} pnl_pct={pnl_pct}% target={target_pct}% stop={stop_pct}% qty={qty} avg={avg_price} cur={cur_price}")

                reason = None
                if pnl_pct >= target_pct:
                    reason = f"ТЕЙК +{pnl_pct:.2f}% ≥ +{target_pct}%"
                elif pnl_pct <= -stop_pct:
                    reason = f"СТОП {pnl_pct:.2f}% ≤ -{stop_pct}%"
                else:
                    skipped_log.append(f"{ticker}:{pnl_pct:.2f}%")

                if reason:
                    lots  = max(1, int(qty))
                    order = tbank_post("tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder", {
                        "accountId": account_id,
                        "figi":      figi,
                        "direction": "ORDER_DIRECTION_SELL",
                        "quantity":  lots,
                        "orderType": "ORDER_TYPE_MARKET",
                    })
                    print(f"[portfolio_scalp_cycle] SELL {ticker} lots={lots} reason={reason} order={order}")
                    sold.append({
                        "figi":     figi,
                        "ticker":   ticker,
                        "lots":     lots,
                        "pnl_pct":  pnl_pct,
                        "pnl_rub":  round(pnl, 2),
                        "reason":   reason,
                        "order_id": order.get("orderId", ""),
                        "order_status": order.get("executionReportStatus", ""),
                    })

            print(f"[portfolio_scalp_cycle] sold={len(sold)} skipped={skipped_log}")
            return resp({"ok": True, "sold": sold, "checked": len(positions), "skipped": skipped_log})

        return resp({"error": f"Неизвестный action: {action}"}, 400)

    return resp({"error": "Метод не поддерживается"}, 405)