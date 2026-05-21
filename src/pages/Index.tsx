import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const MARKET_URL = "https://functions.poehali.dev/66dbea62-7575-4dac-8ab1-f42bce82db7b";
const PAYMENT_URL = "https://functions.poehali.dev/373f750f-9364-43a8-8020-4f3f2cda099f";

const NAV_ITEMS = [
  { id: "dashboard", icon: "LayoutDashboard", label: "Дашборд" },
  { id: "trading", icon: "TrendingUp", label: "Торговля" },
  { id: "strategies", icon: "Brain", label: "Стратегии" },
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
  { name: "Momentum RSI", status: true, pairs: 4, winrate: 68, today: 312.4 },
  { name: "Grid Trading", status: true, pairs: 2, winrate: 82, today: 94.7 },
  { name: "MACD Cross", status: false, pairs: 3, winrate: 61, today: 0 },
  { name: "DCA Bot", status: true, pairs: 6, winrate: 74, today: 58.2 },
  { name: "Scalper X3", status: false, pairs: 1, winrate: 71, today: 0 },
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

        <button className={`w-full py-3 font-orbitron text-sm font-bold tracking-widest rounded-none transition-all ${
          side === "LONG"
            ? "bg-[rgba(0,255,136,0.15)] border border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.25)] hover:shadow-[0_0_20px_rgba(0,255,136,0.4)]"
            : "bg-[rgba(255,61,113,0.15)] border border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.25)] hover:shadow-[0_0_20px_rgba(255,61,113,0.4)]"
        }`}>
          ОТКРЫТЬ {side} {DISPLAY[pair]}
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
function StrategiesPage() {
  const [strategies, setStrategies] = useState(STRATEGIES);
  return (
    <div className="space-y-4">
      <div className="cyber-card-glow rounded-none p-5 animate-fade-in-up">
        <div className="section-label mb-4">АВТОМАТИЧЕСКИЕ СТРАТЕГИИ</div>
        <div className="space-y-3">
          {strategies.map((s, i) => (
            <div key={s.name} className="cyber-card rounded-none p-4 animate-fade-in-up" style={{ animationDelay: `${i * 80}ms`, opacity: 0 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`status-dot ${s.status ? "online" : "offline"}`} />
                  <div>
                    <div className="font-orbitron text-sm text-[var(--cyber-text)] font-semibold">{s.name}</div>
                    <div className="section-label">{s.pairs} пар · Винрейт {s.winrate}%</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`font-mono text-sm font-semibold ${s.today > 0 ? "profit" : "neutral"}`}>{s.today > 0 ? `+$${s.today}` : "—"}</div>
                    <div className="section-label">сегодня</div>
                  </div>
                  <button
                    onClick={() => setStrategies(prev => prev.map((st, j) => j === i ? { ...st, status: !st.status } : st))}
                    className={`px-4 py-1.5 font-mono text-xs rounded-none transition-all border ${s.status ? "border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.1)]" : "border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.1)]"}`}>
                    {s.status ? "СТОП" : "СТАРТ"}
                  </button>
                </div>
              </div>
              {s.status && (
                <div className="mt-3">
                  <div className="cyber-progress"><div className="cyber-progress-bar" style={{ width: `${s.winrate}%` }} /></div>
                  <div className="flex justify-between mt-1"><span className="section-label">Эффективность</span><span className="font-mono text-xs neon-text">{s.winrate}%</span></div>
                </div>
              )}
            </div>
          ))}
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
      case "wallet": return <WalletPage />;
      case "history": return <HistoryPage />;
      case "portfolio": return <PortfolioPage />;
      case "positions": return <GenericPage title="ОТКРЫТЫЕ ПОЗИЦИИ" icon="Layers" />;
      case "signals": return <GenericPage title="ТОРГОВЫЕ СИГНАЛЫ" icon="Radio" />;
      case "risk": return <GenericPage title="РИСК-МЕНЕДЖМЕНТ" icon="Shield" />;
      case "alerts": return <GenericPage title="АЛЕРТЫ И УВЕДОМЛЕНИЯ" icon="Bell" />;
      case "api": return <GenericPage title="API КЛЮЧИ BINANCE" icon="Key" />;
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
