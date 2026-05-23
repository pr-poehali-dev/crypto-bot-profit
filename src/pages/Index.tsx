import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const MARKET_URL = "https://functions.poehali.dev/66dbea62-7575-4dac-8ab1-f42bce82db7b";
const PAYMENT_URL = "https://functions.poehali.dev/373f750f-9364-43a8-8020-4f3f2cda099f";
const TRADE_URL = "https://functions.poehali.dev/5af36d81-ec5d-4557-996a-036e428dad76";
const TBANK_URL = "https://functions.poehali.dev/fb80b07e-125f-40dc-8244-d902c6b0731a";
const AUTOTRADER_URL = "https://functions.poehali.dev/f372165e-74bb-42e7-9a58-5830d08d29fb";

const NAV_ITEMS = [
  { id: "dashboard", icon: "LayoutDashboard", label: "Дашборд" },
  { id: "trading", icon: "TrendingUp", label: "Торговля" },
  { id: "strategies", icon: "Brain", label: "Стратегии" },
  { id: "tbank", icon: "Building2", label: "Т-Банк" },
  { id: "autobot", icon: "Bot", label: "Автобот" },
  { id: "wallet", icon: "Wallet", label: "Кошелёк" },
  { id: "history", icon: "History", label: "История" },
  { id: "portfolio", icon: "PieChart", label: "Портфель" },
  { id: "positions", icon: "Layers", label: "Позиции" },
  { id: "signals", icon: "Radio", label: "Сигналы" },
  { id: "risk", icon: "Shield", label: "Риск-менедж" },
  { id: "alerts", icon: "Bell", label: "Алерты" },
  { id: "api", icon: "Key", label: "API Ключи" },
  { id: "settings", icon: "Settings", label: "Настройки" },
];

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"];
const DISPLAY = { BTCUSDT: "BTC/USDT", ETHUSDT: "ETH/USDT", SOLUSDT: "SOL/USDT", BNBUSDT: "BNB/USDT", XRPUSDT: "XRP/USDT", DOGEUSDT: "DOGE/USDT" } as Record<string, string>;

interface Ticker { symbol: string; price: string; change: string; high: string; low: string; volume: string; }
interface Candle { t: number; o: string; h: string; l: string; c: string; v: string; }
interface OrderBook { bids: string[][]; asks: string[][]; }

const STRATEGIES = [
  { name: "Momentum RSI", type: "rsi", status: true, pairs: 4, winrate: 68, today: 312.4, risk: "medium", desc: "Покупка при RSI<30, продажа при RSI>70", leverage: 5, timeframe: "1h" },
  { name: "Grid Trading", type: "grid", status: true, pairs: 2, winrate: 82, today: 94.7, risk: "low", desc: "Сетка ордеров в заданном диапазоне цены", leverage: 2, timeframe: "—" },
  { name: "MACD Cross", type: "macd", status: false, pairs: 3, winrate: 61, today: 0, risk: "medium", desc: "Сигналы по пересечению MACD и сигнальной линии", leverage: 3, timeframe: "4h" },
  { name: "DCA Bot", type: "dca", status: true, pairs: 6, winrate: 74, today: 58.2, risk: "low", desc: "Усреднение позиции при падении цены", leverage: 1, timeframe: "—" },
  { name: "Bollinger Bands", type: "bollinger", status: false, pairs: 3, winrate: 64, today: 0, risk: "medium", desc: "Отскок от верхней/нижней полосы Боллинджера", leverage: 4, timeframe: "1h" },
  { name: "EMA Cross", type: "ema_cross", status: true, pairs: 2, winrate: 71, today: 89.3, risk: "low", desc: "Пересечение быстрой EMA9 и медленной EMA21", leverage: 3, timeframe: "2h" },
  { name: "Scalping 1m", type: "scalping", status: true, pairs: 5, winrate: 76, today: 423.8, risk: "medium", desc: "Быстрые сделки на 1-минутных свечах EMA+объём", leverage: 10, timeframe: "1m" },
  { name: "Trend ADX+Supertrend", type: "trend", status: true, pairs: 8, winrate: 72, today: 547.1, risk: "low", desc: "ADX>25 подтверждает тренд, Supertrend даёт вход", leverage: 5, timeframe: "4h" },
  { name: "Mean Reversion Z-Score", type: "mean_reversion", status: false, pairs: 5, winrate: 69, today: 0, risk: "low", desc: "Вход при Z-score >2.0 — возврат к среднему SMA20", leverage: 3, timeframe: "1h" },
  { name: "Funding Rate Arb", type: "funding_arb", status: true, pairs: 4, winrate: 94, today: 182.5, risk: "minimal", desc: "Хедж при ставке финансирования >0.1% — почти без риска", leverage: 1, timeframe: "8h" },
];

const MOCK_HISTORY = [
  { id: "T-4821", pair: "BTC/USDT", side: "LONG", open: "19:24:07", close: "21:15:33", pnl: 284.2, pnlPct: 2.8 },
  { id: "T-4820", pair: "ETH/USDT", side: "SHORT", open: "17:05:12", close: "18:44:00", pnl: -56.1, pnlPct: -1.7 },
  { id: "T-4819", pair: "SOL/USDT", side: "LONG", open: "14:32:48", close: "16:10:22", pnl: 127.0, pnlPct: 7.2 },
  { id: "T-4818", pair: "BNB/USDT", side: "LONG", open: "12:18:03", close: "13:55:41", pnl: 43.5, pnlPct: 1.4 },
  { id: "T-4817", pair: "XRP/USDT", side: "SHORT", open: "09:44:17", close: "11:02:55", pnl: -18.9, pnlPct: -0.9 },
];

function fmt(n: string | number, decimals = 2): string {
  const v = parseFloat(String(n));
  if (v >= 10000) return v.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  if (v >= 1) return v.toFixed(decimals);
  return v.toFixed(6);
}

function useInterval(cb: () => void, delay: number) {
  useEffect(() => {
    cb();
    const t = setInterval(cb, delay);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay]);
}

function Spinner() {
  return <div className="w-4 h-4 border border-[var(--cyber-green)] border-t-transparent rounded-full animate-spin" />;
}

/* ===== DASHBOARD ===== */
function DashboardPage({ botRunning, setBotRunning }: { botRunning: boolean; setBotRunning: (v: boolean) => void }) {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTickers = useCallback(async () => {
    try {
      const r = await fetch(`${MARKET_URL}?action=ticker24h&symbols=${SYMBOLS.join(",")}`);
      const data = await r.json();
      setTickers(data);
    } catch { /* skip */ }
    setLoading(false);
  }, []);

  const loadCandles = useCallback(async () => {
    try {
      const r = await fetch(`${MARKET_URL}?action=klines&symbol=BTCUSDT&interval=1h&limit=24`);
      const data = await r.json();
      setCandles(data);
    } catch { /* skip */ }
  }, []);

  useInterval(loadTickers, 15000);
  useInterval(loadCandles, 60000);

  const btc = tickers.find(t => t.symbol === "BTCUSDT");
  const maxClose = candles.length ? Math.max(...candles.map(c => parseFloat(c.c))) : 1;
  const minClose = candles.length ? Math.min(...candles.map(c => parseFloat(c.c))) : 0;
  const range = maxClose - minClose || 1;

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="cyber-card rounded-none p-4 flex flex-wrap items-center justify-between gap-4 animate-fade-in-up">
        <div className="flex items-center gap-4">
          <div className={`status-dot ${botRunning ? "online" : "offline"}`} />
          <span className="font-orbitron text-sm font-semibold" style={{ color: botRunning ? "var(--cyber-green)" : "var(--cyber-red)" }}>
            {botRunning ? "БОТ АКТИВЕН" : "БОТ ОСТАНОВЛЕН"}
          </span>
          <span className="section-label">v2.4.1 · BINANCE FUTURES · <span className="neon-text">LIVE</span></span>
        </div>
        <div className="flex gap-3">
          <button className="cyber-btn-primary rounded-none" onClick={() => setBotRunning(true)} disabled={botRunning}>ЗАПУСТИТЬ</button>
          <button className="cyber-btn-danger rounded-none" onClick={() => setBotRunning(false)} disabled={!botRunning}>СТОП</button>
        </div>
      </div>

      {/* BTC hero */}
      {btc && (
        <div className="cyber-card-glow rounded-none p-5 animate-fade-in-up delay-100">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="section-label mb-1">BITCOIN / USDT · LIVE</div>
              <div className="font-orbitron text-4xl font-black neon-text">${fmt(btc.price, 0)}</div>
            </div>
            <div className="flex gap-6 flex-wrap">
              <div>
                <div className="section-label">24ч изменение</div>
                <div className={`font-orbitron text-xl font-bold ${parseFloat(btc.change) >= 0 ? "neon-text" : "text-[var(--cyber-red)]"}`}>
                  {parseFloat(btc.change) >= 0 ? "+" : ""}{parseFloat(btc.change).toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="section-label">24ч High</div>
                <div className="font-mono text-sm neon-text-cyan">${fmt(btc.high, 0)}</div>
              </div>
              <div>
                <div className="section-label">24ч Low</div>
                <div className="font-mono text-sm text-[var(--cyber-red)]">${fmt(btc.low, 0)}</div>
              </div>
              <div>
                <div className="section-label">Объём (USDT)</div>
                <div className="font-mono text-sm text-[var(--cyber-text)]">${(parseFloat(btc.volume) / 1e9).toFixed(2)}B</div>
              </div>
            </div>
            {loading && <Spinner />}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 cyber-card rounded-none p-4 animate-fade-in-up delay-200">
          <div className="flex items-center justify-between mb-3">
            <div className="section-label">BTC/USDT — 24ч СВЕЧНОЙ ГРАФИК (LIVE)</div>
            {candles.length === 0 && <Spinner />}
          </div>
          <div className="chart-bar" style={{ height: 80 }}>
            {candles.map((c, i) => {
              const closeVal = parseFloat(c.c);
              const h = Math.max(4, Math.round(((closeVal - minClose) / range) * 70 + 10));
              const isUp = parseFloat(c.c) >= parseFloat(c.o);
              return (
                <div
                  key={i}
                  className="chart-bar-item"
                  title={`${new Date(c.t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} | Close: $${fmt(c.c)}`}
                  style={{
                    height: `${h}%`,
                    background: isUp
                      ? `linear-gradient(180deg, var(--cyber-green), rgba(0,255,136,0.3))`
                      : `linear-gradient(180deg, var(--cyber-red), rgba(255,61,113,0.3))`,
                    boxShadow: isUp ? `0 0 4px var(--cyber-green)` : `0 0 4px var(--cyber-red)`
                  }}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            {candles.length > 0 && (
              <>
                <span className="section-label">{new Date(candles[0].t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="section-label">{new Date(candles[Math.floor(candles.length / 2)]?.t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="section-label">{new Date(candles[candles.length - 1]?.t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
              </>
            )}
          </div>
        </div>

        {/* Live tickers */}
        <div className="cyber-card rounded-none p-4 animate-fade-in-up delay-300">
          <div className="flex items-center justify-between mb-3">
            <div className="section-label">РЫНОК · LIVE</div>
            {loading && <Spinner />}
          </div>
          {tickers.length > 0 ? tickers.map((t) => (
            <div key={t.symbol} className="ticker-row">
              <span className="font-mono text-xs text-[var(--cyber-text)]">{DISPLAY[t.symbol] || t.symbol}</span>
              <div className="text-right">
                <div className="font-mono text-xs text-[var(--cyber-text)]">${fmt(t.price)}</div>
                <div className={`font-mono text-xs ${parseFloat(t.change) >= 0 ? "profit" : "loss"}`}>
                  {parseFloat(t.change) >= 0 ? "+" : ""}{parseFloat(t.change).toFixed(2)}%
                </div>
              </div>
            </div>
          )) : (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="ticker-row">
                <div className="h-3 bg-[var(--cyber-border)] rounded animate-pulse w-20" />
                <div className="h-3 bg-[var(--cyber-border)] rounded animate-pulse w-12" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== TRADING ===== */
function TradingPage() {
  const [pair, setPair] = useState("BTCUSDT");
  const [side, setSide] = useState("LONG");
  const [orderType, setOrderType] = useState("MARKET");
  const [leverage, setLeverage] = useState(5);
  const [amount, setAmount] = useState("100");
  const [sl, setSl] = useState("2");
  const [tp, setTp] = useState("5");
  const [currentPrice, setCurrentPrice] = useState<string | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [loadingBook, setLoadingBook] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderResult, setOrderResult] = useState<string | null>(null);

  const loadPrice = useCallback(async () => {
    try {
      const r = await fetch(`${MARKET_URL}?action=price&symbol=${pair}`);
      const d = await r.json();
      setCurrentPrice(d.price);
    } catch { /* skip */ }
  }, [pair]);

  const loadBook = useCallback(async () => {
    setLoadingBook(true);
    try {
      const r = await fetch(`${MARKET_URL}?action=orderbook&symbol=${pair}&limit=8`);
      const d = await r.json();
      setOrderBook(d);
    } catch { /* skip */ }
    setLoadingBook(false);
  }, [pair]);

  useInterval(loadPrice, 3000);
  useEffect(() => { loadBook(); }, [loadBook]);

  async function placeOrder() {
    setOrderLoading(true); setOrderResult(null);
    try {
      const priceNow = parseFloat(currentPrice || "0");
      const slPrice = side === "LONG" ? priceNow * (1 - parseFloat(sl) / 100) : priceNow * (1 + parseFloat(sl) / 100);
      const tpPrice = side === "LONG" ? priceNow * (1 + parseFloat(tp) / 100) : priceNow * (1 - parseFloat(tp) / 100);
      // Для фьючерсов рассчитываем количество контрактов из суммы в USDT
      const quantity = priceNow > 0 ? (parseFloat(amount) / priceNow * leverage).toFixed(3) : "0";
      const r = await fetch(TRADE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "place_futures_order",
          symbol: pair,
          side: side === "LONG" ? "BUY" : "SELL",
          type: orderType,
          quantity,
          leverage,
          sl_price: parseFloat(sl) > 0 ? slPrice.toFixed(2) : undefined,
          tp_price: parseFloat(tp) > 0 ? tpPrice.toFixed(2) : undefined,
        })
      });
      const d = await r.json();
      if (d.connected === false) {
        setOrderResult("✗ Binance не подключён — добавьте API ключи в разделе «API Ключи»");
      } else if (d.success) {
        setOrderResult(`✓ Ордер #${d.order?.orderId} размещён · ${d.order?.status}`);
      } else {
        setOrderResult(`✗ ${d.error || "Ошибка"}`);
      }
    } catch {
      setOrderResult("✗ Ошибка соединения с сервером");
    }
    setOrderLoading(false);
    setTimeout(() => setOrderResult(null), 8000);
  }

  const price = parseFloat(currentPrice || "0");
  const margin = parseFloat(amount) * leverage;
  const tpTarget = margin * parseFloat(tp) / 100;
  const slRisk = margin * parseFloat(sl) / 100;
  const liqPrice = side === "LONG" ? price * (1 - 1 / leverage * 0.9) : price * (1 + 1 / leverage * 0.9);

  const maxAsk = orderBook ? Math.max(...orderBook.asks.map(a => parseFloat(a[1]))) || 1 : 1;
  const maxBid = orderBook ? Math.max(...orderBook.bids.map(b => parseFloat(b[1]))) || 1 : 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="cyber-card-glow rounded-none p-5 animate-fade-in-up space-y-3">
        <div className="section-label mb-1">НОВАЯ СДЕЛКА</div>

        <div>
          <div className="section-label mb-1">Торговая пара</div>
          <select className="cyber-select rounded-none" value={pair} onChange={e => setPair(e.target.value)}>
            {SYMBOLS.map(s => <option key={s} value={s} style={{ background: "#0a1520" }}>{DISPLAY[s]}</option>)}
          </select>
        </div>

        {currentPrice && (
          <div className="font-orbitron text-lg neon-text font-bold">
            ${fmt(currentPrice)} <span className="section-label text-xs">· LIVE</span>
          </div>
        )}

        <div>
          <div className="section-label mb-1">Сторона</div>
          <div className="flex gap-2">
            {["LONG", "SHORT"].map(s => (
              <button key={s} onClick={() => setSide(s)}
                className={`flex-1 py-2 font-mono text-xs rounded-none transition-all ${
                  side === s
                    ? s === "LONG" ? "bg-[rgba(0,255,136,0.2)] border border-[var(--cyber-green)] text-[var(--cyber-green)]"
                    : "bg-[rgba(255,61,113,0.2)] border border-[var(--cyber-red)] text-[var(--cyber-red)]"
                    : "border border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"
                }`}>{s}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="section-label mb-1">Тип ордера</div>
          <div className="flex gap-2">
            {["MARKET", "LIMIT", "STOP"].map(t => (
              <button key={t} onClick={() => setOrderType(t)}
                className={`flex-1 py-2 font-mono text-xs rounded-none transition-all ${
                  orderType === t ? "bg-[rgba(0,212,255,0.15)] border border-[var(--cyber-cyan)] text-[var(--cyber-cyan)]"
                  : "border border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"
                }`}>{t}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="section-label mb-1">Плечо: x{leverage}</div>
          <input type="range" min="1" max="20" value={leverage} onChange={e => setLeverage(+e.target.value)}
            className="w-full accent-[var(--cyber-green)] cursor-pointer" />
          <div className="flex justify-between mt-1">
            {[1, 5, 10, 15, 20].map(l => (
              <span key={l} className={`section-label cursor-pointer hover:text-[var(--cyber-green)] ${leverage === l ? "text-[var(--cyber-green)]" : ""}`}
                onClick={() => setLeverage(l)}>x{l}</span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <div className="section-label mb-1">Объём ($)</div>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="cyber-input rounded-none" />
          </div>
          <div>
            <div className="section-label mb-1">SL (%)</div>
            <input type="number" value={sl} onChange={e => setSl(e.target.value)} className="cyber-input rounded-none" />
          </div>
          <div>
            <div className="section-label mb-1">TP (%)</div>
            <input type="number" value={tp} onChange={e => setTp(e.target.value)} className="cyber-input rounded-none" />
          </div>
        </div>

        <div className="cyber-card rounded-none p-3">
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div><span className="text-[var(--cyber-text-dim)]">Ликвидация:</span> <span className="loss">${fmt(liqPrice)}</span></div>
            <div><span className="text-[var(--cyber-text-dim)]">Маржа:</span> <span className="neon-text-cyan">${margin.toFixed(0)}</span></div>
            <div><span className="text-[var(--cyber-text-dim)]">TP цель:</span> <span className="profit">+${tpTarget.toFixed(1)}</span></div>
            <div><span className="text-[var(--cyber-text-dim)]">SL риск:</span> <span className="loss">-${slRisk.toFixed(1)}</span></div>
          </div>
        </div>

        {orderResult && (
          <div className={`cyber-card rounded-none p-3 border font-mono text-xs ${orderResult.startsWith("✓") ? "border-[var(--cyber-green)] profit" : "border-[var(--cyber-red)] loss"}`}>
            {orderResult}
          </div>
        )}

        <button onClick={placeOrder} disabled={orderLoading || !amount}
          className={`w-full py-3 font-orbitron text-sm font-bold tracking-widest rounded-none transition-all flex items-center justify-center gap-2 disabled:opacity-40 ${
          side === "LONG"
            ? "bg-[rgba(0,255,136,0.15)] border border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.25)] hover:shadow-[0_0_20px_rgba(0,255,136,0.4)]"
            : "bg-[rgba(255,61,113,0.15)] border border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.25)] hover:shadow-[0_0_20px_rgba(255,61,113,0.4)]"
        }`}>
          {orderLoading ? <><Spinner /><span>РАЗМЕЩЕНИЕ...</span></> : `ОТКРЫТЬ ${side} ${DISPLAY[pair]}`}
        </button>
      </div>

      <div className="space-y-4">
        <div className="cyber-card rounded-none p-5 animate-fade-in-up delay-200">
          <div className="flex items-center justify-between mb-4">
            <div className="section-label">ОРДЕРБУК {DISPLAY[pair]} · LIVE</div>
            {loadingBook && <Spinner />}
          </div>
          {orderBook ? (
            <div className="space-y-0.5">
              {(orderBook.asks || []).slice(0, 5).reverse().map(([p, q], i) => (
                <div key={i} className="flex justify-between items-center py-1 px-2 hover:bg-[rgba(255,61,113,0.05)]">
                  <span className="font-mono text-xs loss">{fmt(p)}</span>
                  <div className="cyber-progress flex-1 mx-3" style={{ height: 2 }}>
                    <div className="cyber-progress-bar" style={{ width: `${Math.min(100, parseFloat(q) / maxAsk * 100)}%`, background: "var(--cyber-red)" }} />
                  </div>
                  <span className="font-mono text-xs text-[var(--cyber-text-dim)]">{parseFloat(q).toFixed(4)}</span>
                </div>
              ))}
              {currentPrice && (
                <div className="flex justify-between px-2 py-2 border-y border-[var(--cyber-border)] my-1">
                  <span className="font-orbitron text-sm neon-text font-bold">{fmt(currentPrice)}</span>
                  <span className="section-label">LAST PRICE</span>
                </div>
              )}
              {(orderBook.bids || []).slice(0, 5).map(([p, q], i) => (
                <div key={i} className="flex justify-between items-center py-1 px-2 hover:bg-[rgba(0,255,136,0.05)]">
                  <span className="font-mono text-xs profit">{fmt(p)}</span>
                  <div className="cyber-progress flex-1 mx-3" style={{ height: 2 }}>
                    <div className="cyber-progress-bar" style={{ width: `${Math.min(100, parseFloat(q) / maxBid * 100)}%` }} />
                  </div>
                  <span className="font-mono text-xs text-[var(--cyber-text-dim)]">{parseFloat(q).toFixed(4)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8"><Spinner /></div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== WALLET ===== */
type PayMethod = "bank_card" | "yoomoney" | "crypto_usdt" | "crypto_btc";

interface TxResult { success: boolean; transaction_id?: string; confirmation_url?: string; amount: number; fee: number; net_amount: number; time_estimate: string; method_name: string; message?: string; demo?: boolean; }

function WalletPage() {
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [method, setMethod] = useState<PayMethod>("bank_card");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("RUB");
  const [cardNumber, setCardNumber] = useState("");
  const [yoWallet, setYoWallet] = useState("");
  const [cryptoAddress, setCryptoAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TxResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const depositMethods = [
    { id: "bank_card", icon: "CreditCard", label: "Банк. карта", sub: "Visa/MС/МИР" },
    { id: "yoomoney", icon: "Wallet", label: "ЮMoney", sub: "мгновенно" },
    { id: "crypto_usdt", icon: "CircleDollarSign", label: "USDT TRC-20", sub: "10-30 мин" },
    { id: "crypto_btc", icon: "Bitcoin", label: "Bitcoin", sub: "30-60 мин" },
  ];

  const withdrawMethods = [
    { id: "bank_card", icon: "CreditCard", label: "Банк. карта", sub: "1-3 дня, 1.5%" },
    { id: "yoomoney", icon: "Wallet", label: "ЮMoney", sub: "мгновенно, 0.5%" },
    { id: "crypto_usdt", icon: "CircleDollarSign", label: "USDT TRC-20", sub: "10-30 мин, 1%" },
    { id: "crypto_btc", icon: "Bitcoin", label: "Bitcoin", sub: "30-60 мин, 1%" },
  ];

  const methods = tab === "deposit" ? depositMethods : withdrawMethods;

  async function submit() {
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await fetch(PAYMENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: tab, method, amount: parseFloat(amount), currency })
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Ошибка"); }
      else {
        setResult(d);
        if (d.confirmation_url) window.open(d.confirmation_url, "_blank");
      }
    } catch {
      setError("Ошибка соединения с сервером");
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Balance */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in-up">
        {[
          { label: "RUB баланс", val: "84,320 ₽", color: "green" },
          { label: "USDT баланс", val: "12,450 $", color: "cyan" },
          { label: "BTC баланс", val: "0.1842", color: "yellow" },
        ].map(b => (
          <div key={b.label} className="cyber-card-glow rounded-none p-4">
            <div className="section-label mb-1">{b.label}</div>
            <div className={`font-orbitron text-lg font-bold ${b.color === "green" ? "neon-text" : b.color === "cyan" ? "neon-text-cyan" : "text-[var(--cyber-yellow)]"}`}>{b.val}</div>
          </div>
        ))}
      </div>

      <div className="cyber-card-glow rounded-none p-5 animate-fade-in-up delay-100">
        {/* Tab */}
        <div className="flex gap-2 mb-5">
          {(["deposit", "withdraw"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setResult(null); setError(null); }}
              className={`flex-1 py-2 font-mono text-xs rounded-none transition-all border ${
                tab === t ? "bg-[rgba(0,255,136,0.15)] border-[var(--cyber-green)] text-[var(--cyber-green)]"
                : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"
              }`}>
              {t === "deposit" ? "ПОПОЛНЕНИЕ" : "ВЫВОД"}
            </button>
          ))}
        </div>

        {/* Method */}
        <div className="section-label mb-2">Способ {tab === "deposit" ? "пополнения" : "вывода"}</div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {methods.map(m => (
            <button key={m.id} onClick={() => setMethod(m.id as PayMethod)}
              className={`flex items-center gap-3 p-3 rounded-none border transition-all ${
                method === m.id ? "border-[var(--cyber-green)] bg-[rgba(0,255,136,0.08)]" : "border-[var(--cyber-border)] hover:border-[rgba(0,255,136,0.3)]"
              }`}>
              <Icon name={m.icon} size={18} style={{ color: method === m.id ? "var(--cyber-green)" : "var(--cyber-text-dim)" }} />
              <div className="text-left">
                <div className="font-mono text-xs text-[var(--cyber-text)]">{m.label}</div>
                <div className="section-label" style={{ fontSize: "0.6rem" }}>{m.sub}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Details */}
        {method === "bank_card" && (
          <div className="mb-3">
            <div className="section-label mb-1">{tab === "deposit" ? "Номер карты для списания" : "Номер карты для зачисления"}</div>
            <input value={cardNumber} onChange={e => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
              className="cyber-input rounded-none" placeholder="0000 0000 0000 0000"
              style={{ letterSpacing: "0.15em" }} />
          </div>
        )}
        {method === "yoomoney" && (
          <div className="mb-3">
            <div className="section-label mb-1">Номер кошелька ЮMoney</div>
            <input value={yoWallet} onChange={e => setYoWallet(e.target.value)}
              className="cyber-input rounded-none" placeholder="410011234567890" />
          </div>
        )}
        {(method === "crypto_usdt" || method === "crypto_btc") && tab === "withdraw" && (
          <div className="mb-3">
            <div className="section-label mb-1">Адрес {method === "crypto_usdt" ? "USDT TRC-20" : "Bitcoin"} кошелька</div>
            <input value={cryptoAddress} onChange={e => setCryptoAddress(e.target.value)}
              className="cyber-input rounded-none" placeholder={method === "crypto_usdt" ? "TXxx..." : "bc1q..."} />
          </div>
        )}
        {(method === "crypto_usdt" || method === "crypto_btc") && tab === "deposit" && (
          <div className="mb-3 cyber-card rounded-none p-3">
            <div className="section-label mb-1">Адрес для пополнения {method === "crypto_usdt" ? "USDT TRC-20" : "Bitcoin"}</div>
            <div className="font-mono text-xs neon-text-cyan break-all">
              {method === "crypto_usdt" ? "TJDxxx...DEMO_ADDRESS_SET_IN_SETTINGS" : "bc1qDemo...DEMO_ADDRESS_SET_IN_SETTINGS"}
            </div>
            <div className="section-label mt-2">После пополнения средства поступят автоматически</div>
          </div>
        )}

        {/* Amount + currency */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <div className="section-label mb-1">Сумма</div>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="cyber-input rounded-none" placeholder="0" />
          </div>
          <div className="w-28">
            <div className="section-label mb-1">Валюта</div>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="cyber-select rounded-none">
              <option style={{ background: "#0a1520" }}>RUB</option>
              <option style={{ background: "#0a1520" }}>USD</option>
              <option style={{ background: "#0a1520" }}>USDT</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="cyber-card rounded-none p-3 mb-3 border-[var(--cyber-red)] border text-[var(--cyber-red)] font-mono text-xs">{error}</div>
        )}

        {/* Result */}
        {result && (
          <div className="cyber-card rounded-none p-4 mb-3 border border-[var(--cyber-green)]">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="CheckCircle" size={16} style={{ color: "var(--cyber-green)" }} />
              <span className="font-orbitron text-sm neon-text">
                {result.confirmation_url ? "ПЕРЕХОД К ОПЛАТЕ..." : "ЗАЯВКА СОЗДАНА"}
              </span>
            </div>
            <div className="space-y-1 font-mono text-xs">
              {result.transaction_id && <div><span className="text-[var(--cyber-text-dim)]">ID:</span> <span className="neon-text-cyan">{result.transaction_id}</span></div>}
              <div><span className="text-[var(--cyber-text-dim)]">Метод:</span> <span className="text-[var(--cyber-text)]">{result.method_name}</span></div>
              <div><span className="text-[var(--cyber-text-dim)]">Сумма:</span> <span className="neon-text">+{result.net_amount} {currency}</span></div>
              {result.fee > 0 && <div><span className="text-[var(--cyber-text-dim)]">Комиссия:</span> <span className="loss">{result.fee}</span></div>}
              <div><span className="text-[var(--cyber-text-dim)]">Время:</span> <span className="text-[var(--cyber-yellow)]">{result.time_estimate}</span></div>
            </div>
            {result.demo && (
              <div className="mt-3 section-label text-[var(--cyber-yellow)]" style={{ fontSize: "0.65rem" }}>
                ⚠ Демо-режим. Для реальных платежей подключите ЮKassa: добавьте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY в секреты проекта.
              </div>
            )}
          </div>
        )}

        <button onClick={submit} disabled={loading || !amount}
          className="w-full py-3 font-orbitron text-sm font-bold tracking-widest rounded-none transition-all bg-[rgba(0,255,136,0.15)] border border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.25)] hover:shadow-[0_0_20px_rgba(0,255,136,0.4)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {loading ? <><Spinner /><span>ОБРАБОТКА...</span></> : tab === "deposit" ? "ПОПОЛНИТЬ" : "ВЫВЕСТИ"}
        </button>
      </div>
    </div>
  );
}

/* ===== STRATEGIES ===== */
const RISK_COLORS: Record<string, string> = {
  minimal: "text-[var(--cyber-cyan)] border-[var(--cyber-cyan)]",
  low: "text-[var(--cyber-green)] border-[var(--cyber-green)]",
  medium: "text-[var(--cyber-yellow)] border-[var(--cyber-yellow)]",
  high: "text-[var(--cyber-red)] border-[var(--cyber-red)]",
};
const RISK_LABELS: Record<string, string> = { minimal: "МИН РИСК", low: "НИЗКИЙ", medium: "СРЕДНИЙ", high: "ВЫСОКИЙ" };
const TYPE_ICONS: Record<string, string> = {
  rsi: "Activity", grid: "LayoutGrid", macd: "GitBranch", dca: "TrendingDown",
  bollinger: "Waves", ema_cross: "Shuffle", scalping: "Zap", trend: "TrendingUp",
  mean_reversion: "RefreshCw", funding_arb: "Repeat",
};

function StrategiesPage() {
  const [strategies, setStrategies] = useState(STRATEGIES);
  const [filter, setFilter] = useState<"all" | "active" | "stopped">("all");

  const active = strategies.filter(s => s.status).length;
  const totalToday = strategies.filter(s => s.today > 0).reduce((a, b) => a + b.today, 0);
  const avgWinrate = Math.round(strategies.reduce((a, b) => a + b.winrate, 0) / strategies.length);

  const filtered = strategies.filter(s =>
    filter === "all" ? true : filter === "active" ? s.status : !s.status
  );

  return (
    <div className="space-y-4">
      {/* Сводка */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in-up">
        {[
          { label: "Активных", val: `${active}/${strategies.length}`, color: "neon-text" },
          { label: "Прибыль сегодня", val: `+$${totalToday.toFixed(1)}`, color: "profit" },
          { label: "Ср. винрейт", val: `${avgWinrate}%`, color: "neon-text-cyan" },
        ].map(s => (
          <div key={s.label} className="cyber-card-glow rounded-none p-3 text-center">
            <div className={`font-orbitron text-lg font-bold ${s.color}`}>{s.val}</div>
            <div className="section-label mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Фильтр */}
      <div className="flex gap-2 animate-fade-in-up">
        {(["all", "active", "stopped"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 font-mono text-xs rounded-none border transition-all ${filter === f ? "border-[var(--cyber-green)] text-[var(--cyber-green)] bg-[rgba(0,255,136,0.08)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-green)]"}`}>
            {f === "all" ? "ВСЕ" : f === "active" ? "АКТИВНЫЕ" : "ОСТАНОВЛЕНЫ"}
          </button>
        ))}
      </div>

      {/* Список стратегий */}
      <div className="space-y-3">
        {filtered.map((s, i) => (
          <div key={s.name} className="cyber-card rounded-none p-4 animate-fade-in-up" style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1.5 pt-0.5">
                  <div className={`status-dot ${s.status ? "online" : "offline"}`} />
                  <Icon name={TYPE_ICONS[s.type] || "Bot"} size={14} className="text-[var(--cyber-text-dim)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <div className="font-orbitron text-sm text-[var(--cyber-text)] font-semibold">{s.name}</div>
                    <span className={`px-1.5 py-0.5 font-mono text-[10px] border rounded-none ${RISK_COLORS[s.risk]}`}>
                      {RISK_LABELS[s.risk]}
                    </span>
                    <span className="px-1.5 py-0.5 font-mono text-[10px] border border-[var(--cyber-border)] text-[var(--cyber-text-dim)] rounded-none">
                      {s.timeframe}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--cyber-text-dim)] mb-2 leading-relaxed">{s.desc}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="section-label">{s.pairs} пар</span>
                    <span className="section-label">Плечо x{s.leverage}</span>
                    <span className="section-label">Винрейт <span className="neon-text font-semibold">{s.winrate}%</span></span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="text-right">
                  <div className={`font-mono text-sm font-semibold ${s.today > 0 ? "profit" : "neutral"}`}>
                    {s.today > 0 ? `+$${s.today}` : "—"}
                  </div>
                  <div className="section-label">сегодня</div>
                </div>
                <button
                  onClick={() => setStrategies(prev => prev.map((st, j) => st.name === s.name ? { ...st, status: !st.status } : st))}
                  className={`px-4 py-1.5 font-mono text-xs rounded-none transition-all border ${s.status ? "border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.1)]" : "border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.1)]"}`}>
                  {s.status ? "СТОП" : "СТАРТ"}
                </button>
              </div>
            </div>
            {s.status && (
              <div className="mt-3 pt-3 border-t border-[var(--cyber-border)]">
                <div className="cyber-progress">
                  <div className="cyber-progress-bar" style={{ width: `${s.winrate}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="section-label">Эффективность</span>
                  <span className="font-mono text-xs neon-text">{s.winrate}%</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== TBANK ===== */
const TBANK_INSTRUMENTS = [
  { figi: "BBG004730N88", ticker: "SBER", name: "Сбербанк", type: "Акция", price: 297.4, change: +1.2, currency: "RUB" },
  { figi: "BBG004731354", ticker: "GAZP", name: "Газпром", type: "Акция", price: 128.6, change: -0.8, currency: "RUB" },
  { figi: "BBG004RVFCY3", ticker: "YNDX", name: "Яндекс", type: "Акция", price: 3812.0, change: +2.4, currency: "RUB" },
  { figi: "BBG00Y91R9T3", ticker: "OZON", name: "Ozon Holdings", type: "Акция", price: 3140.0, change: +0.6, currency: "RUB" },
  { figi: "BBG000BVPV84", ticker: "AAPL", name: "Apple Inc.", type: "Акция", price: 188.4, change: +0.3, currency: "USD" },
  { figi: "BBG000BDTBL9", ticker: "MSFT", name: "Microsoft", type: "Акция", price: 378.2, change: +1.1, currency: "USD" },
  { figi: "TCS00A106YF0", ticker: "TMOS", name: "Тинькофф iMOEX ETF", type: "ETF", price: 6.14, change: +0.9, currency: "RUB" },
  { figi: "FUTSI0924000", ticker: "Si-9.24", name: "Фьючерс USD/RUB", type: "Фьючерс", price: 89540, change: -0.2, currency: "RUB" },
];

const TBANK_ORDERS = [
  { id: "TB-1021", ticker: "SBER", type: "Акция", dir: "BUY", lots: 10, price: 295.0, status: "Исполнен", pnl: 234.0 },
  { id: "TB-1020", ticker: "AAPL", type: "Акция", dir: "SELL", lots: 2, price: 190.2, status: "Исполнен", pnl: 112.5 },
  { id: "TB-1019", ticker: "TMOS", type: "ETF", dir: "BUY", lots: 50, price: 6.08, status: "Исполнен", pnl: 30.0 },
  { id: "TB-1018", ticker: "Si-9.24", type: "Фьючерс", dir: "SELL", lots: 1, price: 89800, status: "Исполнен", pnl: -260.0 },
];

interface TBankBalance {
  account_id: string;
  total: number; free: number; invested: number;
  expected_yield: number; profit_total: number;
  profit_today: number; profit_week: number;
  spent_total: number; commission_total: number;
  profit_pct: number; trades_total: number;
  trades_win: number; trades_loss: number;
  positions: { figi: string; instrument_type: string; quantity: number; current_price: number; avg_price: number; pnl: number; pnl_pct: number; currency: string }[];
  daily_chart: { day: string; date: string; pnl: number }[];
}

interface BotTrade { ticker: string; signal: string; lots?: number; price?: number; total?: number; status?: string; rsi?: number; reason?: string; }
interface AutoBotStatusLight { enabled: boolean; mode: string; fixed_amount: number; last_run: string; last_trades: BotTrade[]; daily_pnl: number; }

function TBankPage() {
  const [tab, setTab] = useState<"balance" | "autobot" | "market" | "orders" | "portfolio">("balance");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"share" | "etf" | "futures">("share");
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<TBankBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<AutoBotStatusLight | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch(`${TBANK_URL}?action=accounts`)
      .then(r => r.json())
      .then(d => { setHasToken(Array.isArray(d) && d.length > 0); })
      .catch(() => setHasToken(false));
  }, []);

  useEffect(() => {
    if (tab !== "balance") return;
    setBalanceLoading(true);
    setBalanceError(null);
    fetch(`${TBANK_URL}?action=balance`)
      .then(r => r.json())
      .then(d => { if (d.error) setBalanceError(d.error); else setBalance(d); })
      .catch(() => setBalanceError("Ошибка соединения"))
      .finally(() => setBalanceLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== "autobot") return;
    setBotLoading(true);
    fetch(`${AUTOTRADER_URL}?action=status`)
      .then(r => r.json())
      .then(d => setBotStatus(d))
      .catch(() => {})
      .finally(() => setBotLoading(false));
  }, [tab]);

  const toggleBot = async () => {
    if (!botStatus) return;
    setToggling(true);
    const newEnabled = !botStatus.enabled;
    await fetch(AUTOTRADER_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_settings", mode: botStatus.mode, fixed_amount: botStatus.fixed_amount, stop_pct: 3, enabled: newEnabled }),
    });
    setBotStatus(s => s ? { ...s, enabled: newEnabled } : s);
    setToggling(false);
  };

  const runNow = async () => {
    setToggling(true);
    const r = await fetch(AUTOTRADER_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "run_once" }) });
    const d = await r.json();
    setBotStatus(s => s ? { ...s, last_run: d.run_at || s.last_run, last_trades: d.results || s.last_trades, daily_pnl: d.daily_pnl ?? s.daily_pnl } : s);
    setToggling(false);
  };

  const filtered = TBANK_INSTRUMENTS.filter(i => {
    const matchSearch = search === "" || i.ticker.toLowerCase().includes(search.toLowerCase()) || i.name.toLowerCase().includes(search.toLowerCase());
    const matchKind = kind === "share" ? i.type === "Акция" : kind === "etf" ? i.type === "ETF" : i.type === "Фьючерс";
    return matchSearch && matchKind;
  });

  const totalPnl = TBANK_ORDERS.reduce((a, b) => a + b.pnl, 0);
  const wins = TBANK_ORDERS.filter(o => o.pnl > 0).length;

  const bal = balance;
  const dailyChart = bal?.daily_chart || [];
  const maxDaily = dailyChart.length ? Math.max(...dailyChart.map(d => Math.abs(d.pnl))) || 1 : 1;

  return (
    <div className="space-y-4">

      {/* Шапка */}
      <div className="cyber-card-glow rounded-none p-4 animate-fade-in-up flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-orbitron text-base font-bold text-[var(--cyber-text)] flex items-center gap-2">
            <Icon name="Building2" size={16} className="neon-text-cyan" />
            Т-БАНК INVEST
          </div>
          <div className="section-label mt-0.5">Акции · ETF · Фьючерсы · Фонды</div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-none font-mono text-xs ${hasToken === true ? "border-[var(--cyber-green)] text-[var(--cyber-green)]" : hasToken === false ? "border-[var(--cyber-red)] text-[var(--cyber-red)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${hasToken === true ? "bg-[var(--cyber-green)]" : "bg-[var(--cyber-red)]"}`} />
          {hasToken === true ? "ПОДКЛЮЧЁН" : hasToken === false ? "НЕТ ТОКЕНА" : "ПРОВЕРКА..."}
        </div>
      </div>

      {hasToken === false && (
        <div className="cyber-card rounded-none p-4 border border-[var(--cyber-yellow)] animate-fade-in-up">
          <div className="flex items-start gap-3">
            <Icon name="AlertTriangle" size={16} className="text-[var(--cyber-yellow)] shrink-0 mt-0.5" />
            <div>
              <div className="font-mono text-xs text-[var(--cyber-yellow)] font-semibold mb-1">ТОКЕН НЕ ДОБАВЛЕН — показаны демо-данные</div>
              <div className="text-[11px] text-[var(--cyber-text-dim)] leading-relaxed">
                invest.tbank.ru → Профиль → Настройки → Токен для Open API → вставь в секрет <span className="text-[var(--cyber-cyan)]">TBANK_INVEST_TOKEN</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Вкладки */}
      <div className="flex gap-2 flex-wrap animate-fade-in-up">
        {(["balance", "autobot", "market", "orders", "portfolio"] as const).map(t => (
          <button key={t} onClick={() => setTab(t as typeof tab)}
            className={`px-3 py-1.5 font-mono text-xs rounded-none border transition-all ${tab === t ? "border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] bg-[rgba(0,212,255,0.08)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-cyan)]"}`}>
            {t === "balance" ? "💰 БАЛАНС" : t === "autobot" ? "🤖 АВТОБОТ" : t === "market" ? "РЫНОК" : t === "orders" ? "СДЕЛКИ" : "ПОРТФЕЛЬ"}
          </button>
        ))}
      </div>

      {/* ═══ БАЛАНС ═══ */}
      {tab === "balance" && (
        <div className="space-y-4 animate-fade-in-up">

          {balanceLoading && (
            <div className="flex items-center justify-center gap-3 py-12 cyber-card rounded-none">
              <Spinner />
              <span className="font-mono text-xs text-[var(--cyber-text-dim)]">Загружаю данные счёта...</span>
            </div>
          )}

          {balanceError && !balanceLoading && (
            <div className="cyber-card rounded-none p-4 border border-[var(--cyber-red)]">
              <div className="font-mono text-xs text-[var(--cyber-red)]">Ошибка: {balanceError}</div>
            </div>
          )}

          {bal && !balanceLoading && (
            <>
              {/* Главная карточка */}
              <div className="cyber-card-glow rounded-none p-5 text-center">
                <div className="section-label mb-1">ОБЩИЙ БАЛАНС СЧЁТА · БРОКЕРСКИЙ СЧЁТ 4</div>
                <div className="font-orbitron text-4xl font-black neon-text-cyan mb-1">
                  {bal.total.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽
                </div>
                <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                  <span className={`font-mono text-sm font-semibold ${bal.expected_yield >= 0 ? "profit" : "loss"}`}>
                    {bal.expected_yield >= 0 ? "+" : ""}{bal.expected_yield.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽ нереализованная
                  </span>
                  <span className="section-label">·</span>
                  <span className={`font-mono text-sm font-semibold ${bal.profit_pct >= 0 ? "neon-text" : "loss"}`}>
                    {bal.profit_pct >= 0 ? "+" : ""}{bal.profit_pct}% к вложенным
                  </span>
                </div>
              </div>

              {/* 4 метрики */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Свободно (остаток)", val: `${bal.free.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, sub: "Доступно для новых сделок", icon: "Wallet", color: "neon-text-cyan" },
                  { label: "Вложено в активы", val: `${bal.invested.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, sub: "Акции + ETF + Фьючерсы", icon: "TrendingUp", color: "text-[var(--cyber-yellow)]" },
                  { label: "Потрачено на покупки", val: `${bal.spent_total.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, sub: "За последние 30 дней", icon: "ArrowUpRight", color: "text-[var(--cyber-text-dim)]" },
                  { label: "Комиссии биржи", val: `${bal.commission_total.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, sub: "Итого уплачено комиссий", icon: "Receipt", color: "text-[var(--cyber-red)]" },
                ].map((m, i) => (
                  <div key={m.label} className="cyber-card rounded-none p-4 animate-fade-in-up" style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="section-label text-[10px]">{m.label}</div>
                      <Icon name={m.icon} size={14} className={m.color} />
                    </div>
                    <div className={`font-orbitron text-lg font-bold ${m.color}`}>{m.val}</div>
                    <div className="section-label text-[10px] mt-1">{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Прибыль по периодам */}
              <div className="cyber-card rounded-none p-4">
                <div className="section-label mb-3">РЕАЛИЗОВАННАЯ ПРИБЫЛЬ ПО ПЕРИОДАМ</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Сегодня", val: bal.profit_today },
                    { label: "Неделя", val: bal.profit_week },
                    { label: "30 дней", val: bal.profit_total },
                  ].map(p => (
                    <div key={p.label} className="text-center py-2 border border-[var(--cyber-border)] rounded-none">
                      <div className={`font-orbitron text-base font-bold ${p.val >= 0 ? "neon-text" : "loss"}`}>
                        {p.val >= 0 ? "+" : ""}{p.val.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽
                      </div>
                      <div className="section-label mt-0.5">{p.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Статистика сделок */}
              <div className="cyber-card rounded-none p-4">
                <div className="section-label mb-3">СТАТИСТИКА СДЕЛОК (30 ДНЕЙ)</div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center">
                    <div className="font-orbitron text-xl font-bold neon-text-cyan">{bal.trades_total}</div>
                    <div className="section-label mt-0.5">Всего сделок</div>
                  </div>
                  <div className="text-center">
                    <div className="font-orbitron text-xl font-bold neon-text">{bal.trades_win}</div>
                    <div className="section-label mt-0.5">Прибыльных</div>
                  </div>
                  <div className="text-center">
                    <div className="font-orbitron text-xl font-bold text-[var(--cyber-red)]">{bal.trades_loss}</div>
                    <div className="section-label mt-0.5">Убыточных</div>
                  </div>
                </div>
                <div className="mb-1 flex justify-between">
                  <span className="section-label">Винрейт</span>
                  <span className="font-mono text-xs neon-text font-semibold">
                    {bal.trades_total > 0 ? Math.round(bal.trades_win / bal.trades_total * 100) : 0}%
                  </span>
                </div>
                <div className="cyber-progress">
                  <div className="cyber-progress-bar" style={{ width: `${bal.trades_total > 0 ? Math.round(bal.trades_win / bal.trades_total * 100) : 0}%` }} />
                </div>
              </div>

              {/* График P&L по дням */}
              {dailyChart.length > 0 && (
                <div className="cyber-card rounded-none p-4">
                  <div className="section-label mb-3">ДНЕВНОЙ P&L — ПОСЛЕДНИЕ 7 ДНЕЙ</div>
                  <div className="flex items-end gap-1.5 h-24">
                    {dailyChart.map((d, i) => {
                      const h = maxDaily > 0 ? Math.round(Math.abs(d.pnl) / maxDaily * 100) : 0;
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1 animate-fade-in-up" style={{ animationDelay: `${i * 50}ms`, opacity: 0 }}>
                          <div className="font-mono text-[9px] text-center" style={{ color: d.pnl >= 0 ? "var(--cyber-green)" : "var(--cyber-red)" }}>
                            {d.pnl !== 0 ? `${d.pnl >= 0 ? "+" : ""}${(d.pnl / 1000).toFixed(1)}к` : "—"}
                          </div>
                          <div className="w-full rounded-none transition-all" style={{
                            height: `${Math.max(h * 0.64, 4)}px`,
                            background: d.pnl >= 0
                              ? "linear-gradient(to top, var(--cyber-green), rgba(0,255,136,0.4))"
                              : "linear-gradient(to top, var(--cyber-red), rgba(255,61,113,0.4))",
                            boxShadow: d.pnl >= 0 ? "0 0 6px rgba(0,255,136,0.4)" : "0 0 6px rgba(255,61,113,0.4)",
                            opacity: d.pnl === 0 ? 0.2 : 1,
                          }} />
                          <div className="font-mono text-[8px] text-[var(--cyber-text-dim)] text-center">{d.day}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ АВТОБОТ ═══ */}
      {tab === "autobot" && (
        <div className="space-y-4 animate-fade-in-up">
          {botLoading && <div className="flex items-center justify-center gap-3 py-12 cyber-card rounded-none"><Spinner /><span className="font-mono text-xs text-[var(--cyber-text-dim)]">Загружаю статус бота...</span></div>}

          {botStatus && !botLoading && (<>

            {/* Статус + управление */}
            <div className="cyber-card-glow rounded-none p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-orbitron text-sm font-bold text-[var(--cyber-text)] flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${botStatus.enabled ? "bg-[var(--cyber-green)] animate-pulse" : "bg-[var(--cyber-text-dim)]"}`} />
                  {botStatus.enabled ? "БОТ АКТИВЕН — ТОРГУЕТ" : "БОТ ОСТАНОВЛЕН"}
                </div>
                <div className="section-label mt-1">
                  Режим: <span className="text-[var(--cyber-cyan)]">{botStatus.mode === "10pct" ? "10% от остатка" : botStatus.mode === "25pct" ? "25% от остатка" : botStatus.mode === "50pct" ? "50% от остатка" : `${botStatus.fixed_amount?.toLocaleString("ru-RU")} ₽ фикс`}</span>
                  {" · "}Последний запуск: <span className="text-[var(--cyber-text)]">{botStatus.last_run || "—"}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={runNow} disabled={toggling}
                  className="px-3 py-1.5 font-mono text-xs border border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] hover:bg-[rgba(0,212,255,0.08)] rounded-none transition-all disabled:opacity-40 flex items-center gap-1">
                  {toggling ? <Spinner /> : <Icon name="Play" size={12} />}
                  ЗАПУСТИТЬ ЦИКЛ
                </button>
                <button onClick={toggleBot} disabled={toggling}
                  className={`px-3 py-1.5 font-mono text-xs border rounded-none transition-all disabled:opacity-40 ${botStatus.enabled ? "border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.1)]" : "border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.1)]"}`}>
                  {botStatus.enabled ? "СТОП" : "СТАРТ"}
                </button>
              </div>
            </div>

            {/* Дневной P&L */}
            <div className="grid grid-cols-2 gap-3">
              <div className="cyber-card-glow rounded-none p-4 text-center">
                <div className={`font-orbitron text-2xl font-black ${(botStatus.daily_pnl ?? 0) >= 0 ? "neon-text" : "loss"}`}>
                  {(botStatus.daily_pnl ?? 0) >= 0 ? "+" : ""}{(botStatus.daily_pnl ?? 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽
                </div>
                <div className="section-label mt-1">Доход бота сегодня</div>
              </div>
              <div className="cyber-card-glow rounded-none p-4 text-center">
                <div className="font-orbitron text-2xl font-black neon-text-cyan">
                  {botStatus.last_trades?.filter(t => t.signal === "BUY" || t.signal === "SELL").length ?? 0}
                </div>
                <div className="section-label mt-1">Сделок в последнем цикле</div>
              </div>
            </div>

            {/* Таблица сделок бота */}
            <div className="cyber-card rounded-none p-4">
              <div className="section-label mb-3 flex items-center gap-2">
                <Icon name="Bot" size={12} className="neon-text" />
                СДЕЛКИ АВТОБОТА — ПОСЛЕДНИЙ ЦИКЛ
              </div>
              {!botStatus.last_trades || botStatus.last_trades.length === 0 ? (
                <div className="text-center py-6 text-[var(--cyber-text-dim)] font-mono text-xs">Ещё не было запусков. Нажми «Запустить цикл»</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--cyber-border)]">
                        {["Тикер", "Сигнал", "RSI", "Лотов", "Цена", "Сумма", "Результат"].map(h => (
                          <th key={h} className="section-label text-left py-2 pr-4 text-[10px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {botStatus.last_trades.map((t, i) => (
                        <tr key={i} className="border-b border-[rgba(26,58,74,0.4)] hover:bg-[rgba(0,255,136,0.02)] animate-fade-in-up" style={{ animationDelay: `${i * 40}ms`, opacity: 0 }}>
                          <td className="font-mono text-sm font-bold text-[var(--cyber-text)] py-2.5 pr-4">{t.ticker}</td>
                          <td className="py-2.5 pr-4">
                            <span className={`px-2 py-0.5 font-mono text-[10px] font-bold rounded-none ${t.signal === "BUY" ? "bg-[rgba(0,255,136,0.15)] text-[var(--cyber-green)]" : t.signal === "SELL" ? "bg-[rgba(255,61,113,0.15)] text-[var(--cyber-red)]" : "bg-[rgba(26,58,74,0.5)] text-[var(--cyber-text-dim)]"}`}>
                              {t.signal === "BUY" ? "🟢 КУПИЛ" : t.signal === "SELL" ? "🔴 ПРОДАЛ" : t.signal}
                            </span>
                          </td>
                          <td className="font-mono text-xs text-[var(--cyber-text-dim)] py-2.5 pr-4">{t.rsi ?? "—"}</td>
                          <td className="font-mono text-xs text-[var(--cyber-text)] py-2.5 pr-4">{t.lots ?? "—"}</td>
                          <td className="font-mono text-xs text-[var(--cyber-text)] py-2.5 pr-4">{t.price ? `${t.price.toLocaleString("ru-RU")} ₽` : "—"}</td>
                          <td className="font-mono text-xs py-2.5 pr-4">
                            {t.total ? <span className="text-[var(--cyber-text)]">{t.total.toLocaleString("ru-RU")} ₽</span> : <span className="text-[var(--cyber-text-dim)]">—</span>}
                          </td>
                          <td className="py-2.5 pr-4">
                            {t.reason
                              ? <span className="font-mono text-[10px] text-[var(--cyber-text-dim)]">{t.reason}</span>
                              : t.status
                                ? <span className="font-mono text-[10px] neon-text">✓ {t.status}</span>
                                : <span className="font-mono text-[10px] text-[var(--cyber-text-dim)]">HOLD</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Защита */}
            <div className="cyber-card rounded-none p-3 border border-[rgba(255,61,113,0.15)]">
              <div className="flex items-center gap-2 text-[11px] text-[var(--cyber-text-dim)]">
                <Icon name="Shield" size={13} className="text-[var(--cyber-yellow)] shrink-0" />
                Защита: при убытке <span className="text-[var(--cyber-red)] mx-1">−3%</span> от баланса бот останавливается автоматически
              </div>
            </div>

          </>)}
        </div>
      )}

      {/* ═══ РЫНОК ═══ */}
      {tab === "market" && (
        <div className="space-y-3 animate-fade-in-up">
          <div className="flex gap-2 flex-wrap">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск: SBER, AAPL..."
              className="flex-1 min-w-[140px] bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-xs px-3 py-1.5 rounded-none outline-none focus:border-[var(--cyber-cyan)] placeholder:text-[var(--cyber-text-dim)]"
            />
            {(["share", "etf", "futures"] as const).map(k => (
              <button key={k} onClick={() => setKind(k)}
                className={`px-3 py-1.5 font-mono text-xs rounded-none border transition-all ${kind === k ? "border-[var(--cyber-cyan)] text-[var(--cyber-cyan)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
                {k === "share" ? "АКЦИИ" : k === "etf" ? "ETF/ФОНДЫ" : "ФЬЮЧЕРСЫ"}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filtered.map((inst, i) => (
              <div key={inst.figi} className="cyber-card rounded-none p-3 animate-fade-in-up flex items-center justify-between gap-3" style={{ animationDelay: `${i * 50}ms`, opacity: 0 }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-none bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] flex items-center justify-center font-orbitron text-[10px] font-bold text-[var(--cyber-cyan)]">
                    {inst.ticker.slice(0, 3)}
                  </div>
                  <div>
                    <div className="font-mono text-sm text-[var(--cyber-text)] font-semibold">{inst.ticker}</div>
                    <div className="section-label">{inst.name} · {inst.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-mono text-sm text-[var(--cyber-text)]">{inst.price.toLocaleString("ru-RU")} {inst.currency === "RUB" ? "₽" : "$"}</div>
                    <div className={`font-mono text-xs ${inst.change >= 0 ? "profit" : "loss"}`}>{inst.change >= 0 ? "+" : ""}{inst.change}%</div>
                  </div>
                  <button className="px-3 py-1 font-mono text-xs border border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.1)] rounded-none transition-all">
                    КУПИТЬ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ СДЕЛКИ ═══ */}
      {tab === "orders" && (
        <div className="space-y-3 animate-fade-in-up">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Сделок", val: String(TBANK_ORDERS.length), color: "neon-text-cyan" },
              { label: "P&L итого", val: `${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(0)} ₽`, color: totalPnl >= 0 ? "profit" : "loss" },
              { label: "Прибыльных", val: `${Math.round(wins / TBANK_ORDERS.length * 100)}%`, color: "neon-text" },
            ].map(s => (
              <div key={s.label} className="cyber-card-glow rounded-none p-3 text-center">
                <div className={`font-orbitron text-lg font-bold ${s.color}`}>{s.val}</div>
                <div className="section-label mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="cyber-card rounded-none p-4">
            <div className="section-label mb-3">ИСТОРИЯ СДЕЛОК Т-БАНК</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--cyber-border)]">
                    {["ID", "Тикер", "Тип", "Направление", "Лотов", "Цена", "P&L", "Статус"].map(h => (
                      <th key={h} className="section-label text-left py-2 pr-4 text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TBANK_ORDERS.map((o, i) => (
                    <tr key={o.id} className="border-b border-[rgba(26,58,74,0.4)] hover:bg-[rgba(0,212,255,0.03)] animate-fade-in-up" style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}>
                      <td className="font-mono text-xs text-[var(--cyber-text-dim)] py-2 pr-4">{o.id}</td>
                      <td className="font-mono text-xs text-[var(--cyber-text)] py-2 pr-4 font-semibold">{o.ticker}</td>
                      <td className="font-mono text-xs text-[var(--cyber-text-dim)] py-2 pr-4">{o.type}</td>
                      <td className={`font-mono text-xs py-2 pr-4 font-semibold ${o.dir === "BUY" ? "profit" : "loss"}`}>{o.dir === "BUY" ? "ПОКУПКА" : "ПРОДАЖА"}</td>
                      <td className="font-mono text-xs text-[var(--cyber-text-dim)] py-2 pr-4">{o.lots}</td>
                      <td className="font-mono text-xs text-[var(--cyber-text)] py-2 pr-4">{o.price.toLocaleString("ru-RU")} ₽</td>
                      <td className={`font-mono text-xs py-2 pr-4 font-semibold ${o.pnl >= 0 ? "profit" : "loss"}`}>{o.pnl >= 0 ? "+" : ""}{o.pnl} ₽</td>
                      <td className="font-mono text-xs text-[var(--cyber-green)] py-2 pr-4">{o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ПОРТФЕЛЬ ═══ */}
      {tab === "portfolio" && (
        <div className="space-y-3 animate-fade-in-up">
          {[
            { name: "Сбербанк (SBER)", type: "Акция", qty: 100, price: 297.4, pnl: 234.0, pnlPct: 0.8 },
            { name: "Apple (AAPL)", type: "Акция", qty: 4, price: 188.4, pnl: 112.5, pnlPct: 1.4 },
            { name: "Тинькофф iMOEX ETF", type: "ETF", qty: 500, price: 6.14, pnl: 30.0, pnlPct: 0.9 },
            { name: "Яндекс (YNDX)", type: "Акция", qty: 8, price: 3812.0, pnl: -186.0, pnlPct: -0.6 },
          ].map((p, i) => (
            <div key={p.name} className="cyber-card rounded-none p-4 animate-fade-in-up flex items-center justify-between gap-3" style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}>
              <div>
                <div className="font-mono text-sm text-[var(--cyber-text)] font-semibold">{p.name}</div>
                <div className="section-label">{p.type} · {p.qty} шт. · {p.price.toLocaleString("ru-RU")} ₽</div>
              </div>
              <div className="text-right">
                <div className={`font-mono text-sm font-semibold ${p.pnl >= 0 ? "profit" : "loss"}`}>{p.pnl >= 0 ? "+" : ""}{p.pnl} ₽</div>
                <div className={`font-mono text-xs ${p.pnlPct >= 0 ? "profit" : "loss"}`}>{p.pnlPct >= 0 ? "+" : ""}{p.pnlPct}%</div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

/* ===== AUTOBOT ===== */
interface BotStatus {
  enabled: boolean;
  mode: string;
  fixed_amount: number;
  stop_pct: number;
  last_run: string;
  last_trades: { ticker: string; signal: string; lots?: number; price?: number; total?: number; status?: string; rsi?: number; reason?: string }[];
  daily_pnl: number;
}

function AutoBotPage() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [mode, setMode] = useState("10pct");
  const [fixedAmount, setFixedAmount] = useState("5000");
  const [enabled, setEnabled] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch(`${AUTOTRADER_URL}?action=status`);
      const d: BotStatus = await r.json();
      setStatus(d);
      setMode(d.mode);
      setFixedAmount(String(d.fixed_amount));
      setEnabled(d.enabled);
    } catch { /* skip */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Сохранить только настройки (режим + сумма), не трогать enabled
  const saveSettings = async () => {
    setSaving(true);
    try {
      const r = await fetch(AUTOTRADER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_settings", mode, fixed_amount: parseFloat(fixedAmount) || 5000, stop_pct: 3, enabled }),
      });
      const d = await r.json();
      if (d.success) { setMsg({ text: "✓ Настройки сохранены", ok: true }); loadStatus(); }
      else setMsg({ text: d.error || "Ошибка", ok: false });
    } catch { setMsg({ text: "Ошибка соединения", ok: false }); }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  // Только переключить вкл/выкл бота
  const toggleBot = async () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    try {
      const r = await fetch(AUTOTRADER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_settings", mode, fixed_amount: parseFloat(fixedAmount) || 5000, stop_pct: 3, enabled: newEnabled }),
      });
      const d = await r.json();
      if (d.success) setMsg({ text: newEnabled ? "✓ Бот запущен" : "✓ Бот остановлен", ok: newEnabled });
      else { setEnabled(!newEnabled); setMsg({ text: d.error || "Ошибка", ok: false }); }
    } catch { setEnabled(!newEnabled); setMsg({ text: "Ошибка соединения", ok: false }); }
    setTimeout(() => setMsg(null), 3000);
  };

  const runOnce = async () => {
    setRunning(true);
    setMsg(null);
    try {
      const r = await fetch(AUTOTRADER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_once" }),
      });
      const d = await r.json();
      if (d.stopped) setMsg({ text: `Стоп: ${d.reason}`, ok: false });
      else if (d.success) setMsg({ text: `Цикл завершён · Свободно: ${d.free_cash?.toLocaleString("ru-RU")} ₽ · Сумма сделки: ${d.order_amount?.toLocaleString("ru-RU")} ₽`, ok: true });
      else setMsg({ text: d.error || "Ошибка", ok: false });
      loadStatus();
    } catch { setMsg({ text: "Ошибка соединения", ok: false }); }
    setRunning(false);
  };

  const MODES = [
    { id: "10pct", label: "10% от остатка", desc: "Безопасный режим — до 10 параллельных позиций" },
    { id: "25pct", label: "25% от остатка", desc: "Умеренный — до 4 позиций одновременно" },
    { id: "50pct", label: "50% от остатка", desc: "Агрессивный — максимум 2 крупные позиции" },
    { id: "fixed", label: "Фиксированная сумма", desc: "Задаёшь точную сумму в рублях на сделку" },
  ];

  if (loading) return <div className="flex items-center justify-center p-20"><Spinner /></div>;

  return (
    <div className="space-y-4">

      {/* Шапка со статусом */}
      <div className="cyber-card-glow rounded-none p-4 animate-fade-in-up flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-orbitron text-base font-bold flex items-center gap-2 text-[var(--cyber-text)]">
            <Icon name="Bot" size={16} className="neon-text" />
            АВТОМАТИЧЕСКИЙ ТОРГОВЫЙ БОТ
          </div>
          <div className="section-label mt-0.5">Т-Банк Invest · RSI + EMA стратегии</div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-none font-mono text-xs ${enabled ? "border-[var(--cyber-green)] text-[var(--cyber-green)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-[var(--cyber-green)] animate-pulse" : "bg-[var(--cyber-text-dim)]"}`} />
            {enabled ? "АКТИВЕН" : "ОСТАНОВЛЕН"}
          </div>
          <button
            onClick={toggleBot}
            className={`px-4 py-1.5 font-mono text-xs rounded-none border transition-all ${enabled ? "border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.1)]" : "border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.1)]"}`}>
            {enabled ? "ОСТАНОВИТЬ" : "ЗАПУСТИТЬ"}
          </button>
        </div>
      </div>

      {/* Уведомление */}
      {msg && (
        <div className={`cyber-card rounded-none p-3 border font-mono text-xs animate-fade-in-up ${msg.ok ? "border-[var(--cyber-green)] profit" : "border-[var(--cyber-red)] loss"}`}>
          {msg.text}
        </div>
      )}

      {/* Ключевые метрики */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in-up">
        {[
          { label: "Дневной P&L", val: `${(status?.daily_pnl ?? 0) >= 0 ? "+" : ""}${(status?.daily_pnl ?? 0).toLocaleString("ru-RU")} ₽`, color: (status?.daily_pnl ?? 0) >= 0 ? "neon-text" : "loss" },
          { label: "Последний запуск", val: status?.last_run || "—", color: "neon-text-cyan" },
          { label: "Защита стоп", val: "−3% баланса", color: "text-[var(--cyber-yellow)]" },
        ].map(s => (
          <div key={s.label} className="cyber-card-glow rounded-none p-3 text-center">
            <div className={`font-mono text-sm font-bold ${s.color}`}>{s.val}</div>
            <div className="section-label mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Настройки суммы на сделку */}
      <div className="cyber-card rounded-none p-4 animate-fade-in-up">
        <div className="section-label mb-3">РЕЖИМ ТОРГОВЛИ — СУММА НА ОДНУ СДЕЛКУ</div>
        <div className="grid grid-cols-1 gap-2 mb-3">
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`text-left p-3 border rounded-none transition-all ${mode === m.id ? "border-[var(--cyber-cyan)] bg-[rgba(0,212,255,0.06)]" : "border-[var(--cyber-border)] hover:border-[var(--cyber-cyan)]"}`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full border ${mode === m.id ? "bg-[var(--cyber-cyan)] border-[var(--cyber-cyan)]" : "border-[var(--cyber-text-dim)]"}`} />
                <span className={`font-mono text-xs font-semibold ${mode === m.id ? "neon-text-cyan" : "text-[var(--cyber-text)]"}`}>{m.label}</span>
              </div>
              <div className="section-label text-[10px] mt-1 ml-4">{m.desc}</div>
            </button>
          ))}
        </div>
        {mode === "fixed" && (
          <div className="flex items-center gap-2 mb-3">
            <span className="section-label shrink-0">Сумма ₽:</span>
            <input
              value={fixedAmount}
              onChange={e => setFixedAmount(e.target.value)}
              type="number"
              min="100"
              className="flex-1 bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-1.5 rounded-none outline-none focus:border-[var(--cyber-cyan)]"
            />
          </div>
        )}
        <button onClick={() => saveSettings()}
          disabled={saving}
          className="w-full py-2 font-mono text-xs border border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] hover:bg-[rgba(0,212,255,0.08)] rounded-none transition-all disabled:opacity-40 flex items-center justify-center gap-2">
          {saving ? <><Spinner /><span>СОХРАНЕНИЕ...</span></> : "СОХРАНИТЬ НАСТРОЙКИ"}
        </button>
      </div>

      {/* Ручной запуск */}
      <div className="cyber-card rounded-none p-4 animate-fade-in-up">
        <div className="section-label mb-2">РУЧНОЙ ЗАПУСК ОДНОГО ЦИКЛА</div>
        <div className="text-[11px] text-[var(--cyber-text-dim)] mb-3">Бот проверит сигналы RSI + EMA по всем инструментам и выполнит ордера прямо сейчас</div>
        <button onClick={runOnce} disabled={running}
          className="w-full py-2.5 font-orbitron text-xs font-bold border border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.1)] rounded-none transition-all disabled:opacity-40 flex items-center justify-center gap-2">
          {running ? <><Spinner /><span>ТОРГУЮ...</span></> : "▶ ЗАПУСТИТЬ ЦИКЛ СЕЙЧАС"}
        </button>
      </div>

      {/* Последние сигналы */}
      {status?.last_trades && status.last_trades.length > 0 && (
        <div className="cyber-card rounded-none p-4 animate-fade-in-up">
          <div className="section-label mb-3">ПОСЛЕДНИЕ СИГНАЛЫ</div>
          <div className="space-y-2">
            {status.last_trades.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[rgba(26,58,74,0.4)]">
                <div className="flex items-center gap-3">
                  <div className={`px-2 py-0.5 font-mono text-[10px] font-bold rounded-none ${t.signal === "BUY" ? "bg-[rgba(0,255,136,0.15)] text-[var(--cyber-green)]" : t.signal === "SELL" ? "bg-[rgba(255,61,113,0.15)] text-[var(--cyber-red)]" : "bg-[rgba(26,58,74,0.5)] text-[var(--cyber-text-dim)]"}`}>
                    {t.signal}
                  </div>
                  <span className="font-mono text-sm font-semibold text-[var(--cyber-text)]">{t.ticker}</span>
                  {t.rsi && <span className="section-label">RSI {t.rsi}</span>}
                </div>
                <div className="text-right">
                  {t.total ? <div className="font-mono text-xs text-[var(--cyber-text)]">{t.total.toLocaleString("ru-RU")} ₽ · {t.lots} лот</div> : null}
                  {t.reason ? <div className="section-label text-[10px]">{t.reason}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Защита */}
      <div className="cyber-card rounded-none p-3 border border-[rgba(255,61,113,0.2)] animate-fade-in-up">
        <div className="flex items-start gap-2">
          <Icon name="Shield" size={14} className="text-[var(--cyber-yellow)] shrink-0 mt-0.5" />
          <div className="text-[11px] text-[var(--cyber-text-dim)] leading-relaxed">
            <span className="text-[var(--cyber-yellow)] font-semibold">Защита активна: </span>
            при дневном убытке более <span className="text-[var(--cyber-red)]">3%</span> баланса бот автоматически останавливается и прекращает все сделки до следующего дня.
          </div>
        </div>
      </div>

    </div>
  );
}

/* ===== HISTORY ===== */
function HistoryPage() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up">
        {[
          { label: "Всего сделок", val: "4,821", color: "cyan" },
          { label: "Прибыльных", val: "3,471", color: "green" },
          { label: "Убыточных", val: "1,350", color: "red" },
          { label: "Средний P&L", val: "$18.4", color: "yellow" },
        ].map(s => (
          <div key={s.label} className="cyber-card-glow rounded-none p-4">
            <div className="section-label mb-1">{s.label}</div>
            <div className={`font-orbitron text-xl font-bold ${s.color === "green" ? "neon-text" : s.color === "cyan" ? "neon-text-cyan" : s.color === "red" ? "text-[var(--cyber-red)]" : "text-[var(--cyber-yellow)]"}`}>{s.val}</div>
          </div>
        ))}
      </div>
      <div className="cyber-card rounded-none p-5 animate-fade-in-up delay-200">
        <div className="section-label mb-4">ИСТОРИЯ СДЕЛОК</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--cyber-border)]">
                {["ID", "Пара", "Сторона", "Открытие", "Закрытие", "P&L"].map(h => (
                  <th key={h} className="section-label text-left py-2 pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_HISTORY.map((t, i) => (
                <tr key={t.id} className="border-b border-[rgba(26,58,74,0.4)] hover:bg-[rgba(0,255,136,0.03)] animate-fade-in-up" style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}>
                  <td className="font-mono text-xs text-[var(--cyber-text-dim)] py-3 pr-6">{t.id}</td>
                  <td className="font-mono text-xs text-[var(--cyber-text)] py-3 pr-6">{t.pair}</td>
                  <td className={`font-mono text-xs py-3 pr-6 font-semibold ${t.side === "LONG" ? "profit" : "loss"}`}>{t.side}</td>
                  <td className="font-mono text-xs text-[var(--cyber-text-dim)] py-3 pr-6">{t.open}</td>
                  <td className="font-mono text-xs text-[var(--cyber-text-dim)] py-3 pr-6">{t.close}</td>
                  <td className={`font-mono text-sm py-3 pr-6 font-semibold ${t.pnl >= 0 ? "profit" : "loss"}`}>
                    {t.pnl >= 0 ? "+" : ""}${t.pnl} ({t.pnlPct >= 0 ? "+" : ""}{t.pnlPct}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===== PORTFOLIO ===== */
function PortfolioPage() {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  useEffect(() => {
    fetch(`${MARKET_URL}?action=ticker24h&symbols=BTCUSDT,ETHUSDT,SOLUSDT`).then(r => r.json()).then(setTickers).catch(() => {});
  }, []);

  const btcPrice = parseFloat(tickers.find(t => t.symbol === "BTCUSDT")?.price || "0");
  const ethPrice = parseFloat(tickers.find(t => t.symbol === "ETHUSDT")?.price || "0");
  const solPrice = parseFloat(tickers.find(t => t.symbol === "SOLUSDT")?.price || "0");

  const btcVal = (0.1842 * btcPrice).toFixed(0);
  const ethVal = (2.45 * ethPrice).toFixed(0);
  const solVal = (12 * solPrice).toFixed(0);
  const total = parseInt(btcVal || "0") + parseInt(ethVal || "0") + parseInt(solVal || "0") + 1494;

  const assets = [
    { coin: "BTC", qty: "0.1842", val: btcVal || "—", pct: total ? Math.round(parseInt(btcVal || "0") / total * 100) : 0, color: "var(--cyber-yellow)" },
    { coin: "ETH", qty: "2.45", val: ethVal || "—", pct: total ? Math.round(parseInt(ethVal || "0") / total * 100) : 0, color: "var(--cyber-cyan)" },
    { coin: "SOL", qty: "12", val: solVal || "—", pct: total ? Math.round(parseInt(solVal || "0") / total * 100) : 0, color: "var(--cyber-green)" },
    { coin: "USDT", qty: "1494", val: "1,494", pct: total ? Math.round(1494 / total * 100) : 0, color: "var(--cyber-text-dim)" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="cyber-card-glow rounded-none p-5 animate-fade-in-up">
          <div className="section-label mb-4">ПОРТФЕЛЬ · LIVE ЦЕНЫ</div>
          <div className="space-y-3">
            {assets.map(a => (
              <div key={a.coin}>
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-xs text-[var(--cyber-text)]">{a.coin} <span className="text-[var(--cyber-text-dim)]">({a.qty})</span></span>
                  <div className="flex gap-3">
                    <span className="font-mono text-xs" style={{ color: a.color }}>{a.pct}%</span>
                    <span className="font-mono text-xs text-[var(--cyber-text-dim)]">${a.val}</span>
                  </div>
                </div>
                <div className="cyber-progress">
                  <div className="cyber-progress-bar" style={{ width: `${a.pct}%`, background: a.color, boxShadow: `0 0 8px ${a.color}` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--cyber-border)] flex justify-between">
            <span className="section-label">ИТОГО</span>
            <span className="font-orbitron text-sm neon-text font-bold">${total.toLocaleString()}</span>
          </div>
        </div>
        <div className="cyber-card rounded-none p-5 animate-fade-in-up delay-200">
          <div className="section-label mb-4">СТАТИСТИКА</div>
          <div className="space-y-3">
            {[
              { label: "Sharpe Ratio", val: "2.14", good: true },
              { label: "Max Drawdown", val: "-8.4%", good: false },
              { label: "ROI (30д)", val: "+18.4%", good: true },
              { label: "Volatility", val: "12.7%", good: null },
              { label: "Best day", val: "+$842", good: true },
              { label: "Worst day", val: "-$214", good: false },
            ].map(s => (
              <div key={s.label} className="flex justify-between border-b border-[rgba(26,58,74,0.4)] pb-2">
                <span className="font-mono text-xs text-[var(--cyber-text-dim)]">{s.label}</span>
                <span className={`font-mono text-xs font-semibold ${s.good === true ? "profit" : s.good === false ? "loss" : "neon-text-cyan"}`}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== API KEYS PAGE ===== */
interface ApiStatus {
  connected: boolean;
  can_trade?: boolean;
  maker_commission?: number;
  taker_commission?: number;
  balances?: { asset: string; free: string; locked: string }[];
  account_type?: string;
  message?: string;
}

function ApiKeysPage() {
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const checkStatus = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const r = await fetch(`${TRADE_URL}?action=status`);
      const d = await r.json();
      setStatus(d);
    } catch {
      setStatus({ connected: false, message: "Ошибка соединения с сервером" });
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  if (loading) return <div className="flex items-center justify-center p-20"><Spinner /></div>;

  return (
    <div className="max-w-2xl space-y-4">
      {/* Connection status card */}
      <div className={`cyber-card-glow rounded-none p-5 animate-fade-in-up border ${status?.connected ? "border-[var(--cyber-green)]" : "border-[var(--cyber-border)]"}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`status-dot ${status?.connected ? "online" : "offline"}`} />
            <div>
              <div className="font-orbitron text-base font-bold" style={{ color: status?.connected ? "var(--cyber-green)" : "var(--cyber-red)" }}>
                {status?.connected ? "BINANCE ПОДКЛЮЧЁН" : "КЛЮЧИ НЕ НАСТРОЕНЫ"}
              </div>
              {status?.connected && <div className="section-label">Аккаунт: {status.account_type} · Торговля: {status.can_trade ? "✓" : "✗"}</div>}
            </div>
          </div>
          <button onClick={() => checkStatus(true)} disabled={refreshing}
            className="cyber-btn rounded-none p-2">
            {refreshing ? <Spinner /> : <Icon name="RefreshCw" size={14} />}
          </button>
        </div>

        {!status?.connected && (
          <div className="space-y-4">
            <div className="cyber-card rounded-none p-4 border border-[var(--cyber-yellow)]">
              <div className="font-orbitron text-xs text-[var(--cyber-yellow)] mb-3">КАК ПОЛУЧИТЬ API КЛЮЧИ</div>
              <ol className="space-y-2">
                {[
                  "Войдите в Binance → перейдите в Профиль → Управление API",
                  "Нажмите «Создать API» → выберите «Сгенерированный системой»",
                  "Введите название (например: КиберБот) и пройдите 2FA",
                  "В разрешениях включите: Чтение + Торговля спотом/фьючерсами",
                  "НЕ включайте «Разрешить вывод» — это безопаснее",
                  "Скопируйте API Key и Secret Key",
                  "Вставьте их в секреты проекта: BINANCE_API_KEY и BINANCE_SECRET_KEY",
                ].map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-orbitron text-xs neon-text flex-shrink-0">{i + 1}.</span>
                    <span className="font-mono text-xs text-[var(--cyber-text-dim)]">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <a href="https://www.binance.com/ru/my/settings/api-management" target="_blank" rel="noopener noreferrer"
              className="cyber-btn-primary rounded-none flex items-center justify-center gap-2 py-3 no-underline">
              <Icon name="ExternalLink" size={14} />
              ОТКРЫТЬ BINANCE API MANAGEMENT
            </a>
          </div>
        )}

        {status?.connected && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Тип аккаунта", val: status.account_type || "—" },
                { label: "Торговля", val: status.can_trade ? "Активна" : "Заблокирована", ok: status.can_trade },
                { label: "Комиссия мейкер", val: `${(status.maker_commission || 0) / 100}%` },
                { label: "Комиссия тейкер", val: `${(status.taker_commission || 0) / 100}%` },
              ].map(item => (
                <div key={item.label} className="cyber-card rounded-none p-3">
                  <div className="section-label mb-1">{item.label}</div>
                  <div className={`font-mono text-sm ${item.ok === false ? "loss" : item.ok === true ? "profit" : "neon-text-cyan"}`}>{item.val}</div>
                </div>
              ))}
            </div>

            {status.balances && status.balances.length > 0 && (
              <div className="cyber-card rounded-none p-4">
                <div className="section-label mb-3">РЕАЛЬНЫЙ БАЛАНС BINANCE</div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {status.balances.map(b => (
                    <div key={b.asset} className="flex justify-between py-1 border-b border-[rgba(26,58,74,0.3)]">
                      <span className="font-mono text-xs text-[var(--cyber-text)]">{b.asset}</span>
                      <div className="flex gap-4">
                        <span className="font-mono text-xs neon-text">{parseFloat(b.free).toFixed(6)}</span>
                        {parseFloat(b.locked) > 0 && (
                          <span className="font-mono text-xs text-[var(--cyber-yellow)]">🔒 {parseFloat(b.locked).toFixed(6)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="cyber-card rounded-none p-3 border border-[rgba(0,255,136,0.2)]">
              <div className="font-mono text-xs text-[var(--cyber-text-dim)]">
                ✓ Ключи хранятся в зашифрованных секретах сервера. Фронтенд их никогда не видит.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== LIVE POSITIONS PAGE ===== */
function LivePositionsPage() {
  const [positions, setPositions] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${TRADE_URL}?action=futures_positions`);
      const d = await r.json();
      if (d.connected === false) { setNotConnected(true); }
      else { setPositions(d.positions || []); }
    } catch { /* skip */ }
    setLoading(false);
  }, []);

  useInterval(load, 10000);

  async function closePosition(symbol: string, qty: string, side: string) {
    const closeSide = parseFloat(qty) > 0 ? "SELL" : "BUY";
    setClosing(symbol);
    try {
      const r = await fetch(TRADE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close_position", symbol, quantity: Math.abs(parseFloat(qty)).toString(), side: closeSide })
      });
      const d = await r.json();
      if (d.success) { setMsg(`✓ Позиция ${symbol} закрыта`); load(); }
      else { setMsg(`✗ ${d.error}`); }
    } catch { setMsg("✗ Ошибка соединения"); }
    setClosing(null);
    setTimeout(() => setMsg(null), 4000);
  }

  if (loading) return <div className="flex items-center justify-center p-20"><Spinner /></div>;

  if (notConnected) return (
    <div className="cyber-card-glow rounded-none p-8 text-center animate-fade-in-up">
      <Icon name="Key" size={40} className="mx-auto mb-3" style={{ color: "var(--cyber-yellow)" }} />
      <div className="font-orbitron text-base text-[var(--cyber-yellow)] mb-2">BINANCE НЕ ПОДКЛЮЧЁН</div>
      <div className="section-label">Добавьте BINANCE_API_KEY и BINANCE_SECRET_KEY в секреты, затем откройте раздел «API Ключи»</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`cyber-card rounded-none p-3 border font-mono text-xs ${msg.startsWith("✓") ? "border-[var(--cyber-green)] profit" : "border-[var(--cyber-red)] loss"}`}>{msg}</div>
      )}
      <div className="cyber-card-glow rounded-none p-5 animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <div className="section-label">ФЬЮЧЕРСНЫЕ ПОЗИЦИИ · LIVE BINANCE</div>
          <div className="flex items-center gap-2"><div className="status-dot online" /><span className="section-label">AUTO-REFRESH 10с</span></div>
        </div>
        {positions.length === 0 ? (
          <div className="text-center py-8">
            <div className="font-orbitron text-sm text-[var(--cyber-text-dim)]">НЕТ ОТКРЫТЫХ ПОЗИЦИЙ</div>
            <div className="section-label mt-2">Откройте позицию в разделе «Торговля»</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--cyber-border)]">
                  {["Пара", "Размер", "Вход", "Текущая", "P&L", "ROE%", ""].map(h => (
                    <th key={h} className="section-label text-left py-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map(p => {
                  const qty = parseFloat(p.positionAmt || "0");
                  const pnl = parseFloat(p.unRealizedProfit || "0");
                  const roe = parseFloat(p.roe || "0") * 100;
                  return (
                    <tr key={p.symbol} className="border-b border-[rgba(26,58,74,0.4)] hover:bg-[rgba(0,255,136,0.03)]">
                      <td className="font-mono text-sm text-[var(--cyber-text)] py-3 pr-4">{p.symbol}</td>
                      <td className={`font-mono text-xs py-3 pr-4 font-semibold ${qty > 0 ? "profit" : "loss"}`}>{qty > 0 ? "LONG" : "SHORT"} {Math.abs(qty)}</td>
                      <td className="font-mono text-xs text-[var(--cyber-text-dim)] py-3 pr-4">${fmt(p.entryPrice || "0")}</td>
                      <td className="font-mono text-xs text-[var(--cyber-text)] py-3 pr-4">${fmt(p.markPrice || "0")}</td>
                      <td className={`font-mono text-sm py-3 pr-4 font-semibold ${pnl >= 0 ? "profit" : "loss"}`}>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</td>
                      <td className={`font-mono text-xs py-3 pr-4 ${roe >= 0 ? "profit" : "loss"}`}>{roe >= 0 ? "+" : ""}{roe.toFixed(2)}%</td>
                      <td className="py-3">
                        <button onClick={() => closePosition(p.symbol, p.positionAmt || "0", "")}
                          disabled={closing === p.symbol}
                          className="cyber-btn-danger rounded-none text-xs px-3 py-1 flex items-center gap-1">
                          {closing === p.symbol ? <Spinner /> : "Закрыть"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== GENERIC ===== */
function GenericPage({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="cyber-card-glow rounded-none p-8 animate-fade-in-up text-center">
      <Icon name={icon} size={48} className="mx-auto mb-4" style={{ color: "var(--cyber-green)", filter: "drop-shadow(0 0 10px var(--cyber-green))" }} />
      <div className="font-orbitron text-xl neon-text mb-2">{title}</div>
      <div className="section-label">Раздел в разработке · Напишите, что здесь должно быть</div>
    </div>
  );
}

/* ===== ROOT ===== */
export default function Index() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [botRunning, setBotRunning] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard": return <DashboardPage botRunning={botRunning} setBotRunning={setBotRunning} />;
      case "trading": return <TradingPage />;
      case "strategies": return <StrategiesPage />;
      case "tbank": return <TBankPage />;
      case "autobot": return <AutoBotPage />;
      case "wallet": return <WalletPage />;
      case "history": return <HistoryPage />;
      case "portfolio": return <PortfolioPage />;
      case "positions": return <LivePositionsPage />;
      case "api": return <ApiKeysPage />;
      case "signals": return <GenericPage title="ТОРГОВЫЕ СИГНАЛЫ" icon="Radio" />;
      case "risk": return <GenericPage title="РИСК-МЕНЕДЖМЕНТ" icon="Shield" />;
      case "alerts": return <GenericPage title="АЛЕРТЫ И УВЕДОМЛЕНИЯ" icon="Bell" />;
      case "settings": return <GenericPage title="НАСТРОЙКИ" icon="Settings" />;
      default: return null;
    }
  };

  const activeNav = NAV_ITEMS.find(n => n.id === activeSection);

  return (
    <div className="cyber-bg min-h-screen flex" style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: "var(--cyber-text)" }}>
      <aside className={`${sidebarOpen ? "w-56" : "w-14"} flex-shrink-0 transition-all duration-300 relative`}
        style={{ background: "var(--cyber-surface)", borderRight: "1px solid var(--cyber-border)" }}>
        <div className="p-4 border-b border-[var(--cyber-border)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0"
              style={{ border: "1px solid var(--cyber-green)", boxShadow: "0 0 10px rgba(0,255,136,0.3)" }}>
              <Icon name="Bot" size={16} style={{ color: "var(--cyber-green)" }} />
            </div>
            {sidebarOpen && (
              <div>
                <div className="font-orbitron text-sm font-bold neon-text">КИБЕРБОТ</div>
                <div className="section-label" style={{ fontSize: "0.55rem" }}>CRYPTO TRADER</div>
              </div>
            )}
          </div>
        </div>
        <nav className="py-3">
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveSection(item.id)}
              className={`nav-item w-full text-left ${activeSection === item.id ? "active" : ""}`}
              title={!sidebarOpen ? item.label : undefined}>
              <Icon name={item.icon} size={16} fallback="Circle" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        {sidebarOpen && (
          <div className="absolute bottom-4 left-0 right-0 px-4">
            <div className="cyber-card rounded-none p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className={`status-dot ${botRunning ? "online" : "offline"}`} />
                <span className="font-mono text-xs" style={{ color: botRunning ? "var(--cyber-green)" : "var(--cyber-red)" }}>
                  {botRunning ? "АКТИВЕН" : "СТОП"}
                </span>
              </div>
              <div className="section-label" style={{ fontSize: "0.6rem" }}>{time.toLocaleTimeString("ru-RU")} МСК</div>
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-5 py-3 border-b"
          style={{ background: "var(--cyber-surface)", borderColor: "var(--cyber-border)" }}>
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="cyber-btn p-1.5 rounded-none">
              <Icon name="Menu" size={16} />
            </button>
            <div className="font-orbitron text-sm font-semibold text-[var(--cyber-text)]">
              {activeNav?.label?.toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2">
              <div className="status-dot online" />
              <span className="font-mono text-xs text-[var(--cyber-green)]">BINANCE LIVE</span>
            </div>
            <div className="hidden md:block font-mono text-xs text-[var(--cyber-text-dim)]">
              {time.toLocaleTimeString("ru-RU")}
            </div>
            <button onClick={() => setActiveSection("wallet")}
              className="flex items-center gap-1 px-2 py-1 transition-all hover:border-[var(--cyber-green)]"
              style={{ border: "1px solid var(--cyber-border)" }}>
              <Icon name="Wallet" size={14} style={{ color: "var(--cyber-cyan)" }} />
              <span className="font-mono text-xs neon-text-cyan">$12,450</span>
            </button>
            <button className="cyber-btn p-1.5 rounded-none">
              <Icon name="Bell" size={14} />
            </button>
          </div>
        </header>
        <main className="flex-1 p-5 overflow-auto">{renderContent()}</main>
      </div>
    </div>
  );
}