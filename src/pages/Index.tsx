import React, { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";

// ── Тарифные планы (единый источник правды) ──────────────────────────────────
const PLAN_INFO = {
  free: {
    name: "FREE", price: 0, color: "var(--cyber-text-dim)",
    badge: "",
    features: [
      { text: "Просмотр портфеля и баланса",    ok: true },
      { text: "Ручная торговля Т-Банк",          ok: true },
      { text: "История сделок",                  ok: true },
      { text: "Реферальная программа",           ok: true },
      { text: "Автотрейдинг (RSI/EMA/MACD)",    ok: false },
      { text: "Авто-продажа портфеля по %",      ok: false },
      { text: "Скальпинг-бот (до 8 сделок/день)", ok: false },
    ],
  },
  basic: {
    name: "BASIC", price: 490, color: "var(--cyber-cyan)",
    badge: "",
    features: [
      { text: "Просмотр портфеля и баланса",    ok: true },
      { text: "Ручная торговля Т-Банк",          ok: true },
      { text: "История сделок",                  ok: true },
      { text: "Реферальная программа",           ok: true },
      { text: "Автотрейдинг (RSI/EMA/MACD)",    ok: true },
      { text: "Авто-продажа портфеля по %",      ok: true },
      { text: "Скальпинг-бот (до 8 сделок/день)", ok: false },
    ],
  },
  pro: {
    name: "PRO", price: 990, color: "var(--cyber-yellow)",
    badge: "⭐ ЛУЧШИЙ ВЫБОР",
    features: [
      { text: "Просмотр портфеля и баланса",    ok: true },
      { text: "Ручная торговля Т-Банк",          ok: true },
      { text: "История сделок",                  ok: true },
      { text: "Реферальная программа",           ok: true },
      { text: "Автотрейдинг (RSI/EMA/MACD)",    ok: true },
      { text: "Авто-продажа портфеля по %",      ok: true },
      { text: "Скальпинг-бот (до 8 сделок/день)", ok: true },
    ],
  },
} as const;
type PlanKey = keyof typeof PLAN_INFO;

const MARKET_URL = "https://functions.poehali.dev/66dbea62-7575-4dac-8ab1-f42bce82db7b";
const PAYMENT_URL = "https://functions.poehali.dev/373f750f-9364-43a8-8020-4f3f2cda099f";
const TRADE_URL = "https://functions.poehali.dev/5af36d81-ec5d-4557-996a-036e428dad76";
const TBANK_URL = "https://functions.poehali.dev/fb80b07e-125f-40dc-8244-d902c6b0731a";
const AUTOTRADER_URL = "https://functions.poehali.dev/f372165e-74bb-42e7-9a58-5830d08d29fb";
const AUTH_URL = "https://functions.poehali.dev/caebbeb5-e41f-40ce-9f6c-3a86058c804d";
const SCALPER_URL = "https://functions.poehali.dev/069c26ed-4e40-418f-a3f1-c49541d79bf9";
const SCHEDULER_URL  = "https://functions.poehali.dev/682bcb35-b68e-46b3-931e-ae304700cefd";
const KEEPALIVE_URL  = "https://functions.poehali.dev/4ac8a539-dcd9-40c9-8ec0-8a4a8427ea11";

// Хелпер — все запросы с токеном сессии
const SESSION_KEY = "kb_session";
function getSession() { return localStorage.getItem(SESSION_KEY) || ""; }
function setSession(id: string) { localStorage.setItem(SESSION_KEY, id); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function authFetch(url: string, opts: RequestInit = {}) {
  const sid = getSession();
  return fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), "X-Session-Id": sid, "Content-Type": "application/json" },
  });
}

/* ===== AUTH PAGES (Login + Register) ===== */
function AuthInput({ label, value, onChange, type = "text", placeholder = "", autoComplete = "" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <div>
      <div className="section-label mb-1.5">{label}</div>
      <div className="relative">
        <input value={value} onChange={e => onChange(e.target.value)} type={isPw && !show ? "password" : "text"}
          placeholder={placeholder} autoComplete={autoComplete}
          className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2.5 pr-10 rounded-none outline-none focus:border-[var(--cyber-green)] transition-colors" />
        {isPw && <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cyber-text-dim)]"><Icon name={show ? "EyeOff" : "Eye"} size={14} /></button>}
      </div>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (sid: string, user: { username: string; role: string }, isNew?: boolean) => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [refCode, setRefCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    try {
      const body = tab === "login"
        ? { action: "login", username, password }
        : { action: "register", username, password, email, ref_code: refCode };
      const r = await fetch(AUTH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.ok) {
        onLogin(d.session_id, d.user, tab === "register");
      } else setError(d.error || "Ошибка");
    } catch { setError("Ошибка соединения"); }
    setLoading(false);
  };

  return (
    <div className="cyber-bg min-h-screen flex items-center justify-center p-4" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6 animate-fade-in-up">
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center" style={{ border: "2px solid var(--cyber-green)", boxShadow: "0 0 30px rgba(0,255,136,0.4)" }}>
            <Icon name="Bot" size={32} style={{ color: "var(--cyber-green)" }} />
          </div>
          <div className="font-orbitron text-2xl font-black neon-text mb-1">КИБЕРБОТ</div>
          <div className="font-mono text-xs text-[var(--cyber-text-dim)] tracking-widest">CRYPTO TRADING SYSTEM</div>
        </div>

        {/* Переключатель */}
        <div className="flex mb-4 border border-[var(--cyber-border)] rounded-none overflow-hidden animate-fade-in-up">
          {(["login", "register"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(""); setSuccess(""); }}
              className={`flex-1 py-2 font-mono text-xs transition-all ${tab === t ? "bg-[rgba(0,255,136,0.1)] text-[var(--cyber-green)]" : "text-[var(--cyber-text-dim)]"}`}>
              {t === "login" ? "ВОЙТИ" : "РЕГИСТРАЦИЯ"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="cyber-card-glow rounded-none p-5 space-y-3 animate-fade-in-up">
          {error && <div className="border border-[var(--cyber-red)] p-2.5 font-mono text-xs text-[var(--cyber-red)] text-center">{error}</div>}
          {success && <div className="border border-[var(--cyber-green)] p-2.5 font-mono text-xs neon-text text-center">{success}</div>}

          <AuthInput label="Логин" value={username} onChange={setUsername} placeholder="raziklon" autoComplete="username" />
          <AuthInput label="Пароль" value={password} onChange={setPassword} type="password" placeholder="••••••••" autoComplete={tab === "login" ? "current-password" : "new-password"} />

          {tab === "register" && (<>
            <AuthInput label="Email (необязательно)" value={email} onChange={setEmail} placeholder="your@email.com" autoComplete="email" />
            <AuthInput label="Реферальный код (необязательно)" value={refCode} onChange={setRefCode} placeholder="RAZIKLON" />
            <div className="text-[11px] text-[var(--cyber-text-dim)] leading-relaxed p-2 border border-[var(--cyber-border)]">
              Регистрируясь, ты автоматически становишься партнёром КиберБот и получаешь свой реф-код для приглашения других.
            </div>
          </>)}

          <button type="submit" disabled={loading || !username || !password}
            className="w-full py-3 font-orbitron text-sm font-bold rounded-none transition-all border disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ borderColor: "var(--cyber-green)", color: "var(--cyber-green)", background: loading ? "rgba(0,255,136,0.1)" : "transparent" }}>
            {loading ? <><div className="w-4 h-4 border border-[var(--cyber-green)] border-t-transparent rounded-full animate-spin" /><span>...</span></> : tab === "login" ? "ВОЙТИ В СИСТЕМУ" : "СОЗДАТЬ АККАУНТ"}
          </button>
        </form>

        <div className="text-center mt-3 font-mono text-[10px] text-[var(--cyber-text-dim)]">
          🔒 Защищённое соединение · КиберБот v5
        </div>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "dashboard", icon: "LayoutDashboard", label: "Дашборд" },
  { id: "trading", icon: "TrendingUp", label: "Торговля" },
  { id: "strategies", icon: "Brain", label: "Стратегии" },
  { id: "tbank", icon: "Building2", label: "Т-Банк" },
  { id: "bingx", icon: "BarChart2", label: "BingX" },
  { id: "autobot", icon: "Bot", label: "Автобот" },
  { id: "wallet", icon: "Wallet", label: "Кошелёк" },

  { id: "portfolio", icon: "PieChart", label: "Портфель" },
  { id: "positions", icon: "Layers", label: "Позиции" },
  { id: "signals", icon: "Radio", label: "Сигналы" },
  { id: "risk", icon: "Shield", label: "Риск-менедж" },
  { id: "alerts", icon: "Bell", label: "Алерты" },
  { id: "referral", icon: "Users", label: "Рефералы" },
  { id: "profile", icon: "User", label: "Профиль" },
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

/* ═══ Портфель — реальные позиции ═══ */
function TBankPortfolioTab({ positions, loading, onRefresh, accountId }: {
  positions: { figi: string; ticker?: string; name?: string; isin?: string; instrument_type: string; quantity: number; current_price: number; avg_price: number; pnl: number; pnl_pct: number; currency: string }[];
  loading: boolean;
  onRefresh: () => void;
  accountId: string;
}) {
  const [sellFigi, setSellFigi] = useState<string | null>(null);
  const [selling, setSelling] = useState(false);
  const [sellMsg, setSellMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Портфельный скальпер
  const [psEnabled, setPsEnabled]     = useState(false);
  const [psTarget, setPsTarget]       = useState(2.0);
  const [psStop, setPsStop]           = useState(3.0);
  const [psSaving, setPsSaving]       = useState(false);
  const [psRunning, setPsRunning]     = useState(false);
  const [psMsg, setPsMsg]             = useState<{ text: string; ok: boolean } | null>(null);
  const [psExpanded, setPsExpanded]   = useState(false);
  const [psAccountId, setPsAccountId] = useState("");
  const [psAccounts, setPsAccounts]   = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    authFetch(TBANK_URL, { method: "POST", body: JSON.stringify({ action: "portfolio_scalp_status" }) })
      .then(r => r.json())
      .then(d => {
        if (!d.error) {
          setPsEnabled(d.enabled);
          setPsTarget(d.target_pct);
          setPsStop(d.stop_pct);
          if (d.accounts) setPsAccounts(d.accounts);
          if (d.account_id) setPsAccountId(d.account_id);
        }
      })
      .catch(() => {});
  }, []);

  const savePsSettings = async (enabled: boolean) => {
    setPsSaving(true);
    const r = await authFetch(TBANK_URL, {
      method: "POST",
      body: JSON.stringify({ action: "portfolio_scalp_save", enabled, target_pct: psTarget, stop_pct: psStop, account_id: psAccountId }),
    }).then(r => r.json());
    setPsSaving(false);
    if (r.ok) { setPsEnabled(r.enabled); setPsMsg({ text: r.enabled ? `✓ Авто-продажа активна · тейк +${r.target_pct}% · стоп -${r.stop_pct}%` : "Авто-продажа выключена", ok: r.enabled }); }
    else setPsMsg({ text: r.error || "Ошибка", ok: false });
    setTimeout(() => setPsMsg(null), 4000);
  };

  const runPsCycle = async () => {
    setPsRunning(true); setPsMsg(null);
    const r = await authFetch(TBANK_URL, {
      method: "POST", body: JSON.stringify({ action: "portfolio_scalp_cycle" }),
    }).then(r => r.json());
    setPsRunning(false);
    if (r.ok) {
      const n = r.sold?.length || 0;
      if (r.skipped) {
        setPsMsg({ text: `⏸ ${r.skipped}`, ok: false });
      } else if (n > 0) {
        setPsMsg({ text: `⚡ Продано ${n} поз.: ${r.sold.map((s: {ticker:string;reason:string}) => `${s.ticker} (${s.reason})`).join(", ")}`, ok: true });
        setTimeout(onRefresh, 2000);
      } else {
        setPsMsg({ text: `Проверено ${r.checked || 0} поз. — условий нет`, ok: false });
      }
    } else setPsMsg({ text: r.error || "Ошибка", ok: false });
    setTimeout(() => setPsMsg(null), 8000);
  };

  const real = positions.filter(p => p.instrument_type !== "currency" && p.quantity > 0);

  const openSell = (figi: string) => {
    setSellMsg(null);
    setSellFigi(prev => prev === figi ? null : figi);
  };

  const doSell = async (p: typeof real[0], lots: number) => {
    if (!lots || lots <= 0) return;
    setSelling(true); setSellMsg(null);
    const r = await authFetch(TBANK_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "place_order",
        account_id: accountId,
        figi: p.figi,
        direction: "ORDER_DIRECTION_SELL",
        lots,
        order_type: "ORDER_TYPE_MARKET",
      }),
    }).then(r => r.json());
    setSelling(false);
    if (r.order_id || r.status) {
      setSellMsg({ text: `✓ Продажа ${p.ticker || p.figi.slice(-6)} · ${lots} лот(ов) · ордер принят`, ok: true });
      setSellFigi(null);
      setTimeout(() => { setSellMsg(null); onRefresh(); }, 2500);
    } else {
      setSellMsg({ text: r.message || r.error || "Ошибка выставления ордера", ok: false });
    }
  };

  if (loading) return <div className="flex items-center justify-center gap-3 py-12 cyber-card rounded-none"><Spinner /><span className="font-mono text-xs text-[var(--cyber-text-dim)]">Загружаю портфель...</span></div>;
  if (real.length === 0) return (
    <div className="cyber-card rounded-none p-8 text-center animate-fade-in-up">
      <Icon name="PieChart" size={40} className="mx-auto mb-3 text-[var(--cyber-text-dim)]" />
      <div className="font-orbitron text-sm text-[var(--cyber-text-dim)] mb-2">ПОРТФЕЛЬ ПУСТ</div>
      <div className="section-label">Бот ещё не купил акции или баланс не обновился</div>
      <button onClick={onRefresh} className="mt-4 px-4 py-1.5 font-mono text-xs border border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] rounded-none hover:bg-[rgba(0,212,255,0.08)] transition-all flex items-center gap-1.5 mx-auto">
        <Icon name="RefreshCw" size={11} /> Обновить
      </button>
    </div>
  );

  const totalPnl = real.reduce((a, p) => a + p.pnl, 0);

  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* Сводка */}
      <div className="grid grid-cols-3 gap-3">
        <div className="cyber-card-glow rounded-none p-3 text-center">
          <div className="font-orbitron text-lg font-bold neon-text-cyan">{real.length}</div>
          <div className="section-label mt-0.5">Позиций</div>
        </div>
        <div className="cyber-card-glow rounded-none p-3 text-center">
          <div className={`font-orbitron text-lg font-bold ${totalPnl >= 0 ? "neon-text" : "loss"}`}>
            {totalPnl >= 0 ? "+" : ""}{totalPnl.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽
          </div>
          <div className="section-label mt-0.5">Нереализованный P&L</div>
        </div>
        <div className="cyber-card-glow rounded-none p-3 text-center">
          <div className={`font-orbitron text-lg font-bold ${real.filter(p => p.pnl > 0).length >= real.length / 2 ? "neon-text" : "loss"}`}>
            {real.filter(p => p.pnl > 0).length}/{real.length}
          </div>
          <div className="section-label mt-0.5">В плюсе</div>
        </div>
      </div>

      {/* ── Портфельный скальпер ── */}
      <div className={`rounded-none border transition-all ${psEnabled ? "border-[rgba(0,255,136,0.35)] bg-[rgba(0,255,136,0.03)]" : "border-[var(--cyber-border)]"}`}>
        {/* Заголовок — всегда виден */}
        <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setPsExpanded(e => !e)}>
          <div className="flex items-center gap-2">
            <Icon name="Zap" size={13} className={psEnabled ? "neon-text" : "text-[var(--cyber-text-dim)]"} />
            <span className="font-mono text-xs font-semibold text-[var(--cyber-text)]">АВТО-ПРОДАЖА ПО %</span>
            {psEnabled && (
              <span className="font-mono text-[10px] text-[var(--cyber-green)] border border-[rgba(0,255,136,0.3)] px-1.5 py-0.5">
                +{psTarget}% / -{psStop}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Тоггл */}
            <button
              onClick={e => { e.stopPropagation(); savePsSettings(!psEnabled); }}
              disabled={psSaving}
              className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0 disabled:opacity-50 ${psEnabled ? "bg-[var(--cyber-green)]" : "bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)]"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${psEnabled ? "left-5" : "left-0.5"}`} />
            </button>
            <Icon name={psExpanded ? "ChevronUp" : "ChevronDown"} size={13} className="text-[var(--cyber-text-dim)]" />
          </div>
        </div>

        {/* Развёрнутая панель */}
        {psExpanded && (
          <div className="border-t border-[var(--cyber-border)] p-3 space-y-3">
            <div className="text-[11px] text-[var(--cyber-text-dim)] leading-relaxed">
              Бот автоматически продаёт позиции из портфеля когда достигается <span className="text-[var(--cyber-green)]">тейк-профит</span> или <span className="text-[var(--cyber-red)]">стоп-лосс</span>. Работает в планировщике 24/7.
            </div>

            {/* Выбор счёта */}
            {psAccounts.length > 0 && (
              <div>
                <div className="section-label text-[10px] mb-1">Брокерский счёт</div>
                <select value={psAccountId} onChange={e => setPsAccountId(e.target.value)}
                  className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-green)] text-[var(--cyber-text)] font-mono text-xs px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-cyan)] appearance-none cursor-pointer">
                  {psAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name || a.id}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="section-label mb-1.5 flex items-center gap-1">
                  <Icon name="TrendingUp" size={10} className="profit" /> ТЕЙК-ПРОФИТ %
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number" step="0.5" min="0.5" max="50" value={psTarget}
                    onChange={e => setPsTarget(parseFloat(e.target.value) || 2)}
                    className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)]"
                  />
                  <span className="font-mono text-sm text-[var(--cyber-text-dim)]">%</span>
                </div>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 5].map(v => (
                    <button key={v} onClick={() => setPsTarget(v)}
                      className={`flex-1 py-0.5 font-mono text-[10px] border rounded-none transition-all ${psTarget === v ? "border-[var(--cyber-green)] text-[var(--cyber-green)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="section-label mb-1.5 flex items-center gap-1">
                  <Icon name="TrendingDown" size={10} className="loss" /> СТОП-ЛОСС %
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number" step="0.5" min="0.5" max="50" value={psStop}
                    onChange={e => setPsStop(parseFloat(e.target.value) || 3)}
                    className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)]"
                  />
                  <span className="font-mono text-sm text-[var(--cyber-text-dim)]">%</span>
                </div>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 5].map(v => (
                    <button key={v} onClick={() => setPsStop(v)}
                      className={`flex-1 py-0.5 font-mono text-[10px] border rounded-none transition-all ${psStop === v ? "border-[var(--cyber-red)] text-[var(--cyber-red)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {psMsg && (
              <div className={`p-2 border font-mono text-xs rounded-none ${psMsg.ok ? "border-[var(--cyber-green)] profit" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
                {psMsg.text}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => savePsSettings(psEnabled)} disabled={psSaving}
                className="flex-1 py-2 font-orbitron text-[10px] tracking-widest border border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] hover:bg-[rgba(0,212,255,0.08)] rounded-none transition-all disabled:opacity-40">
                {psSaving ? "СОХРАНЯЮ..." : "СОХРАНИТЬ"}
              </button>
              <button onClick={runPsCycle} disabled={psRunning}
                className="flex-1 py-2 font-orbitron text-[10px] tracking-widest border border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.08)] rounded-none transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
                {psRunning ? <Spinner /> : <Icon name="Play" size={11} />}
                {psRunning ? "ПРОВЕРЯЮ..." : "ПРОВЕРИТЬ СЕЙЧАС"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Глобальное сообщение */}
      {sellMsg && (
        <div className={`p-3 border font-mono text-xs rounded-none ${sellMsg.ok ? "border-[var(--cyber-green)] profit" : "border-[var(--cyber-red)] loss"}`}>
          {sellMsg.text}
        </div>
      )}

      {/* Список позиций */}
      {real.map((p, i) => {
        const pct = typeof p.pnl_pct === "number" ? p.pnl_pct : parseFloat(String(p.pnl_pct)) || 0;
        const isOpen = sellFigi === p.figi;
        const maxLots = Math.floor(p.quantity);

        return (
          <div key={p.figi} className={`cyber-card rounded-none animate-fade-in-up transition-all ${isOpen ? "border-[rgba(255,61,113,0.4)]" : ""}`} style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}>
            {/* Основная строка */}
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 shrink-0 bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] flex items-center justify-center font-orbitron text-[9px] font-bold text-[var(--cyber-cyan)] rounded-none">
                  {p.ticker ? p.ticker.slice(0, 4) : p.instrument_type === "etf" ? "ETF" : "АКЦ"}
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-sm text-[var(--cyber-text)] font-semibold truncate">
                    {p.ticker || p.figi.slice(-8)}
                    {p.name && p.name !== p.ticker && <span className="text-[var(--cyber-text-dim)] font-normal ml-1.5 text-xs">{p.name}</span>}
                  </div>
                  <div className="section-label">
                    {p.quantity} шт.
                    {p.avg_price > 0 && <> · ср. {p.avg_price.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽</>}
                    {p.current_price > 0 && <> · тек. {p.current_price.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽</>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* P&L */}
                <div className="text-right">
                  <div className={`font-mono text-sm font-semibold ${p.pnl >= 0 ? "profit" : "loss"}`}>
                    {p.pnl >= 0 ? "+" : ""}{p.pnl.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽
                  </div>
                  <div className={`font-mono text-xs font-bold ${pct > 0 ? "profit" : pct < 0 ? "loss" : "text-[var(--cyber-text-dim)]"}`}>
                    {pct > 0 ? "+" : ""}{pct.toFixed(2)}%
                  </div>
                </div>

                {/* Кнопка продажи */}
                <button
                  onClick={() => openSell(p.figi)}
                  className={`px-3 py-1.5 font-orbitron text-[10px] border rounded-none transition-all shrink-0 ${isOpen ? "border-[var(--cyber-red)] text-[var(--cyber-red)] bg-[rgba(255,61,113,0.1)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-red)] hover:text-[var(--cyber-red)]"}`}>
                  {isOpen ? "✕ ОТМЕНА" : "ПРОДАТЬ"}
                </button>
              </div>
            </div>

            {/* Панель продажи — раскрывается */}
            {isOpen && (
              <SellPanel
                position={p}
                maxLots={maxLots}
                selling={selling}
                onSell={(lots) => doSell(p, lots)}
              />
            )}
          </div>
        );
      })}

      <button onClick={onRefresh} className="w-full py-2 font-mono text-xs border border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-cyan)] hover:text-[var(--cyber-cyan)] rounded-none transition-all flex items-center justify-center gap-1.5">
        <Icon name="RefreshCw" size={11} /> Обновить портфель
      </button>
    </div>
  );
}

/* ═══ Панель продажи ═══ */
function SellPanel({ position, maxLots, selling, onSell }: {
  position: { ticker?: string; figi: string; quantity: number; current_price: number; avg_price: number; pnl: number; pnl_pct: number; currency: string };
  maxLots: number;
  selling: boolean;
  onSell: (lots: number) => void;
}) {
  const [lots, setLots] = useState(maxLots);
  const pct = typeof position.pnl_pct === "number" ? position.pnl_pct : parseFloat(String(position.pnl_pct)) || 0;
  const sellValue = lots * position.current_price;
  const avgCost   = lots * position.avg_price;
  const estPnl    = avgCost > 0 ? sellValue - avgCost : position.pnl * (lots / position.quantity);

  return (
    <div className="border-t border-[rgba(255,61,113,0.25)] bg-[rgba(255,61,113,0.04)] px-4 pb-4 pt-3 space-y-3">
      <div className="section-label flex items-center gap-1.5">
        <Icon name="TrendingDown" size={11} className="text-[var(--cyber-red)]" />
        ПРОДАТЬ {position.ticker || position.figi.slice(-6)} — РЫНОЧНЫЙ ОРДЕР
      </div>

      {/* Текущий % */}
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-none font-mono text-xs font-bold ${pct > 0 ? "border-[rgba(0,255,136,0.4)] profit bg-[rgba(0,255,136,0.06)]" : "border-[rgba(255,61,113,0.4)] loss bg-[rgba(255,61,113,0.06)]"}`}>
        <Icon name={pct >= 0 ? "TrendingUp" : "TrendingDown"} size={11} />
        Текущий результат: {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
        {" · "}{position.pnl >= 0 ? "+" : ""}{position.pnl.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽
      </div>

      {/* Слайдер количества */}
      <div>
        <div className="flex justify-between mb-1.5">
          <span className="section-label">Количество лотов</span>
          <span className="font-mono text-xs text-[var(--cyber-text)]">{lots} / {maxLots} лот.</span>
        </div>
        <input
          type="range" min={1} max={maxLots} step={1} value={lots}
          onChange={e => setLots(parseInt(e.target.value))}
          className="w-full accent-[var(--cyber-red)] cursor-pointer"
        />
        <div className="flex justify-between mt-1">
          <button onClick={() => setLots(Math.ceil(maxLots * 0.25))} className="font-mono text-[10px] text-[var(--cyber-text-dim)] hover:text-[var(--cyber-red)] transition-colors">25%</button>
          <button onClick={() => setLots(Math.ceil(maxLots * 0.5))}  className="font-mono text-[10px] text-[var(--cyber-text-dim)] hover:text-[var(--cyber-red)] transition-colors">50%</button>
          <button onClick={() => setLots(Math.ceil(maxLots * 0.75))} className="font-mono text-[10px] text-[var(--cyber-text-dim)] hover:text-[var(--cyber-red)] transition-colors">75%</button>
          <button onClick={() => setLots(maxLots)}                    className="font-mono text-[10px] text-[var(--cyber-text-dim)] hover:text-[var(--cyber-red)] transition-colors">100%</button>
        </div>
      </div>

      {/* Итог */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] p-2 rounded-none">
          <div className="section-label text-[9px]">Получите ~</div>
          <div className="font-mono text-sm font-bold text-[var(--cyber-text)] mt-0.5">
            {sellValue > 0 ? sellValue.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽" : "—"}
          </div>
        </div>
        <div className="bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] p-2 rounded-none">
          <div className="section-label text-[9px]">Прибыль/убыток ~</div>
          <div className={`font-mono text-sm font-bold mt-0.5 ${estPnl >= 0 ? "profit" : "loss"}`}>
            {estPnl >= 0 ? "+" : ""}{estPnl.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽
          </div>
        </div>
      </div>

      {/* Кнопка продать */}
      <button
        onClick={() => onSell(lots)}
        disabled={selling || lots <= 0}
        className="w-full py-2.5 font-orbitron text-xs tracking-widest border border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.12)] rounded-none transition-all disabled:opacity-40 flex items-center justify-center gap-2">
        {selling ? <Spinner /> : <Icon name="TrendingDown" size={13} />}
        {selling ? "ВЫСТАВЛЯЮ ОРДЕР..." : `ПРОДАТЬ ${lots} ЛОТ · РЫНОЧНЫЙ ОРДЕР`}
      </button>

      <div className="text-[10px] font-mono text-[var(--cyber-text-dim)]">
        Рыночный ордер — исполнится по лучшей доступной цене. Цены ориентировочные.
      </div>
    </div>
  );
}

/* ═══ История сделок — реальные операции ═══ */
function TBankOrdersTab({ accountId }: { accountId: string }) {
  const [ops, setOps] = useState<{
    id: string; type: string; figi: string; ticker: string; name: string;
    quantity: number; price: number; payment: number; currency: string;
    date: string; date_msk: string;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "buy" | "sell">("all");

  useEffect(() => {
    if (!accountId) { setLoading(false); return; }
    authFetch(`${TBANK_URL}?action=operations&account_id=${accountId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setOps(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accountId]);

  const TYPE: Record<string, { label: string; short: string; color: string; icon: string }> = {
    "OPERATION_TYPE_BUY":        { label: "ПОКУПКА",    short: "BUY",  color: "profit",                          icon: "TrendingUp" },
    "OPERATION_TYPE_BUY_CARD":   { label: "ПОКУПКА",    short: "BUY",  color: "profit",                          icon: "TrendingUp" },
    "OPERATION_TYPE_SELL":       { label: "ПРОДАЖА",    short: "SELL", color: "loss",                            icon: "TrendingDown" },
    "OPERATION_TYPE_BROKER_FEE": { label: "КОМИССИЯ",   short: "FEE",  color: "text-[var(--cyber-text-dim)]",    icon: "Receipt" },
    "OPERATION_TYPE_INPUT":      { label: "ПОПОЛНЕНИЕ", short: "IN",   color: "neon-text-cyan",                  icon: "ArrowDownLeft" },
  };

  const isBuy  = (t: string) => ["OPERATION_TYPE_BUY", "OPERATION_TYPE_BUY_CARD"].includes(t);
  const isSell = (t: string) => t === "OPERATION_TYPE_SELL";

  const trades = ops.filter(o => isBuy(o.type) || isSell(o.type));
  const shown  = filter === "buy"  ? trades.filter(o => isBuy(o.type))
               : filter === "sell" ? trades.filter(o => isSell(o.type))
               : trades;

  const totalPnl = trades.filter(o => isSell(o.type)).reduce((a, o) => a + o.payment, 0);
  const sells    = trades.filter(o => isSell(o.type)).length;
  const wins     = trades.filter(o => isSell(o.type) && o.payment > 0).length;
  const spent    = trades.filter(o => isBuy(o.type)).reduce((a, o) => a + Math.abs(o.payment), 0);

  if (loading) return (
    <div className="flex items-center justify-center gap-3 py-12 cyber-card rounded-none">
      <Spinner /><span className="font-mono text-xs text-[var(--cyber-text-dim)]">Загружаю историю и названия инструментов...</span>
    </div>
  );

  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* Сводка */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Сделок за 30 дней", val: String(trades.length), color: "neon-text-cyan" },
          { label: "P&L реализованный", val: `${totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, color: totalPnl >= 0 ? "neon-text" : "loss" },
          { label: "Прибыльных продаж", val: `${sells > 0 ? Math.round(wins / sells * 100) : 0}%`, color: "neon-text" },
          { label: "Вложено (покупки)", val: `${spent.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, color: "text-[var(--cyber-yellow)]" },
        ].map(s => (
          <div key={s.label} className="cyber-card-glow rounded-none p-3 text-center">
            <div className={`font-orbitron text-base font-bold ${s.color}`}>{s.val}</div>
            <div className="section-label mt-0.5 text-[9px]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Фильтр */}
      <div className="flex gap-1">
        {([["all", "Все"], ["buy", "Покупки"], ["sell", "Продажи"]] as const).map(([val, lbl]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1.5 font-mono text-xs border rounded-none transition-all ${filter === val ? "border-[var(--cyber-cyan)] text-[var(--cyber-cyan)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
            {lbl}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] text-[var(--cyber-text-dim)] self-center">{shown.length} записей</span>
      </div>

      {shown.length === 0 ? (
        <div className="cyber-card rounded-none p-8 text-center">
          <div className="font-orbitron text-sm text-[var(--cyber-text-dim)]">НЕТ СДЕЛОК ЗА 30 ДНЕЙ</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {shown.map((o, i) => {
            const tl     = TYPE[o.type] || { label: o.type, short: "?", color: "text-[var(--cyber-text-dim)]", icon: "Circle" };
            const ticker = o.ticker && o.ticker !== "—" ? o.ticker : o.figi?.slice(-6) || "—";
            const name   = o.name && o.name !== "—" && o.name !== ticker ? o.name : null;
            const isSl   = isSell(o.type);
            return (
              <div key={o.id || i}
                className="cyber-card rounded-none p-3 flex items-center gap-3 hover:border-[var(--cyber-border-bright)] transition-all animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i, 15) * 30}ms`, opacity: 0 }}>
                {/* Иконка типа */}
                <div className={`w-8 h-8 shrink-0 flex items-center justify-center border rounded-none ${isSl ? "border-[rgba(255,61,113,0.4)] bg-[rgba(255,61,113,0.07)]" : "border-[rgba(0,255,136,0.3)] bg-[rgba(0,255,136,0.05)]"}`}>
                  <Icon name={tl.icon} size={13} className={tl.color} />
                </div>

                {/* Инструмент */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-[var(--cyber-text)]">{ticker}</span>
                    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 border rounded-none ${tl.color} border-current opacity-70`}>
                      {tl.short}
                    </span>
                  </div>
                  <div className="section-label text-[10px] truncate">
                    {name && <span className="mr-2">{name}</span>}
                    {o.quantity > 0 && <span>{o.quantity} шт.</span>}
                    {o.price > 0 && <span> · {o.price.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽/шт.</span>}
                  </div>
                </div>

                {/* Сумма и время */}
                <div className="text-right shrink-0">
                  <div className={`font-mono text-sm font-bold ${o.payment >= 0 ? "profit" : "loss"}`}>
                    {o.payment >= 0 ? "+" : ""}{o.payment.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽
                  </div>
                  <div className="font-mono text-[10px] text-[var(--cyber-text-dim)] mt-0.5">{o.date_msk || "—"}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TBankScalpStatus() {
  const [data, setData] = useState<{ open_trades: { ticker: string; buy_price: number; lots: number; target_pct: number; stop_pct: number }[]; trades_today: number; pnl_today: number } | null>(null);
  useEffect(() => {
    authFetch(`${SCALPER_URL}?action=status`).then(r => r.json()).then(d => { if (!d.error) setData(d); }).catch(() => {});
  }, []);
  if (!data) return <div className="flex items-center justify-center py-8"><Spinner /></div>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="cyber-card-glow rounded-none p-3 text-center">
          <div className="font-orbitron text-xl font-bold text-[var(--cyber-yellow)]">{data.open_trades.length}</div>
          <div className="section-label mt-0.5">Открытых</div>
        </div>
        <div className="cyber-card-glow rounded-none p-3 text-center">
          <div className="font-orbitron text-xl font-bold neon-text">{data.trades_today}</div>
          <div className="section-label mt-0.5">Сегодня</div>
        </div>
        <div className="cyber-card-glow rounded-none p-3 text-center">
          <div className={`font-orbitron text-xl font-bold ${data.pnl_today >= 0 ? "neon-text" : "loss"}`}>
            {data.pnl_today >= 0 ? "+" : ""}{data.pnl_today.toFixed(0)} ₽
          </div>
          <div className="section-label mt-0.5">P&L</div>
        </div>
      </div>
      {data.open_trades.length > 0 && (
        <div className="cyber-card rounded-none p-3">
          <div className="section-label mb-2">ПОЗИЦИИ СКАЛЬПЕРА</div>
          {data.open_trades.map((t, i) => (
            <div key={i} className="flex justify-between py-1.5 border-b border-[rgba(26,58,74,0.4)] last:border-0">
              <span className="font-mono text-sm font-bold text-[var(--cyber-text)]">{t.ticker}</span>
              <div className="flex gap-3">
                <span className="font-mono text-xs neon-text">+{t.target_pct}%</span>
                <span className="font-mono text-xs text-[var(--cyber-red)]">−{t.stop_pct}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TBankPage({ refreshKey = 0, scalpEnabled, setScalpEnabled, scalpIntervalMin, setScalpIntervalMin, scalpCountdown, setScalpCountdown, scalpRunning, triggerScalpCycle, scalpMsg }: { refreshKey?: number } & ScalperPageProps) {
  const [tab, setTab] = useState<"balance" | "autobot" | "scalper" | "market" | "orders" | "portfolio">("balance");
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
    authFetch(`${TBANK_URL}?action=accounts`)
      .then(r => r.json())
      .then(d => { setHasToken(Array.isArray(d) && d.length > 0); })
      .catch(() => setHasToken(false));
  }, []);

  const fetchBalance = useCallback(() => {
    setBalanceError(null);
    authFetch(`${TBANK_URL}?action=balance`)
      .then(r => r.json())
      .then(d => { if (d.error) setBalanceError(d.error); else setBalance(d); })
      .catch(() => setBalanceError("Ошибка соединения"))
      .finally(() => setBalanceLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== "balance") return;
    setBalanceLoading(true);
    fetchBalance();
  }, [tab, fetchBalance, refreshKey]);

  useEffect(() => {
    if (tab !== "balance") return;
    const t = setInterval(fetchBalance, 30000);
    return () => clearInterval(t);
  }, [tab, fetchBalance]);

  useEffect(() => {
    if (tab !== "autobot") return;
    setBotLoading(true);
    authFetch(`${AUTOTRADER_URL}?action=status`)
      .then(r => r.json())
      .then(d => setBotStatus(d))
      .catch(() => {})
      .finally(() => setBotLoading(false));
  }, [tab]);

  const toggleBot = async () => {
    if (!botStatus) return;
    setToggling(true);
    const newEnabled = !botStatus.enabled;
    await authFetch(AUTOTRADER_URL, {
      method: "POST",
      body: JSON.stringify({ action: "save_settings", mode: botStatus.mode, fixed_amount: botStatus.fixed_amount, stop_pct: 3, enabled: newEnabled }),
    });
    setBotStatus(s => s ? { ...s, enabled: newEnabled } : s);
    setToggling(false);
  };

  const runNow = async () => {
    setToggling(true);
    const r = await authFetch(AUTOTRADER_URL, { method: "POST", body: JSON.stringify({ action: "run_once" }) });
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
        <div className="flex items-center gap-2">
          {tab === "balance" && (
            <button onClick={() => { setBalanceLoading(true); fetchBalance(); }}
              className="px-2 py-1.5 border border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-cyan)] hover:text-[var(--cyber-cyan)] rounded-none transition-all flex items-center gap-1 font-mono text-xs">
              <Icon name="RefreshCw" size={11} />
              Обновить
            </button>
          )}
          <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-none font-mono text-xs ${hasToken === true ? "border-[var(--cyber-green)] text-[var(--cyber-green)]" : hasToken === false ? "border-[var(--cyber-red)] text-[var(--cyber-red)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${hasToken === true ? "bg-[var(--cyber-green)]" : "bg-[var(--cyber-red)]"}`} />
            {hasToken === true ? "ПОДКЛЮЧЁН" : hasToken === false ? "НЕТ ТОКЕНА" : "ПРОВЕРКА..."}
          </div>
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
        {(["balance", "autobot", "scalper", "market", "orders", "portfolio"] as const).map(t => (
          <button key={t} onClick={() => setTab(t as typeof tab)}
            className={`px-3 py-1.5 font-mono text-xs rounded-none border transition-all ${tab === t ? "border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] bg-[rgba(0,212,255,0.08)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-cyan)]"}`}>
            {t === "balance" ? "💰 БАЛАНС" : t === "autobot" ? "🤖 АВТОБОТ" : t === "scalper" ? "⚡ СКАЛЬПИНГ" : t === "market" ? "РЫНОК" : t === "orders" ? "СДЕЛКИ" : "ПОРТФЕЛЬ"}
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

            {/* Планировщик */}
            <div className="cyber-card rounded-none p-4 border border-[rgba(0,212,255,0.2)]">
              <div className="section-label mb-3 flex items-center gap-2">
                <Icon name="Clock" size={12} className="neon-text-cyan" />
                ПЛАНИРОВЩИК — АВТОЗАПУСК КАЖДЫЙ ЧАС
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="section-label text-[10px] mb-1">Статус</div>
                  <div className={`font-mono text-xs font-semibold flex items-center gap-1.5 ${botStatus.enabled ? "neon-text" : "text-[var(--cyber-text-dim)]"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${botStatus.enabled ? "bg-[var(--cyber-green)] animate-pulse" : "bg-[var(--cyber-text-dim)]"}`} />
                    {botStatus.enabled ? "РАБОТАЕТ" : "ОСТАНОВЛЕН"}
                  </div>
                </div>
                <div>
                  <div className="section-label text-[10px] mb-1">Последний запуск</div>
                  <div className="font-mono text-xs text-[var(--cyber-text)]">{botStatus.last_run || "—"}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Интервал", val: "1 час" },
                  { label: "Часы работы", val: "07:00–23:00" },
                  { label: "Стратегии", val: "RSI + EMA" },
                ].map(s => (
                  <div key={s.label} className="bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] p-2 rounded-none">
                    <div className="font-mono text-xs font-semibold neon-text-cyan">{s.val}</div>
                    <div className="section-label text-[9px] mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-[var(--cyber-text-dim)] leading-relaxed">
                Планировщик каждый час автоматически проверяет сигналы RSI и EMA по 5 инструментам (SBER, YNDX, AAPL, GAZP, TMOS) и выставляет ордера если бот включён.
              </div>
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

      {/* ═══ СКАЛЬПИНГ в Т-Банк ═══ */}
      {tab === "scalper" && (
        <ScalperPage
          scalpEnabled={scalpEnabled} setScalpEnabled={setScalpEnabled}
          scalpIntervalMin={scalpIntervalMin} setScalpIntervalMin={setScalpIntervalMin}
          scalpCountdown={scalpCountdown} setScalpCountdown={setScalpCountdown}
          scalpRunning={scalpRunning} triggerScalpCycle={triggerScalpCycle}
          scalpMsg={scalpMsg}
        />
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
      {tab === "orders" && <TBankOrdersTab accountId={bal?.account_id || ""} />}

      {/* ═══ ПОРТФЕЛЬ ═══ */}
      {tab === "portfolio" && <TBankPortfolioTab positions={bal?.positions || []} loading={balanceLoading} accountId={bal?.account_id || ""} onRefresh={() => { setBalanceLoading(true); fetchBalance(); }} />}

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
  accounts?: { id: string; name: string }[];
  account_id?: string;
  instruments_count?: number;
}

const INTERVALS = [
  { val: 10,  label: "10 мин" },
  { val: 20,  label: "20 мин" },
  { val: 30,  label: "30 мин" },
  { val: 60,  label: "1 час" },
];

interface AutoBotPageProps {
  botEnabled: boolean; setBotEnabled: (v: boolean) => void;
  botIntervalMin: number; setBotIntervalMin: (v: number) => void;
  botCountdown: number; setBotCountdown: (v: number) => void;
  botCycleCount: number; setBotCycleCount: (v: number) => void;
  botRunning: boolean; triggerBotCycle: () => void;
  botLastMsg: { text: string; ok: boolean } | null;
  setBotLastMsg: (v: { text: string; ok: boolean } | null) => void;
}

function AutoBotPage({
  botEnabled, setBotEnabled,
  botIntervalMin, setBotIntervalMin,
  botCountdown, setBotCountdown,
  botCycleCount, setBotCycleCount,
  botRunning: running, triggerBotCycle,
  botLastMsg: msg, setBotLastMsg: setMsg,
}: AutoBotPageProps) {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState("10pct");
  const [fixedAmount, setFixedAmount] = useState("5000");
  const [botAccountId, setBotAccountId] = useState("");
  const enabled = botEnabled;
  const setEnabled = setBotEnabled;
  const intervalMin = botIntervalMin;
  const setIntervalMin = setBotIntervalMin;
  const countdown = botCountdown;
  const cycleCount = botCycleCount;
  const cycleRef2 = useRef(0);

  const loadStatus = useCallback(async () => {
    try {
      const r = await authFetch(`${AUTOTRADER_URL}?action=status`);
      const d: BotStatus = await r.json();
      setStatus(d);
      setMode(d.mode);
      setFixedAmount(String(d.fixed_amount));
      if (d.account_id) setBotAccountId(d.account_id);
    } catch { /* skip */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const runOnce = async () => {
    setBotCountdown(intervalMin * 60);
    triggerBotCycle();
    loadStatus();
  };

  const toggleBot = async () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    if (newEnabled) { setBotCountdown(intervalMin * 60); cycleRef2.current = 0; }
    else { setBotCountdown(0); }
    try {
      const r = await authFetch(AUTOTRADER_URL, {
        method: "POST",
        body: JSON.stringify({ action: "save_settings", mode, fixed_amount: parseFloat(fixedAmount) || 5000, stop_pct: 3, enabled: newEnabled, account_id: botAccountId }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg({ text: newEnabled ? "✓ Бот запущен — первый цикл сейчас" : "✓ Бот остановлен", ok: newEnabled });
        if (newEnabled) { setTimeout(() => triggerBotCycle(), 1500); }
      } else { setEnabled(!newEnabled); }
    } catch { setEnabled(!newEnabled); }
    setTimeout(() => setMsg(null), 5000);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const r = await authFetch(AUTOTRADER_URL, {
        method: "POST",
        body: JSON.stringify({ action: "save_settings", mode, fixed_amount: parseFloat(fixedAmount) || 5000, stop_pct: 3, enabled, account_id: botAccountId }),
      });
      const d = await r.json();
      if (d.success) { setMsg({ text: "✓ Настройки сохранены", ok: true }); loadStatus(); }
      else setMsg({ text: d.error || "Ошибка", ok: false });
    } catch { setMsg({ text: "Ошибка", ok: false }); }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  const fmtCountdown = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const MODES = [
    { id: "10pct", label: "10% от остатка", desc: "Безопасный — до 10 позиций" },
    { id: "25pct", label: "25% от остатка", desc: "Умеренный — до 4 позиций" },
    { id: "50pct", label: "50% от остатка", desc: "Агрессивный — 2 крупные позиции" },
    { id: "fixed", label: "Фиксированная сумма", desc: "Точная сумма в рублях на сделку" },
  ];

  // BingX bot state
  const [bxEnabled, setBxEnabled] = useState(false);
  const [bxInterval, setBxInterval] = useState(15);
  const [bxCountdown, setBxCountdown] = useState(0);
  const [bxRunning, setBxRunning] = useState(false);
  const [bxMsg, setBxMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [bxAmount, setBxAmount] = useState("20");
  const [bxTarget, setBxTarget] = useState("0.8");
  const [bxStop, setBxStop] = useState("1.5");
  const [bxHasKeys, setBxHasKeys] = useState<boolean | null>(null);
  const [botTab, setBotTab] = useState<"tbank" | "bingx">("tbank");

  useEffect(() => {
    authFetch(`${BINGX_URL}?action=check_keys`).then(r => r.json()).then(d => setBxHasKeys(d.has_keys)).catch(() => setBxHasKeys(false));
  }, []);

  useEffect(() => {
    if (!bxEnabled) { setBxCountdown(0); return; }
    const total = bxInterval * 60;
    setBxCountdown(c => c > 0 ? c : total);
    const tick = setInterval(() => setBxCountdown(p => p <= 1 ? total : p - 1), 1000);
    return () => clearInterval(tick);
  }, [bxEnabled, bxInterval]);

  const bxRef = useRef(0);
  useEffect(() => {
    if (!bxEnabled || bxCountdown !== bxInterval * 60) return;
    if (bxRef.current === 0) { bxRef.current = 1; return; }
    runBxCycle();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bxCountdown]);

  const runBxCycle = async () => {
    if (bxRunning) return;
    setBxRunning(true); setBxMsg(null);
    try {
      await authFetch(BINGX_URL, { method: "POST", body: JSON.stringify({ action: "save_scalp_settings", bingx_scalp_amount: bxAmount, bingx_scalp_target: bxTarget, bingx_scalp_stop: bxStop }) });
      const d = await authFetch(BINGX_URL, { method: "POST", body: JSON.stringify({ action: "scalp_cycle" }) }).then(r => r.json());
      if (d.ok) setBxMsg({ text: `⚡ Куплено: ${d.bought?.length || 0} · Продано: ${d.sold?.length || 0} · Открытых: ${d.open_count || 0}`, ok: true });
      else setBxMsg({ text: d.error || "Ошибка", ok: false });
    } catch { setBxMsg({ text: "Ошибка соединения", ok: false }); }
    setBxRunning(false);
    setTimeout(() => setBxMsg(null), 6000);
  };

  const fmtBx = (s: number) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;

  const BX_INTERVALS = [5, 10, 15, 30, 60];

  if (loading) return <div className="flex items-center justify-center p-20"><Spinner /></div>;

  return (
    <div className="space-y-4">

      {/* Переключатель брокера */}
      <div className="flex gap-2">
        <button onClick={() => setBotTab("tbank")}
          className={`flex-1 py-2.5 font-orbitron text-xs font-bold border rounded-none transition-all flex items-center justify-center gap-2 ${botTab === "tbank" ? "border-[var(--cyber-green)] text-[var(--cyber-green)] bg-[rgba(0,255,136,0.08)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
          <Icon name="Building2" size={13} /> Т-БАНК БОТ
        </button>
        <button onClick={() => setBotTab("bingx")}
          className={`flex-1 py-2.5 font-orbitron text-xs font-bold border rounded-none transition-all flex items-center justify-center gap-2 ${botTab === "bingx" ? "border-[var(--cyber-green)] text-[var(--cyber-green)] bg-[rgba(0,255,136,0.08)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
          <Icon name="BarChart2" size={13} /> BINGX БОТ
        </button>
      </div>

      {/* ═══ BINGX BOT ═══ */}
      {botTab === "bingx" && (
        <div className="space-y-4">
          {bxHasKeys === false && (
            <div className="cyber-card rounded-none p-4 border border-[var(--cyber-yellow)]">
              <div className="flex items-start gap-2">
                <Icon name="AlertTriangle" size={14} className="text-[var(--cyber-yellow)] shrink-0 mt-0.5" />
                <div className="font-mono text-xs text-[var(--cyber-yellow)]">
                  API ключи BingX не добавлены. Перейди в раздел <span className="font-bold">BingX → API Ключи</span> и подключи аккаунт.
                </div>
              </div>
            </div>
          )}
          <div className="cyber-card-glow rounded-none p-4">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div>
                <div className="font-orbitron text-base font-bold flex items-center gap-2 text-[var(--cyber-text)]">
                  <Icon name="BarChart2" size={16} className="neon-text" />
                  АВТОБОТ BINGX
                </div>
                <div className="section-label mt-0.5">Спот-скальпинг · Авто-цикл по таймеру</div>
              </div>
              <button onClick={() => { const ne = !bxEnabled; setBxEnabled(ne); if (ne) { setBxCountdown(bxInterval * 60); bxRef.current = 0; setTimeout(() => runBxCycle(), 500); } else setBxCountdown(0); }}
                className={`px-5 py-2 font-orbitron text-xs font-bold rounded-none border transition-all ${bxEnabled ? "border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.1)]" : "border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.15)]"}`}>
                {bxEnabled ? "⏹ СТОП" : "▶ СТАРТ"}
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="section-label shrink-0">Интервал:</span>
              {BX_INTERVALS.map(iv => (
                <button key={iv} onClick={() => { setBxInterval(iv); if (bxEnabled) setBxCountdown(iv * 60); }} disabled={bxEnabled}
                  className={`px-2.5 py-1 font-mono text-xs rounded-none border transition-all disabled:opacity-50 ${bxInterval === iv ? "border-[var(--cyber-green)] text-[var(--cyber-green)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
                  {iv < 60 ? `${iv} мин` : "1 час"}
                </button>
              ))}
            </div>
            {bxEnabled && bxCountdown > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] h-1.5 rounded-none overflow-hidden">
                  <div className="h-full bg-[var(--cyber-green)] transition-all duration-1000"
                    style={{ width: `${100 - (bxCountdown / (bxInterval * 60) * 100)}%`, boxShadow: "0 0 6px var(--cyber-green)" }} />
                </div>
                <div className="font-orbitron text-sm font-bold neon-text shrink-0">{fmtBx(bxCountdown)}</div>
                <div className="section-label shrink-0">до цикла</div>
              </div>
            )}
          </div>
          {bxMsg && (
            <div className={`rounded-none p-3 font-mono text-xs border ${bxMsg.ok ? "border-[var(--cyber-green)] text-[var(--cyber-green)]" : "border-[var(--cyber-red)] text-[var(--cyber-red)]"}`}>
              {bxMsg.text}
            </div>
          )}
          <div className="cyber-card rounded-none p-4 space-y-3">
            <div className="section-label">НАСТРОЙКИ СДЕЛКИ</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Сумма USDT", val: bxAmount, set: setBxAmount },
                { label: "Цель %", val: bxTarget, set: setBxTarget },
                { label: "Стоп-лосс %", val: bxStop, set: setBxStop },
              ].map(f => (
                <div key={f.label}>
                  <div className="section-label text-[10px] mb-1">{f.label}</div>
                  <input value={f.val} onChange={e => f.set(e.target.value)} type="number" step="0.1" min="0.1"
                    className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)]" />
                </div>
              ))}
            </div>
            <button onClick={runBxCycle} disabled={bxRunning}
              className="w-full py-2.5 font-orbitron text-xs font-bold border border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] hover:bg-[rgba(0,212,255,0.08)] rounded-none transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              {bxRunning ? <><Spinner /><span>ТОРГУЮ...</span></> : <><Icon name="Zap" size={13} /><span>ЗАПУСТИТЬ ЦИКЛ ВРУЧНУЮ</span></>}
            </button>
          </div>
          <div className="cyber-card rounded-none p-3 border border-[rgba(0,255,136,0.2)]">
            <div className="flex items-start gap-2">
              <Icon name="Info" size={13} className="neon-text shrink-0 mt-0.5" />
              <div className="text-[11px] text-[var(--cyber-text-dim)] leading-relaxed">
                <span className="neon-text font-semibold">Логика бота: </span>
                сканирует топ пары BingX по RSI/объёму, покупает на споте, продаёт при достижении цели% или стоп-лосса.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Т-БАНК БОТ ═══ */}
      {botTab === "tbank" && <div className="space-y-4">

      {/* Шапка со статусом + таймер */}
      <div className="cyber-card-glow rounded-none p-4 animate-fade-in-up">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <div className="font-orbitron text-base font-bold flex items-center gap-2 text-[var(--cyber-text)]">
              <Icon name="Bot" size={16} className="neon-text" />
              АВТОМАТИЧЕСКИЙ ТОРГОВЫЙ БОТ
            </div>
            <div className="section-label mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Т-Банк Invest · RSI + EMA</span>
              {status?.instruments_count ? (
                <span className="px-1.5 py-0.5 border border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] font-mono text-[10px]">
                  {status.instruments_count} акций и ETF
                </span>
              ) : null}
            </div>
          </div>
          <button
            onClick={toggleBot}
            className={`px-5 py-2 font-orbitron text-xs font-bold rounded-none border transition-all ${enabled ? "border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.1)]" : "border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.15)]"}`}>
            {enabled ? "⏹ ОСТАНОВИТЬ" : "▶ ЗАПУСТИТЬ БОТ"}
          </button>
        </div>

        {/* Выбор интервала */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="section-label shrink-0">Интервал запуска:</span>
          {INTERVALS.map(iv => (
            <button key={iv.val} onClick={() => { setIntervalMin(iv.val); if (enabled) setCountdown(iv.val * 60); }}
              disabled={enabled}
              className={`px-3 py-1 font-mono text-xs rounded-none border transition-all disabled:opacity-50 ${intervalMin === iv.val ? "border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] bg-[rgba(0,212,255,0.08)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-cyan)]"}`}>
              {iv.label}
            </button>
          ))}
        </div>

        {/* Таймер обратного отсчёта */}
        {enabled && countdown > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] h-1.5 rounded-none overflow-hidden">
              <div className="h-full bg-[var(--cyber-green)] transition-all duration-1000"
                style={{ width: `${100 - (countdown / (intervalMin * 60) * 100)}%`, boxShadow: "0 0 6px var(--cyber-green)" }} />
            </div>
            <div className="font-orbitron text-sm font-bold neon-text shrink-0">
              {fmtCountdown(countdown)}
            </div>
            <div className="section-label shrink-0">до след. цикла</div>
          </div>
        )}
      </div>

      {/* Уведомление */}
      {msg && (
        <div className={`cyber-card rounded-none p-3 border font-mono text-xs animate-fade-in-up ${msg.ok ? "border-[var(--cyber-green)] profit" : "border-[var(--cyber-red)] loss"}`}>
          {msg.text}
        </div>
      )}

      {/* Метрики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in-up">
        {[
          { label: "Статус", val: enabled ? "АКТИВЕН" : "СТОП", color: enabled ? "neon-text" : "text-[var(--cyber-text-dim)]", icon: "Bot" },
          { label: "Циклов запущено", val: String(cycleCount), color: "neon-text-cyan", icon: "RefreshCw" },
          { label: "Дневной P&L", val: `${(status?.daily_pnl ?? 0) >= 0 ? "+" : ""}${(status?.daily_pnl ?? 0).toFixed(0)} ₽`, color: (status?.daily_pnl ?? 0) >= 0 ? "profit" : "loss", icon: "TrendingUp" },
          { label: "Защита стоп", val: "−3% / день", color: "text-[var(--cyber-yellow)]", icon: "Shield" },
        ].map(s => (
          <div key={s.label} className="cyber-card rounded-none p-3 text-center">
            <Icon name={s.icon} size={13} className={`mx-auto mb-1 ${s.color}`} />
            <div className={`font-mono text-sm font-bold ${s.color}`}>{s.val}</div>
            <div className="section-label mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Серверный планировщик 24/7 — сразу после метрик */}
      <ServerCronPanel />

      {/* Правило продажи */}
      <div className="cyber-card rounded-none p-3 border border-[rgba(0,255,136,0.2)] animate-fade-in-up">
        <div className="flex items-start gap-2">
          <Icon name="TrendingUp" size={13} className="neon-text shrink-0 mt-0.5" />
          <div className="text-[11px] text-[var(--cyber-text-dim)] leading-relaxed">
            <span className="neon-text font-semibold">Логика бота: </span>
            покупает акции по сигналу RSI/EMA, <span className="text-[var(--cyber-green)]">продаёт только когда цена выше цены покупки</span> (минимум +0.5% прибыли). Убыточные позиции держит до выхода в плюс. За цикл проверяет до 30 случайных инструментов из всего рынка.
          </div>
        </div>
      </div>

      {/* Брокерский счёт */}
      {status?.accounts && status.accounts.length > 0 && (
        <div className="cyber-card rounded-none p-4 animate-fade-in-up">
          <div className="section-label mb-2">БРОКЕРСКИЙ СЧЁТ Т-БАНК</div>
          <select value={botAccountId} onChange={e => setBotAccountId(e.target.value)}
            className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-cyan)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)] appearance-none cursor-pointer">
            {status.accounts.map((a: { id: string; name: string }) => (
              <option key={a.id} value={a.id}>{a.name || a.id}</option>
            ))}
          </select>
          <div className="font-mono text-[10px] text-[var(--cyber-text-dim)] mt-1.5">
            Бот будет торговать с выбранного счёта. Сохрани настройки после выбора.
          </div>
        </div>
      )}

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
      <button onClick={runOnce} disabled={running}
        className="w-full py-3 font-orbitron text-xs font-bold border border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] hover:bg-[rgba(0,212,255,0.08)] rounded-none transition-all disabled:opacity-40 flex items-center justify-center gap-2 animate-fade-in-up">
        {running ? <><Spinner /><span>ПРОВЕРЯЮ СИГНАЛЫ И ТОРГУЮ...</span></> : <><Icon name="Zap" size={13} /><span>ЗАПУСТИТЬ ОДИН ЦИКЛ ВРУЧНУЮ</span></>}
      </button>

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

      </div>}

    </div>
  );
}

/* ===== SERVER CRON PANEL ===== */
function ServerCronPanel() {
  const [status, setStatus] = useState<{
    enabled: boolean; interval_min: number; last_ping: string;
    last_trade_run: string; cycle_count: number; status: string;
    autobot_enabled: boolean; tbank_scalp_enabled: boolean; bingx_scalp_enabled: boolean;
  } | null>(null);
  const [interval, setIntervalMin] = useState(15);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const loadStatus = () => {
    fetch(`${KEEPALIVE_URL}?action=status`)
      .then(r => r.json())
      .then(d => { setStatus(d); setIntervalMin(d.interval_min || 15); })
      .catch(() => {});
  };

  useEffect(() => {
    loadStatus();
    const t = setInterval(loadStatus, 15000);
    return () => clearInterval(t);
  }, []);

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 5000);
  };

  const toggleBot = async (bot: string, enabled: boolean) => {
    setToggling(bot);
    const r = await authFetch(KEEPALIVE_URL, {
      method: "POST",
      body: JSON.stringify({ action: "toggle_bot", bot, enabled }),
    }).then(r => r.json());
    setToggling(null);
    if (r.ok) loadStatus();
    else showMsg(r.error || "Ошибка", false);
  };

  const start = async () => {
    setLoading(true);
    const r = await authFetch(KEEPALIVE_URL, {
      method: "POST",
      body: JSON.stringify({ action: "start", interval_min: interval, self_url: KEEPALIVE_URL }),
    }).then(r => r.json());
    setLoading(false);
    if (r.ok) { showMsg(`✓ Планировщик запущен · каждые ${interval} мин`, true); loadStatus(); }
    else showMsg(r.error || "Ошибка", false);
  };

  const stop = async () => {
    setLoading(true);
    const r = await authFetch(KEEPALIVE_URL, {
      method: "POST", body: JSON.stringify({ action: "stop" }),
    }).then(r => r.json());
    setLoading(false);
    if (r.ok) { showMsg("Планировщик остановлен", false); loadStatus(); }
  };

  const runNow = async () => {
    setLoading(true);
    const r = await authFetch(KEEPALIVE_URL, {
      method: "POST", body: JSON.stringify({ action: "run_now" }),
    }).then(r => r.json());
    setLoading(false);
    if (r.ok) {
      const res = r.result || {};
      const trades = res.autobot?.trades || 0;
      const bought = res.scalper?.bought || 0;
      showMsg(`✓ Цикл выполнен · автобот: ${trades} сделок · скальпер: куплено ${bought}`, true);
      loadStatus();
    } else showMsg(r.error || "Ошибка", false);
  };

  const isRunning = status?.enabled && status?.status === "running";

  const fmtTime = (iso: string) => {
    if (!iso || iso.startsWith("1970")) return "—";
    try {
      return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { return "—"; }
  };

  return (
    <div className={`cyber-card rounded-none p-4 animate-fade-in-up space-y-3 border ${isRunning ? "border-[rgba(0,255,136,0.35)]" : "border-[rgba(0,212,255,0.2)]"}`}>
      {/* Заголовок */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="section-label flex items-center gap-2">
          <Icon name="Server" size={13} className="neon-text-cyan" />
          СЕРВЕРНЫЙ ПЛАНИРОВЩИК 24/7
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-[var(--cyber-green)] animate-pulse" : "bg-[var(--cyber-text-dim)]"}`} />
          <span className={isRunning ? "neon-text" : "text-[var(--cyber-text-dim)]"}>
            {isRunning ? "РАБОТАЕТ 24/7" : "ОСТАНОВЛЕН"}
          </span>
        </div>
      </div>

      <div className="text-[11px] text-[var(--cyber-text-dim)] leading-relaxed">
        Бот работает <span className="text-[var(--cyber-cyan)]">полностью на сервере домена</span> — без регистраций на сторонних сайтах. Закрой браузер, выключи компьютер — торговля продолжается 24/7.
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Последний тик", val: fmtTime(status?.last_ping || "") },
          { label: "Последняя торговля", val: fmtTime(status?.last_trade_run || "") },
          { label: "Циклов выполнено", val: String(status?.cycle_count ?? "—") },
        ].map(s => (
          <div key={s.label} className="bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] p-2 rounded-none">
            <div className="section-label text-[9px] mb-0.5">{s.label}</div>
            <div className="font-mono text-xs text-[var(--cyber-text)]">{s.val}</div>
          </div>
        ))}
      </div>

      {/* Боты — тоггл включения */}
      <div className="space-y-1">
        <div className="section-label mb-2">АКТИВНЫЕ БОТЫ В ПЛАНИРОВЩИКЕ</div>
        {[
          { key: "autobot",      label: "Автобот Т-Банк",   icon: "Bot",         desc: "Акции · 7:00–23:00 МСК", enabled: status?.autobot_enabled ?? false },
          { key: "tbank_scalp",  label: "Скальпер Т-Банк",  icon: "Zap",         desc: "Акции · RSI+EMA · 7:00–23:00 МСК", enabled: status?.tbank_scalp_enabled ?? false },
          { key: "bingx_scalp",  label: "Скальпер BingX",   icon: "BarChart2",   desc: "Крипто · RSI+объём · 24/7", enabled: status?.bingx_scalp_enabled ?? false },
        ].map(bot => (
          <div key={bot.key} className={`flex items-center justify-between p-2.5 border rounded-none transition-all ${bot.enabled ? "border-[rgba(0,255,136,0.3)] bg-[rgba(0,255,136,0.04)]" : "border-[var(--cyber-border)]"}`}>
            <div className="flex items-center gap-2">
              <Icon name={bot.icon} size={13} className={bot.enabled ? "neon-text" : "text-[var(--cyber-text-dim)]"} />
              <div>
                <div className={`font-mono text-xs font-semibold ${bot.enabled ? "text-[var(--cyber-text)]" : "text-[var(--cyber-text-dim)]"}`}>{bot.label}</div>
                <div className="font-mono text-[10px] text-[var(--cyber-text-dim)]">{bot.desc}</div>
              </div>
            </div>
            <button
              onClick={() => toggleBot(bot.key, !bot.enabled)}
              disabled={toggling === bot.key}
              className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0 ${bot.enabled ? "bg-[var(--cyber-green)]" : "bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)]"} disabled:opacity-50`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${bot.enabled ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Интервал */}
      <div className="flex items-center gap-3">
        <div className="section-label shrink-0">ИНТЕРВАЛ:</div>
        <div className="flex gap-1">
          {[5, 10, 15, 30].map(v => (
            <button key={v} onClick={() => setIntervalMin(v)}
              className={`px-2.5 py-1 font-mono text-xs border rounded-none transition-all ${interval === v ? "border-[var(--cyber-green)] text-[var(--cyber-green)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-cyan)]"}`}>
              {v}м
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className={`p-2 border font-mono text-xs rounded-none ${msg.ok ? "border-[var(--cyber-green)] profit" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
          {msg.text}
        </div>
      )}

      {/* Кнопки */}
      <div className="flex gap-2">
        {!isRunning ? (
          <button onClick={start} disabled={loading}
            className="flex-1 py-2.5 font-orbitron text-xs border border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.08)] rounded-none transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {loading ? <Spinner /> : <Icon name="Play" size={12} />}
            ЗАПУСТИТЬ 24/7
          </button>
        ) : (
          <button onClick={stop} disabled={loading}
            className="flex-1 py-2.5 font-orbitron text-xs border border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.08)] rounded-none transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {loading ? <Spinner /> : <Icon name="Square" size={12} />}
            ОСТАНОВИТЬ
          </button>
        )}
        <button onClick={runNow} disabled={loading}
          className="px-4 py-2.5 font-mono text-xs border border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] hover:bg-[rgba(0,212,255,0.08)] rounded-none transition-all disabled:opacity-40 flex items-center gap-1.5">
          <Icon name="RefreshCw" size={12} />
          Цикл сейчас
        </button>
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

/* ===== SETTINGS PAGE ===== */
function SettingsPage({ user, onLogout }: { user: { username: string; role: string }; onLogout: () => void }) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) { setMsg({ text: "Новый пароль минимум 6 символов", ok: false }); return; }
    if (newPw !== newPw2) { setMsg({ text: "Пароли не совпадают", ok: false }); return; }
    setLoading(true);
    try {
      const r = await authFetch(AUTH_URL, {
        method: "POST",
        body: JSON.stringify({ action: "change_password", old_password: oldPw, new_password: newPw }),
      });
      const d = await r.json();
      if (d.ok) {
        setMsg({ text: "✓ Пароль успешно изменён", ok: true });
        setOldPw(""); setNewPw(""); setNewPw2("");
      } else {
        setMsg({ text: d.error || "Ошибка", ok: false });
      }
    } catch { setMsg({ text: "Ошибка соединения", ok: false }); }
    setLoading(false);
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div className="space-y-4 max-w-md">

      {/* Информация об аккаунте */}
      <div className="cyber-card-glow rounded-none p-5 animate-fade-in-up">
        <div className="section-label mb-4">МОЙ АККАУНТ</div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center flex-shrink-0"
            style={{ border: "2px solid var(--cyber-green)", boxShadow: "0 0 15px rgba(0,255,136,0.3)" }}>
            <Icon name="User" size={22} style={{ color: "var(--cyber-green)" }} />
          </div>
          <div>
            <div className="font-orbitron text-base font-bold neon-text">{user.username.toUpperCase()}</div>
            <div className="section-label mt-0.5">{user.role === "admin" ? "Администратор" : "Пользователь"}</div>
          </div>
        </div>
      </div>

      {/* Смена пароля */}
      <form onSubmit={changePassword} className="cyber-card rounded-none p-5 animate-fade-in-up space-y-4">
        <div className="section-label">СМЕНА ПАРОЛЯ</div>

        {msg && (
          <div className={`p-3 border font-mono text-xs ${msg.ok ? "border-[var(--cyber-green)] profit" : "border-[var(--cyber-red)] loss"}`}>
            {msg.text}
          </div>
        )}

        {[
          { label: "Текущий пароль", val: oldPw, set: setOldPw, show: showOld, toggleShow: () => setShowOld(!showOld), placeholder: "Введи текущий пароль" },
          { label: "Новый пароль", val: newPw, set: setNewPw, show: showNew, toggleShow: () => setShowNew(!showNew), placeholder: "Минимум 6 символов" },
          { label: "Повтори новый пароль", val: newPw2, set: setNewPw2, show: showNew, toggleShow: () => {}, placeholder: "Повтори новый пароль" },
        ].map(f => (
          <div key={f.label}>
            <div className="section-label mb-1.5">{f.label}</div>
            <div className="relative">
              <input
                value={f.val}
                onChange={e => f.set(e.target.value)}
                type={f.show ? "text" : "password"}
                placeholder={f.placeholder}
                required
                className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2.5 pr-10 rounded-none outline-none focus:border-[var(--cyber-green)] transition-colors"
              />
              <button type="button" onClick={f.toggleShow}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cyber-text-dim)]">
                <Icon name={f.show ? "EyeOff" : "Eye"} size={13} />
              </button>
            </div>
          </div>
        ))}

        <button type="submit" disabled={loading || !oldPw || !newPw || !newPw2}
          className="w-full py-2.5 font-orbitron text-xs font-bold border border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.1)] rounded-none transition-all disabled:opacity-40 flex items-center justify-center gap-2">
          {loading ? <><Spinner /><span>СОХРАНЕНИЕ...</span></> : "СОХРАНИТЬ ПАРОЛЬ"}
        </button>
      </form>

      {/* Опасная зона */}
      <div className="cyber-card rounded-none p-5 animate-fade-in-up border border-[rgba(255,61,113,0.2)]">
        <div className="section-label mb-3 text-[var(--cyber-red)]">ОПАСНАЯ ЗОНА</div>
        <div className="text-[11px] text-[var(--cyber-text-dim)] mb-3">
          Выход завершит текущую сессию. Для доступа потребуется снова войти в систему.
        </div>
        <button onClick={onLogout}
          className="w-full py-2 font-mono text-xs border border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.1)] rounded-none transition-all flex items-center justify-center gap-2">
          <Icon name="LogOut" size={13} />
          ВЫЙТИ ИЗ СИСТЕМЫ
        </button>
      </div>

    </div>
  );
}

/* ===== PROFILE PAGE ===== */
function ProfilePage({ user }: { user: { username: string; role: string } }) {
  const [profile, setProfile] = useState<{ ref_code: string; has_tbank_token: boolean; has_binance_key: boolean; email: string; plan: string } | null>(null);
  const [tbankToken, setTbankToken] = useState("");
  const [binanceKey, setBinanceKey] = useState("");
  const [binanceSec, setBinanceSec] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    authFetch(`${AUTH_URL}?action=profile`).then(r => r.json()).then(d => { if (d.ok) setProfile(d.user); });
  }, []);

  const saveTokens = async () => {
    setSaving(true);
    const r = await authFetch(AUTH_URL, { method: "POST", body: JSON.stringify({ action: "save_tokens", tbank_token: tbankToken, binance_api_key: binanceKey, binance_secret_key: binanceSec }) });
    const d = await r.json();
    setMsg({ text: d.ok ? "✓ Токены сохранены" : d.error, ok: d.ok });
    if (d.ok) { setTbankToken(""); setBinanceKey(""); setBinanceSec(""); authFetch(`${AUTH_URL}?action=profile`).then(r => r.json()).then(d2 => { if (d2.ok) setProfile(d2.user); }); }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="space-y-4 max-w-lg">
      {/* Профиль */}
      <div className="cyber-card-glow rounded-none p-5 animate-fade-in-up">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 flex items-center justify-center" style={{ border: "2px solid var(--cyber-green)", boxShadow: "0 0 15px rgba(0,255,136,0.3)" }}>
            <Icon name="User" size={22} style={{ color: "var(--cyber-green)" }} />
          </div>
          <div>
            <div className="font-orbitron text-base font-bold neon-text">{user.username.toUpperCase()}</div>
            <div className="section-label">{user.role === "admin" ? "Администратор" : "Пользователь"} · {profile?.plan?.toUpperCase() || "FREE"}</div>
          </div>
        </div>
        {profile && (
          <div className="grid grid-cols-2 gap-3">
            <div className="cyber-card rounded-none p-3">
              <div className="section-label text-[10px] mb-1">Т-Банк токен</div>
              <div className={`font-mono text-sm font-semibold ${profile.has_tbank_token ? "neon-text" : "text-[var(--cyber-red)]"}`}>
                {profile.has_tbank_token ? "✓ Подключён" : "✗ Не добавлен"}
              </div>
            </div>
            <div className="cyber-card rounded-none p-3">
              <div className="section-label text-[10px] mb-1">Binance API</div>
              <div className={`font-mono text-sm font-semibold ${profile.has_binance_key ? "neon-text" : "text-[var(--cyber-red)]"}`}>
                {profile.has_binance_key ? "✓ Подключён" : "✗ Не добавлен"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Подписка */}
      {profile && <SubscribeButton currentPlan={profile.plan || "free"} />}

      {/* Токены */}
      {msg && <div className={`p-3 border font-mono text-xs ${msg.ok ? "border-[var(--cyber-green)] profit" : "border-[var(--cyber-red)] loss"}`}>{msg.text}</div>}
      <div className="cyber-card rounded-none p-5 space-y-3 animate-fade-in-up">
        <div className="section-label">ПОДКЛЮЧИТЬ ТОКЕНЫ И КЛЮЧИ</div>
        <div>
          <div className="section-label text-[10px] mb-1.5">Токен Т-Банк Invest</div>
          <div className="flex gap-2">
            <input value={tbankToken} onChange={e => setTbankToken(e.target.value)} type="password" placeholder="t.xxxxxxxxxxxxxxxx"
              className="flex-1 bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-xs px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-cyan)]" />
          </div>
          <div className="text-[10px] text-[var(--cyber-text-dim)] mt-1">invest.tbank.ru → Настройки → Токен для Open API</div>
        </div>
        <div>
          <div className="section-label text-[10px] mb-1.5">Binance API Key</div>
          <input value={binanceKey} onChange={e => setBinanceKey(e.target.value)} type="password" placeholder="API Key"
            className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-xs px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-cyan)]" />
        </div>
        <div>
          <div className="section-label text-[10px] mb-1.5">Binance Secret Key</div>
          <input value={binanceSec} onChange={e => setBinanceSec(e.target.value)} type="password" placeholder="Secret Key"
            className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-xs px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-cyan)]" />
        </div>
        <button onClick={saveTokens} disabled={saving || (!tbankToken && !binanceKey && !binanceSec)}
          className="w-full py-2.5 font-orbitron text-xs font-bold border border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.1)] rounded-none transition-all disabled:opacity-40 flex items-center justify-center gap-2">
          {saving ? <><Spinner /><span>СОХРАНЕНИЕ...</span></> : "ПРИМЕНИТЬ ТОКЕНЫ"}
        </button>
      </div>

      {/* Реф-код */}
      {profile?.ref_code && (
        <div className="cyber-card rounded-none p-4 border border-[rgba(0,212,255,0.2)] animate-fade-in-up">
          <div className="section-label mb-2">МОЙ РЕФЕРАЛЬНЫЙ КОД</div>
          <div className="flex items-center gap-3">
            <div className="font-orbitron text-xl font-black neon-text-cyan">{profile.ref_code}</div>
            <button onClick={() => navigator.clipboard.writeText(profile.ref_code)}
              className="px-3 py-1 font-mono text-xs border border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] rounded-none hover:bg-[rgba(0,212,255,0.08)] transition-all flex items-center gap-1">
              <Icon name="Copy" size={11} /> Копировать
            </button>
          </div>
          <div className="text-[11px] text-[var(--cyber-text-dim)] mt-2">Поделись кодом — получай % с каждой сделки приглашённых</div>
        </div>
      )}
    </div>
  );
}

interface ScalperPageProps {
  scalpEnabled: boolean; setScalpEnabled: (v: boolean) => void;
  scalpIntervalMin: number; setScalpIntervalMin: (v: number) => void;
  scalpCountdown: number; setScalpCountdown: (v: number) => void;
  scalpRunning: boolean; triggerScalpCycle: () => void;
  scalpMsg: { text: string; ok: boolean } | null;
}

const SCALP_INTERVALS = [
  { val: 5, label: "5 мин" },
  { val: 10, label: "10 мин" },
  { val: 15, label: "15 мин" },
  { val: 30, label: "30 мин" },
  { val: 60, label: "1 час" },
];

/* ===== SCALP HISTORY ===== */
function ScalpHistory({ trades }: { trades: { id: number; ticker: string; buy_price: number; sell_price: number; pnl: number; pnl_pct: number; status: string; opened_at: string }[] }) {
  if (trades.length === 0) {
    return (
      <div style={{ background: "var(--cyber-surface)", border: "1px solid var(--cyber-border)", padding: "2rem", textAlign: "center" }}>
        <div style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--cyber-text-dim)" }}>Сделок пока нет</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ fontFamily: "monospace", fontSize: "10px", color: "var(--cyber-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        ИСТОРИЯ СДЕЛОК · {trades.length} записей
      </div>
      {trades.map((t, idx) => {
        const pnl = t.pnl ?? 0;
        const isProfit = pnl >= 0;
        const isClosed = t.status === "closed";
        const col = isClosed ? (isProfit ? "var(--cyber-green)" : "var(--cyber-red)") : "var(--cyber-yellow)";
        return (
          <div key={t.id ?? idx} style={{ background: "var(--cyber-surface)", border: "1px solid var(--cyber-border)", borderLeft: `3px solid ${col}`, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: "bold", color: "var(--cyber-text)" }}>{t.ticker}</span>
              <span style={{ fontFamily: "'Orbitron', monospace", fontSize: "13px", fontWeight: "bold", color: col }}>
                {t.pnl != null ? `${pnl >= 0 ? "+" : ""}${Number(pnl).toFixed(2)} ₽` : "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontFamily: "monospace", fontSize: "10px", color: "var(--cyber-text-dim)" }}>
              <span>{isClosed ? (isProfit ? "✓ ПРИБЫЛЬ" : "✗ СТОП-ЛОСС") : "● ОТКРЫТА"}</span>
              <span>{t.opened_at ? new Date(t.opened_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===== SCALPER PAGE ===== */
function ScalperPage({ scalpEnabled, setScalpEnabled, scalpIntervalMin, setScalpIntervalMin, scalpCountdown, setScalpCountdown, scalpRunning, triggerScalpCycle, scalpMsg }: ScalperPageProps) {
  const [scStatus, setScStatus] = useState<{ open_trades: { id: number; ticker: string; buy_price: number; lots: number; amount: number; target_pct: number; stop_pct: number; opened_at: string }[]; trades_today: number; pnl_today: number; accounts: { id: string; name: string }[]; settings: { target_pct: number; stop_pct: number; amount: number; enabled: boolean; account_id: string } } | null>(null);
  const [history, setHistory] = useState<{ id: number; ticker: string; buy_price: number; sell_price: number; pnl: number; pnl_pct: number; status: string; opened_at: string; closed_at: string }[]>([]);
  const [candidates, setCandidates] = useState<{ figi: string; ticker: string; name: string; score: number; rsi: number; volatility: number; price: number; lot: number }[]>([]);
  const [scanning, setScanning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [targetPct, setTargetPct] = useState("1.0");
  const [stopPct, setStopPct] = useState("2.0");
  const [amount, setAmount] = useState("1000");
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"main" | "history">("main");

  const loadStatus = useCallback(async () => {
    try {
      const r = await authFetch(`${SCALPER_URL}?action=status`);
      const d = await r.json();
      if (!d.error) {
        setScStatus(d);
        if (d.settings?.target_pct) setTargetPct(String(d.settings.target_pct));
        if (d.settings?.stop_pct) setStopPct(String(d.settings.stop_pct));
        if (d.settings?.amount) setAmount(String(d.settings.amount));
        if (d.settings?.account_id) setAccountId(d.settings.account_id);
      }
    } catch { /* ignore */ }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const r = await authFetch(`${SCALPER_URL}?action=history`);
      const d = await r.json();
      setHistory(Array.isArray(d.trades) ? d.trades : []);
    } catch { setHistory([]); }
  }, []);

  useEffect(() => { loadStatus(); loadHistory(); }, [loadStatus, loadHistory]);
  useEffect(() => { if (activeTab === "history") loadHistory(); }, [activeTab, loadHistory]);

  const scan = async () => {
    setScanning(true); setCandidates([]);
    const r = await authFetch(`${SCALPER_URL}?action=scan`);
    const d = await r.json();
    setCandidates(d.candidates || []);
    setScanning(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    await authFetch(SCALPER_URL, { method: "POST", body: JSON.stringify({ action: "save_settings", target_pct: parseFloat(targetPct), stop_pct: parseFloat(stopPct), amount: parseFloat(amount), enabled: scalpEnabled, account_id: accountId }) });
    await loadStatus();
    setSaving(false);
    setMsg({ text: "✓ Настройки сохранены", ok: true });
    setTimeout(() => setMsg(null), 2000);
  };

  const runOnce = async () => {
    setMsg(null);
    triggerScalpCycle();
    setTimeout(() => { loadStatus(); loadHistory(); }, 3000);
  };

  const checkPositions = async () => {
    setChecking(true);
    const r = await authFetch(SCALPER_URL, { method: "POST", body: JSON.stringify({ action: "check_positions" }) });
    const d = await r.json();
    const sold = d.sold?.length || 0;
    setMsg({ text: sold > 0 ? `✓ Закрыто ${sold} позиций` : "Позиции проверены — нет сигналов на продажу", ok: true });
    await loadStatus();
    setChecking(false);
    setTimeout(() => setMsg(null), 4000);
  };

  const buyManual = async (figi: string, ticker: string, lots: number) => {
    const r = await authFetch(SCALPER_URL, { method: "POST", body: JSON.stringify({ action: "buy", figi, ticker, lots, target_pct: parseFloat(targetPct), stop_pct: parseFloat(stopPct) }) });
    const d = await r.json();
    setMsg({ text: d.ok ? `✓ Куплен ${ticker} · ${d.price?.toLocaleString("ru-RU")} ₽` : d.error, ok: d.ok });
    await loadStatus();
    setTimeout(() => setMsg(null), 4000);
  };

  const fmtCD = (s: number) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;

  return (
    <div className="space-y-4">
      {/* Шапка с таймером */}
      <div className="cyber-card-glow rounded-none p-4 animate-fade-in-up">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <div className="font-orbitron text-base font-bold flex items-center gap-2 text-[var(--cyber-text)]">
              <Icon name="Zap" size={16} className="text-[var(--cyber-yellow)]" />
              СКАЛЬПЕР — БЫСТРЫЙ ДОХОД
            </div>
            <div className="section-label mt-0.5">Краткосрочные сделки · Авто-продажа при достижении цели %</div>
          </div>
          <button onClick={() => { const ne = !scalpEnabled; setScalpEnabled(ne); if (ne) { setScalpCountdown(scalpIntervalMin * 60); setTimeout(() => triggerScalpCycle(), 500); } else setScalpCountdown(0); }}
            className={`px-4 py-2 font-orbitron text-xs font-bold border rounded-none transition-all ${scalpEnabled ? "border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.1)]" : "border-[var(--cyber-yellow)] text-[var(--cyber-yellow)] hover:bg-[rgba(255,200,0,0.1)]"}`}>
            {scalpEnabled ? "⏹ СТОП" : "⚡ СТАРТ"}
          </button>
        </div>
        {/* Интервал */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="section-label shrink-0">Интервал:</span>
          {SCALP_INTERVALS.map(iv => (
            <button key={iv.val} onClick={() => { setScalpIntervalMin(iv.val); if (scalpEnabled) setScalpCountdown(iv.val * 60); }} disabled={scalpEnabled}
              className={`px-2.5 py-1 font-mono text-xs rounded-none border transition-all disabled:opacity-50 ${scalpIntervalMin === iv.val ? "border-[var(--cyber-yellow)] text-[var(--cyber-yellow)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
              {iv.label}
            </button>
          ))}
        </div>
        {/* Прогресс-бар таймера */}
        {scalpEnabled && scalpCountdown > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] h-1.5 rounded-none overflow-hidden">
              <div className="h-full transition-all duration-1000"
                style={{ width: `${100 - (scalpCountdown / (scalpIntervalMin * 60) * 100)}%`, background: "var(--cyber-yellow)", boxShadow: "0 0 6px rgba(255,200,0,0.4)" }} />
            </div>
            <div className="font-orbitron text-sm font-bold text-[var(--cyber-yellow)] shrink-0">{fmtCD(scalpCountdown)}</div>
            <div className="section-label shrink-0">до цикла</div>
          </div>
        )}
      </div>

      {(msg || scalpMsg) && (
        <div className={`p-3 border font-mono text-xs animate-fade-in-up ${(msg || scalpMsg)!.ok ? "border-[var(--cyber-yellow)] text-[var(--cyber-yellow)]" : "border-[var(--cyber-red)] loss"}`}>
          {(msg || scalpMsg)!.text}
        </div>
      )}

      {/* Метрики */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in-up">
        <div className="cyber-card-glow rounded-none p-3 text-center">
          <div className="font-orbitron text-xl font-bold neon-text-cyan">{scStatus?.open_trades.length || 0}</div>
          <div className="section-label mt-0.5">Открытых</div>
        </div>
        <div className="cyber-card-glow rounded-none p-3 text-center">
          <div className="font-orbitron text-xl font-bold neon-text">{scStatus?.trades_today || 0}</div>
          <div className="section-label mt-0.5">Сделок сегодня</div>
        </div>
        <div className="cyber-card-glow rounded-none p-3 text-center">
          <div className={`font-orbitron text-xl font-bold ${(scStatus?.pnl_today || 0) >= 0 ? "neon-text" : "loss"}`}>
            {(scStatus?.pnl_today || 0) >= 0 ? "+" : ""}{(scStatus?.pnl_today || 0).toFixed(0)} ₽
          </div>
          <div className="section-label mt-0.5">P&L сегодня</div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-2 animate-fade-in-up">
        <button onClick={() => setActiveTab("main")}
          className={`px-3 py-1.5 font-mono text-xs rounded-none border transition-all ${activeTab === "main" ? "border-[var(--cyber-yellow)] text-[var(--cyber-yellow)] bg-[rgba(255,200,0,0.06)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
          ⚡ ТОРГОВЛЯ
        </button>
        <button onClick={() => { setActiveTab("history"); loadHistory(); }}
          className={`px-3 py-1.5 font-mono text-xs rounded-none border transition-all ${activeTab === "history" ? "border-[var(--cyber-yellow)] text-[var(--cyber-yellow)] bg-[rgba(255,200,0,0.06)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
          📋 ИСТОРИЯ
        </button>
      </div>

      {activeTab === "main" && (<>
        {/* Настройки */}
        <div className="cyber-card rounded-none p-4 animate-fade-in-up space-y-3">
          <div className="section-label">НАСТРОЙКИ</div>

          {/* Брокерский счёт */}
          {scStatus?.accounts && scStatus.accounts.length > 0 && (
            <div>
              <div className="section-label text-[10px] mb-1">Брокерский счёт Т-Банк</div>
              <select value={accountId} onChange={e => setAccountId(e.target.value)}
                className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-yellow)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-cyan)] appearance-none cursor-pointer">
                {scStatus.accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name || a.id}</option>
                ))}
              </select>
              <div className="font-mono text-[10px] text-[var(--cyber-text-dim)] mt-1">
                Выбери счёт, с которого скальпер будет торговать
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Цель прибыли %", val: targetPct, set: setTargetPct },
              { label: "Стоп-лосс %", val: stopPct, set: setStopPct },
            ].map(f => (
              <div key={f.label}>
                <div className="section-label text-[10px] mb-1">{f.label}</div>
                <input value={f.val} onChange={e => f.set(e.target.value)} type="number" step="0.1" min="0.1"
                  className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-yellow)]" />
              </div>
            ))}
          </div>
          <div>
            <div className="section-label text-[10px] mb-1">Сумма на сделку ₽</div>
            <input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="100"
              className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-yellow)]" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveSettings} disabled={saving} className="flex-1 py-2 font-mono text-xs border border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.08)] rounded-none transition-all disabled:opacity-40">
              {saving ? "..." : "СОХРАНИТЬ"}
            </button>
            <button onClick={runOnce} disabled={scalpRunning} className="flex-1 py-2 font-mono text-xs border border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] hover:bg-[rgba(0,212,255,0.08)] rounded-none transition-all disabled:opacity-40 flex items-center justify-center gap-1">
              {scalpRunning ? <Spinner /> : <Icon name="Zap" size={12} />} ЦИКЛ
            </button>
            <button onClick={scan} disabled={scanning} className="flex-1 py-2 font-mono text-xs border border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-cyan)] rounded-none transition-all disabled:opacity-40 flex items-center justify-center gap-1">
              {scanning ? <Spinner /> : <Icon name="Search" size={12} />} СКАН
            </button>
          </div>
        </div>

        {/* Кандидаты */}
        {candidates.length > 0 && (
          <div className="cyber-card rounded-none p-4 animate-fade-in-up">
            <div className="section-label mb-3">ТОП КАНДИДАТОВ</div>
            <div className="space-y-2">
              {candidates.map((c, i) => (
                <div key={c.figi} className="flex items-center justify-between py-2 border-b border-[rgba(26,58,74,0.4)]" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-0.5 font-orbitron text-xs font-black ${c.score >= 75 ? "text-[var(--cyber-green)]" : "text-[var(--cyber-yellow)]"}`}>{c.score}</div>
                    <div>
                      <div className="font-mono text-sm font-bold text-[var(--cyber-text)]">{c.ticker}</div>
                      <div className="section-label text-[10px]">RSI {c.rsi} · {c.price.toLocaleString("ru-RU")} ₽</div>
                    </div>
                  </div>
                  <button onClick={async () => {
                    const r = await authFetch(SCALPER_URL, { method: "POST", body: JSON.stringify({ action: "buy", figi: c.figi, ticker: c.ticker, lots: Math.max(1, Math.floor(parseFloat(amount) / (c.price * c.lot))), target_pct: parseFloat(targetPct), stop_pct: parseFloat(stopPct) }) });
                    const d = await r.json();
                    setMsg({ text: d.ok ? `✓ Куплен ${c.ticker}` : d.error, ok: d.ok });
                    loadStatus(); loadHistory();
                  }} className="px-3 py-1 font-mono text-xs border border-[var(--cyber-green)] text-[var(--cyber-green)] rounded-none hover:bg-[rgba(0,255,136,0.1)] transition-all">
                    КУПИТЬ
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Открытые позиции */}
        {scStatus && scStatus.open_trades.length > 0 && (
          <div className="cyber-card rounded-none p-4 animate-fade-in-up">
            <div className="section-label mb-3 flex items-center justify-between">
              <span>ОТКРЫТЫЕ ПОЗИЦИИ</span>
              <button onClick={async () => {
                setChecking(true);
                const r = await authFetch(SCALPER_URL, { method: "POST", body: JSON.stringify({ action: "check_positions" }) });
                const d = await r.json();
                setMsg({ text: `✓ Проверено · закрыто: ${d.sold?.length || 0}`, ok: true });
                loadStatus(); loadHistory(); setChecking(false);
                setTimeout(() => setMsg(null), 3000);
              }} disabled={checking} className="px-2 py-1 font-mono text-[10px] border border-[var(--cyber-yellow)] text-[var(--cyber-yellow)] rounded-none hover:bg-[rgba(255,200,0,0.08)] transition-all disabled:opacity-40">
                {checking ? "..." : "ПРОВЕРИТЬ"} 
              </button>
            </div>
            <div className="space-y-2">
              {scStatus.open_trades.map((t, i) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-[rgba(26,58,74,0.4)]" style={{ animationDelay: `${i * 50}ms` }}>
                  <div>
                    <div className="font-mono text-sm font-bold text-[var(--cyber-text)]">{t.ticker}</div>
                    <div className="section-label text-[10px]">{t.lots} лот · {t.buy_price.toLocaleString("ru-RU")} ₽</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs neon-text">+{t.target_pct}% цель</div>
                    <div className="font-mono text-xs text-[var(--cyber-red)]">−{t.stop_pct}% стоп</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>)}

      {/* История сделок */}
      {activeTab === "history" && (
        <ScalpHistory trades={history} />
      )}
    </div>
  );
}

/* ===== PAYMENT GATEWAY PANEL (admin) ===== */
function PaymentGatewayPanel() {
  const [status, setStatus] = useState<{
    robokassa: { connected: boolean; test_mode: boolean; login: string };
    yookassa:  { connected: boolean; shop_id: string };
    plans:     Record<string, { name: string; price_rub: number; desc: string }>;
  } | null>(null);
  const [webhookCopied, setWebhookCopied] = useState<string | null>(null);

  useEffect(() => {
    authFetch(`${PAYMENT_URL}?action=status`).then(r => r.json()).then(d => {
      if (d.robokassa) setStatus(d);
    });
  }, []);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setWebhookCopied(key);
    setTimeout(() => setWebhookCopied(null), 2000);
  };

  const RK_WEBHOOK  = `${PAYMENT_URL}?action=status`; // placeholder — реальный в POST body action=robokassa_webhook
  const RK_RESULT   = PAYMENT_URL.replace("?", "") + " (POST body: action=robokassa_webhook)";
  const YK_WEBHOOK  = PAYMENT_URL.replace("?", "") + " (POST body: action=yookassa_webhook)";

  return (
    <div className="cyber-card rounded-none p-4 border border-[rgba(0,212,255,0.2)] animate-fade-in-up space-y-4">
      <div className="flex items-center gap-2">
        <Icon name="CreditCard" size={14} className="neon-text-cyan" />
        <div className="section-label text-[var(--cyber-cyan)]">ПОДКЛЮЧЕНИЕ ПЛАТЁЖНЫХ СИСТЕМ (ADMIN)</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Robokassa */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status?.robokassa.connected ? "bg-[var(--cyber-green)]" : "bg-[var(--cyber-text-dim)]"}`} />
            <span className="font-orbitron text-xs font-bold text-[var(--cyber-text)]">ROBOKASSA</span>
            {status?.robokassa.connected && (
              <span className={`font-mono text-[10px] px-1.5 py-0.5 ${status.robokassa.test_mode ? "text-[var(--cyber-yellow)] border border-[rgba(255,200,0,0.3)]" : "text-[var(--cyber-green)] border border-[rgba(0,255,136,0.3)]"}`}>
                {status.robokassa.test_mode ? "ТЕСТ" : "БОЕВОЙ"}
              </span>
            )}
          </div>

          {status?.robokassa.connected ? (
            <div className="font-mono text-xs text-[var(--cyber-green)] p-2 border border-[rgba(0,255,136,0.2)]">
              ✓ Подключён · Логин: {status.robokassa.login}
            </div>
          ) : (
            <div className="font-mono text-xs text-[var(--cyber-text-dim)] p-2 border border-[var(--cyber-border)] leading-relaxed">
              Не подключён. Добавь секреты:<br/>
              <span className="text-[var(--cyber-yellow)]">ROBOKASSA_LOGIN, ROBOKASSA_PASS1, ROBOKASSA_PASS2</span>
            </div>
          )}

          <div className="space-y-2">
            <div className="section-label text-[10px]">НАСТРОЙКИ В ЛИЧНОМ КАБИНЕТЕ ROBOKASSA:</div>
            {[
              { label: "ResultURL (вебхук)", val: PAYMENT_URL, key: "rk_result" },
              { label: "SuccessURL",         val: "https://crypto-bot-profit.poehali.dev/", key: "rk_success" },
              { label: "FailURL",            val: "https://crypto-bot-profit.poehali.dev/", key: "rk_fail" },
            ].map(item => (
              <div key={item.key}>
                <div className="section-label text-[9px] mb-0.5">{item.label}</div>
                <div className="flex items-center gap-1">
                  <div className="flex-1 bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] px-2 py-1 font-mono text-[9px] text-[var(--cyber-cyan)] truncate">
                    {item.val}
                  </div>
                  <button onClick={() => copy(item.val, item.key)}
                    className="px-2 py-1 border border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-cyan)] transition-all font-mono text-[9px] flex-shrink-0">
                    {webhookCopied === item.key ? "✓" : "copy"}
                  </button>
                </div>
              </div>
            ))}
            <div className="font-mono text-[9px] text-[var(--cyber-text-dim)] leading-relaxed p-2 border border-[var(--cyber-border)]">
              В настройках Robokassa установи метод отправки ResultURL: <span className="text-[var(--cyber-yellow)]">POST</span>.
              В поле "Метод кодирования" выбери <span className="text-[var(--cyber-yellow)]">MD5</span>.
            </div>
          </div>
        </div>

        {/* ЮKassa */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status?.yookassa.connected ? "bg-[var(--cyber-green)]" : "bg-[var(--cyber-text-dim)]"}`} />
            <span className="font-orbitron text-xs font-bold text-[var(--cyber-text)]">ЮKASSA</span>
          </div>

          {status?.yookassa.connected ? (
            <div className="font-mono text-xs text-[var(--cyber-green)] p-2 border border-[rgba(0,255,136,0.2)]">
              ✓ Подключён · Shop ID: {status.yookassa.shop_id}
            </div>
          ) : (
            <div className="font-mono text-xs text-[var(--cyber-text-dim)] p-2 border border-[var(--cyber-border)] leading-relaxed">
              Не подключён. Добавь секреты:<br/>
              <span className="text-[var(--cyber-yellow)]">YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY</span>
            </div>
          )}

          <div className="space-y-2">
            <div className="section-label text-[10px]">НАСТРОЙКИ В ЛИЧНОМ КАБИНЕТЕ ЮKASSA:</div>
            {[
              { label: "URL для уведомлений (webhook)", val: PAYMENT_URL, key: "yk_webhook" },
              { label: "URL возврата",                  val: "https://crypto-bot-profit.poehali.dev/", key: "yk_return" },
            ].map(item => (
              <div key={item.key}>
                <div className="section-label text-[9px] mb-0.5">{item.label}</div>
                <div className="flex items-center gap-1">
                  <div className="flex-1 bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] px-2 py-1 font-mono text-[9px] text-[var(--cyber-cyan)] truncate">
                    {item.val}
                  </div>
                  <button onClick={() => copy(item.val, item.key)}
                    className="px-2 py-1 border border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-cyan)] transition-all font-mono text-[9px] flex-shrink-0">
                    {webhookCopied === item.key ? "✓" : "copy"}
                  </button>
                </div>
              </div>
            ))}
            <div className="font-mono text-[9px] text-[var(--cyber-text-dim)] leading-relaxed p-2 border border-[var(--cyber-border)]">
              В ЮKassa: Настройки → HTTP-уведомления → добавь URL выше.
              Выбери события: <span className="text-[var(--cyber-yellow)]">payment.succeeded</span>.
            </div>
          </div>
        </div>
      </div>

      {/* Тарифы */}
      {status?.plans && (
        <div>
          <div className="section-label text-[10px] mb-2">ТЕКУЩИЕ ТАРИФЫ</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(status.plans).map(([key, p]) => (
              <div key={key} className="border border-[var(--cyber-border)] p-2 font-mono text-xs">
                <span className="text-[var(--cyber-cyan)] font-bold">{p.name}</span>
                <span className="text-[var(--cyber-text-dim)]"> — </span>
                <span className="text-[var(--cyber-text)]">{p.price_rub} ₽/мес</span>
                <div className="text-[10px] text-[var(--cyber-text-dim)] mt-0.5">{p.desc}</div>
              </div>
            ))}
          </div>
          <div className="font-mono text-[10px] text-[var(--cyber-text-dim)] mt-2">
            Цены можно изменить выше в блоке «Монетизация платформы».
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== SUBSCRIBE BUTTON (для пользователей) ===== */
function SubscribeButton({ currentPlan }: { currentPlan: string }) {
  const [open, setOpen]       = useState(false);
  const [selected, setSelected] = useState<PlanKey>("pro");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<"robokassa" | "yookassa">("robokassa");
  const [payStatus, setPayStatus] = useState<{ robokassa: boolean; yookassa: boolean }>({ robokassa: false, yookassa: false });
  const [msg, setMsg]         = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    authFetch(`${PAYMENT_URL}?action=status`).then(r => r.json()).then(d => {
      if (d.robokassa) setPayStatus({ robokassa: d.robokassa.connected, yookassa: d.yookassa.connected });
    });
  }, []);

  const pay = async () => {
    if (!payStatus.robokassa && !payStatus.yookassa) {
      setMsg({ text: "Платёжные системы не подключены. Напишите администратору.", ok: false });
      return;
    }
    setLoading(true);
    const r = await authFetch(PAYMENT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "create_payment", plan: selected, provider, return_url: window.location.href }),
    });
    const d = await r.json();
    setLoading(false);
    if (d.ok && d.payment_url) {
      window.location.href = d.payment_url;
    } else {
      setMsg({ text: d.error || "Ошибка создания платежа", ok: false });
      setTimeout(() => setMsg(null), 4000);
    }
  };

  // Активная подписка
  if (currentPlan !== "free") {
    const info = PLAN_INFO[currentPlan as PlanKey] ?? PLAN_INFO.free;
    return (
      <div className="cyber-card rounded-none p-4 border animate-fade-in-up" style={{ borderColor: `${info.color}44` }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-orbitron text-xs font-bold" style={{ color: info.color }}>✓ {info.name} — активна</div>
            <div className="font-mono text-[10px] text-[var(--cyber-text-dim)] mt-0.5">{info.price} ₽/мес</div>
          </div>
          <Icon name="CheckCircle" size={20} style={{ color: info.color }} />
        </div>
        <ul className="space-y-1">
          {info.features.map(f => (
            <li key={f.text} className={`font-mono text-[10px] flex items-center gap-1.5 ${f.ok ? "text-[var(--cyber-text-dim)]" : "opacity-30 line-through"}`}>
              <span style={{ color: f.ok ? info.color : "transparent" }}>✓</span> {f.text}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button onClick={() => setOpen(!open)}
        className="w-full py-3 font-orbitron text-xs font-bold border-2 border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] hover:bg-[rgba(0,212,255,0.08)] rounded-none transition-all flex items-center justify-center gap-2"
        style={{ boxShadow: open ? "0 0 15px rgba(0,212,255,0.2)" : "none" }}>
        <Icon name="Star" size={13} /> ОФОРМИТЬ ПОДПИСКУ
      </button>

      {open && (
        <div className="animate-fade-in-up space-y-3">
          {msg && <div className={`p-2 border font-mono text-xs ${msg.ok ? "border-[var(--cyber-green)] profit" : "border-[var(--cyber-red)] loss"}`}>{msg.text}</div>}

          {/* Карточки тарифов */}
          <div className="grid grid-cols-2 gap-2">
            {(["basic", "pro"] as PlanKey[]).map(key => {
              const p = PLAN_INFO[key];
              const isSelected = selected === key;
              return (
                <button key={key} onClick={() => setSelected(key)}
                  className="rounded-none p-3 text-left border-2 transition-all"
                  style={{ borderColor: isSelected ? p.color : "var(--cyber-border)", background: isSelected ? `${p.color}11` : "transparent" }}>
                  {p.badge && <div className="font-mono text-[9px] mb-1" style={{ color: p.color }}>{p.badge}</div>}
                  <div className="font-orbitron text-xs font-black" style={{ color: p.color }}>{p.name}</div>
                  <div className="font-orbitron text-lg font-black text-[var(--cyber-text)] mt-0.5">{p.price} ₽<span className="font-mono text-[9px] text-[var(--cyber-text-dim)]">/мес</span></div>
                  <ul className="mt-2 space-y-0.5">
                    {p.features.map(f => (
                      <li key={f.text} className={`font-mono text-[9px] flex items-start gap-1 ${f.ok ? "text-[var(--cyber-text-dim)]" : "opacity-25 line-through"}`}>
                        <span className="flex-shrink-0" style={{ color: f.ok ? p.color : "transparent" }}>✓</span>
                        {f.text}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {/* Способ оплаты */}
          {(payStatus.robokassa || payStatus.yookassa) && (
            <div className="flex gap-2">
              {payStatus.robokassa && (
                <button onClick={() => setProvider("robokassa")}
                  className={`flex-1 py-1.5 font-mono text-xs border rounded-none transition-all ${provider === "robokassa" ? "border-[var(--cyber-cyan)] text-[var(--cyber-cyan)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
                  Robokassa
                </button>
              )}
              {payStatus.yookassa && (
                <button onClick={() => setProvider("yookassa")}
                  className={`flex-1 py-1.5 font-mono text-xs border rounded-none transition-all ${provider === "yookassa" ? "border-[var(--cyber-cyan)] text-[var(--cyber-cyan)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
                  ЮKassa
                </button>
              )}
            </div>
          )}

          <button onClick={pay} disabled={loading}
            className="w-full py-3 font-orbitron text-xs font-bold rounded-none transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ border: `2px solid ${PLAN_INFO[selected].color}`, color: PLAN_INFO[selected].color, background: `${PLAN_INFO[selected].color}11` }}>
            {loading ? <><div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" /><span>...</span></> : <>
              <Icon name="CreditCard" size={13} />
              ОПЛАТИТЬ {PLAN_INFO[selected].price} ₽ / МЕС
            </>}
          </button>

          {!payStatus.robokassa && !payStatus.yookassa && (
            <div className="font-mono text-[10px] text-[var(--cyber-text-dim)] p-2 border border-[var(--cyber-border)] text-center">
              Платёжные системы временно не настроены.<br/>Для подключения напишите администратору.
            </div>
          )}
          <div className="font-mono text-[9px] text-[var(--cyber-text-dim)] text-center">
            🔒 Подписка активируется автоматически после оплаты · 30 дней
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== REFERRAL PAGE ===== */
function ReferralPage({ user }: { user: { username: string; role: string } }) {
  const [stats, setStats] = useState<{ ref_code: string; ref_count: number; refs: { id: number; username: string; joined: string }[]; total_earned: number } | null>(null);
  const [adminUsers, setAdminUsers] = useState<{ id: number; username: string; email: string; role: string; plan: string; ref_code: string; is_active: boolean; created_at: string; ref_earn: number; platform_earn: number }[]>([]);
  const [revenue, setRevenue] = useState<{ revenue_total: number; revenue_today: number; revenue_month: number; ref_total: number; by_source: { source: string; total: number; cnt: number }[]; subscriptions: { plan: string; cnt: number }[]; settings: Record<string, string> } | null>(null);
  const [refPct, setRefPct] = useState("0.5");
  const [refMode, setRefMode] = useState("trade_amount");
  const [feePct, setFeePct] = useState("0.3");
  const [priceBasic, setPriceBasic] = useState("490");
  const [pricePro, setPricePro] = useState("990");
  const [saving, setSaving] = useState(false);
  const [savingMon, setSavingMon] = useState(false);
  const [settingPlan, setSettingPlan] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    authFetch(`${AUTH_URL}?action=ref_stats`).then(r => r.json()).then(d => { if (d.ok) setStats(d); });
    if (user.role === "admin") {
      authFetch(`${AUTH_URL}?action=admin_users`).then(r => r.json()).then(d => {
        if (d.ok) setAdminUsers(d.users);
      });
      authFetch(`${AUTH_URL}?action=admin_revenue`).then(r => r.json()).then(d => {
        if (d.ok) {
          setRevenue(d);
          if (d.settings?.ref_earn_pct) setRefPct(d.settings.ref_earn_pct);
          if (d.settings?.platform_fee_pct) setFeePct(d.settings.platform_fee_pct);
          if (d.settings?.price_basic_rub) setPriceBasic(d.settings.price_basic_rub);
          if (d.settings?.price_pro_rub) setPricePro(d.settings.price_pro_rub);
        }
      });
    }
  }, [user.role]);

  const saveRefSettings = async () => {
    setSaving(true);
    const r = await authFetch(AUTH_URL, { method: "POST", body: JSON.stringify({ action: "save_ref_settings", ref_earn_pct: parseFloat(refPct), ref_earn_mode: refMode }) });
    const d = await r.json();
    setMsg({ text: d.ok ? "✓ Настройки сохранены" : d.error, ok: d.ok });
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  const saveMonetization = async () => {
    setSavingMon(true);
    const r = await authFetch(AUTH_URL, { method: "POST", body: JSON.stringify({ action: "save_monetization", platform_fee_pct: feePct, price_basic_rub: priceBasic, price_pro_rub: pricePro }) });
    const d = await r.json();
    setMsg({ text: d.ok ? "✓ Монетизация сохранена" : d.error, ok: d.ok });
    setSavingMon(false);
    setTimeout(() => setMsg(null), 3000);
  };

  const setUserPlan = async (userId: number, plan: string) => {
    setSettingPlan(userId);
    await authFetch(AUTH_URL, { method: "POST", body: JSON.stringify({ action: "set_user_plan", user_id: userId, plan }) });
    setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, plan } : u));
    setSettingPlan(null);
  };

  return (
    <div className="space-y-4">
      {/* Мой реф-код и доход */}
      <div className="cyber-card-glow rounded-none p-5 animate-fade-in-up">
        <div className="section-label mb-3">МОЯ РЕФЕРАЛЬНАЯ ПРОГРАММА</div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="font-orbitron text-2xl font-black neon-text-cyan">{stats?.ref_count || 0}</div>
            <div className="section-label mt-0.5">Рефералов</div>
          </div>
          <div className="text-center">
            <div className="font-orbitron text-2xl font-black neon-text">+{(stats?.total_earned || 0).toFixed(2)} ₽</div>
            <div className="section-label mt-0.5">Заработано</div>
          </div>
          <div className="text-center">
            <div className="font-orbitron text-lg font-black text-[var(--cyber-yellow)]">{stats?.ref_code || "—"}</div>
            <div className="section-label mt-0.5">Мой код</div>
          </div>
        </div>
        {stats?.ref_code && (
          <div className="flex gap-2">
            <div className="flex-1 bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] px-3 py-2 font-mono text-sm text-[var(--cyber-cyan)]">{stats.ref_code}</div>
            <button onClick={() => navigator.clipboard.writeText(stats.ref_code)} className="px-3 py-2 border border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] rounded-none hover:bg-[rgba(0,212,255,0.08)] transition-all font-mono text-xs flex items-center gap-1">
              <Icon name="Copy" size={12} /> Копировать
            </button>
          </div>
        )}
      </div>

      {/* Список рефералов */}
      {stats && stats.refs.length > 0 && (
        <div className="cyber-card rounded-none p-4 animate-fade-in-up">
          <div className="section-label mb-3">МОИ РЕФЕРАЛЫ</div>
          <div className="space-y-2">
            {stats.refs.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-[rgba(26,58,74,0.4)]" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="font-mono text-sm text-[var(--cyber-text)]">{r.username}</div>
                <div className="section-label text-[10px]">{new Date(r.joined).toLocaleDateString("ru-RU")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ADMIN: Доход платформы ── */}
      {user.role === "admin" && revenue && (
        <div className="cyber-card-glow rounded-none p-4 animate-fade-in-up border border-[rgba(255,200,0,0.3)]">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="TrendingUp" size={14} className="text-[var(--cyber-yellow)]" />
            <div className="section-label text-[var(--cyber-yellow)]">ДОХОД ПЛАТФОРМЫ</div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "За сегодня", val: revenue.revenue_today, color: "neon-text" },
              { label: "За месяц",   val: revenue.revenue_month, color: "neon-text-cyan" },
              { label: "Всего",      val: revenue.revenue_total, color: "text-[var(--cyber-yellow)]" },
              { label: "Рефералы",   val: revenue.ref_total,     color: "profit" },
            ].map(s => (
              <div key={s.label} className="cyber-card rounded-none p-3 text-center">
                <div className={`font-orbitron text-lg font-bold ${s.color}`}>{s.val.toFixed(2)} ₽</div>
                <div className="section-label mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          {/* По источникам */}
          {revenue.by_source.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {revenue.by_source.map(s => (
                <div key={s.source} className="flex items-center justify-between font-mono text-xs">
                  <span className="text-[var(--cyber-text-dim)]">{s.source === "trade_fee" ? "Комиссия со сделок" : s.source === "subscription" ? "Подписки" : s.source} ({s.cnt} шт)</span>
                  <span className="neon-text font-bold">+{s.total.toFixed(2)} ₽</span>
                </div>
              ))}
            </div>
          )}
          {/* Подписки */}
          {revenue.subscriptions.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {revenue.subscriptions.map(s => (
                <div key={s.plan} className="border border-[var(--cyber-cyan)] px-2 py-1 font-mono text-[10px] text-[var(--cyber-cyan)]">
                  {s.plan.toUpperCase()} × {s.cnt}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ADMIN: Настройки монетизации ── */}
      {user.role === "admin" && (
        <div className="cyber-card rounded-none p-4 border border-[rgba(255,200,0,0.2)] animate-fade-in-up space-y-3">
          <div className="section-label text-[var(--cyber-yellow)]">МОНЕТИЗАЦИЯ ПЛАТФОРМЫ (ADMIN)</div>
          {msg && <div className={`p-2 border font-mono text-xs ${msg.ok ? "border-[var(--cyber-green)] profit" : "border-[var(--cyber-red)] loss"}`}>{msg.text}</div>}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="section-label text-[10px] mb-1">Комиссия % со сделки</div>
              <input value={feePct} onChange={e => setFeePct(e.target.value)} type="number" step="0.01" min="0" max="5"
                className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-yellow)]" />
            </div>
            <div>
              <div className="section-label text-[10px] mb-1">BASIC ₽/мес</div>
              <input value={priceBasic} onChange={e => setPriceBasic(e.target.value)} type="number" min="0"
                className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-yellow)]" />
            </div>
            <div>
              <div className="section-label text-[10px] mb-1">PRO ₽/мес</div>
              <input value={pricePro} onChange={e => setPricePro(e.target.value)} type="number" min="0"
                className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-yellow)]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="section-label text-[10px] mb-1">% реф. начислений</div>
              <input value={refPct} onChange={e => setRefPct(e.target.value)} type="number" step="0.01" min="0"
                className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-yellow)]" />
            </div>
            <div>
              <div className="section-label text-[10px] mb-1">Тип начисления</div>
              <select value={refMode} onChange={e => setRefMode(e.target.value)} className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-yellow)]">
                <option value="trade_amount">% от суммы сделки</option>
                <option value="profit_only">% от прибыли</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveMonetization} disabled={savingMon} className="flex-1 py-2 font-mono text-xs border border-[var(--cyber-yellow)] text-[var(--cyber-yellow)] hover:bg-[rgba(255,200,0,0.08)] rounded-none transition-all disabled:opacity-40">
              {savingMon ? "..." : "💰 СОХРАНИТЬ МОНЕТИЗАЦИЮ"}
            </button>
            <button onClick={saveRefSettings} disabled={saving} className="flex-1 py-2 font-mono text-xs border border-[var(--cyber-cyan)] text-[var(--cyber-cyan)] hover:bg-[rgba(0,212,255,0.08)] rounded-none transition-all disabled:opacity-40">
              {saving ? "..." : "👥 РЕФЕРАЛЬНАЯ"}
            </button>
          </div>
        </div>
      )}

      {/* ── ADMIN: Подключение платёжек ── */}
      {user.role === "admin" && (
        <PaymentGatewayPanel />
      )}

      {/* ── ADMIN: Все пользователи + подписки ── */}
      {user.role === "admin" && adminUsers.length > 0 && (
        <div className="cyber-card rounded-none p-4 animate-fade-in-up">
          <div className="section-label mb-3">ВСЕ ПОЛЬЗОВАТЕЛИ · {adminUsers.length}</div>
          <div className="space-y-2">
            {adminUsers.map(u => (
              <div key={u.id} className="border border-[var(--cyber-border)] p-3 hover:border-[var(--cyber-yellow)] transition-all">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-[var(--cyber-text-dim)]">#{u.id}</span>
                    <span className="font-mono text-sm font-bold text-[var(--cyber-text)] truncate">{u.username}</span>
                    <span className={`font-mono text-[10px] px-1.5 py-0.5 ${u.plan === "pro" ? "bg-[rgba(255,200,0,0.15)] text-[var(--cyber-yellow)]" : u.plan === "basic" ? "bg-[rgba(0,212,255,0.1)] text-[var(--cyber-cyan)]" : "text-[var(--cyber-text-dim)]"}`}>
                      {(u.plan || "free").toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(["free","basic","pro"] as const).map(p => (
                      <button key={p} onClick={() => setUserPlan(u.id, p)} disabled={settingPlan === u.id || u.plan === p}
                        className={`px-2 py-0.5 font-mono text-[10px] border rounded-none transition-all disabled:opacity-40 ${u.plan === p ? "border-[var(--cyber-green)] text-[var(--cyber-green)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-yellow)]"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4 mt-1.5 font-mono text-[10px] text-[var(--cyber-text-dim)]">
                  <span>Реф: <span className="text-[var(--cyber-cyan)]">{u.ref_code || "—"}</span></span>
                  <span>Платформа: <span className={u.platform_earn > 0 ? "neon-text" : ""}>{u.platform_earn?.toFixed(2) ?? "0"} ₽</span></span>
                  <span>Реф.доход: <span className={u.ref_earn > 0 ? "profit" : ""}>{u.ref_earn?.toFixed(2) ?? "0"} ₽</span></span>
                  <span>{new Date(u.created_at).toLocaleDateString("ru-RU")}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="p-3 border border-[rgba(0,255,136,0.2)] font-mono text-xs text-center">
              <div className="neon-text font-bold text-base">{adminUsers.reduce((a, u) => a + (u.platform_earn ?? 0), 0).toFixed(2)} ₽</div>
              <div className="section-label">Итого комиссий</div>
            </div>
            <div className="p-3 border border-[rgba(0,212,255,0.2)] font-mono text-xs text-center">
              <div className="neon-text-cyan font-bold text-base">{adminUsers.filter(u => u.plan !== "free").length}</div>
              <div className="section-label">Платных подписок</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== BINGX PAGE ===== */
const BINGX_URL = "https://functions.poehali.dev/fa611271-a7e0-4dfe-868f-3f1b55a81df7";

function BingXPage() {
  const [tab, setTab] = useState<"keys" | "balance" | "spot" | "futures" | "scalper">("keys");
  const [hasKeys, setHasKeys] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [keyPreview, setKeyPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Баланс
  const [balances, setBalances] = useState<{ asset: string; free: string; locked: string }[]>([]);
  const [futBal, setFutBal] = useState<{ balance?: string; equity?: string; unrealizedProfit?: string } | null>(null);
  const [loadingBal, setLoadingBal] = useState(false);

  // Спот
  const [tickers, setTickers] = useState<{ symbol: string; lastPrice: string; priceChangePercent: string; quoteVolume: string }[]>([]);
  const [spotSym, setSpotSym] = useState("BTC-USDT");
  const [spotAmt, setSpotAmt] = useState("20");
  const [spotLoading, setSpotLoading] = useState(false);
  const [spotHistory, setSpotHistory] = useState<{ id: number; symbol: string; side: string; quantity: number; price: number; pnl: number | null; status: string; created_at: string }[]>([]);

  // Фьючерсы
  const [positions, setPositions] = useState<{ symbol: string; positionSide: string; positionAmt: string; entryPrice: string; unrealizedProfit: string; leverage: string }[]>([]);
  const [futSym, setFutSym] = useState("BTC-USDT");
  const [futSide, setFutSide] = useState("BUY");
  const [futAmt, setFutAmt] = useState("10");
  const [futLev, setFutLev] = useState("10");
  const [futLoading, setFutLoading] = useState(false);

  // Скальпер
  const [scalpAmt, setScalpAmt] = useState("20");
  const [scalpTarget, setScalpTarget] = useState("0.8");
  const [scalpStop, setScalpStop] = useState("1.5");
  const [scalpRunning, setScalpRunning] = useState(false);
  const [scalpMsg, setScalpMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    authFetch(`${BINGX_URL}?action=check_keys`).then(r => r.json()).then(d => {
      setHasKeys(d.has_keys);
      setKeyPreview(d.api_key_preview || "");
      if (d.has_keys) setTab("balance");
    }).catch(() => {});
  }, []);

  const saveKeys = async () => {
    if (!apiKey || !secretKey) return;
    setSaving(true); setMsg(null);
    const r = await authFetch(BINGX_URL, { method: "POST", body: JSON.stringify({ action: "save_keys", api_key: apiKey, secret_key: secretKey }) });
    const d = await r.json();
    setSaving(false);
    if (d.ok) { setHasKeys(true); setKeyPreview(apiKey.slice(0, 8) + "..."); setMsg({ text: "Ключи сохранены!", ok: true }); setTab("balance"); }
    else setMsg({ text: d.error || "Ошибка", ok: false });
  };

  const loadBalance = async () => {
    setLoadingBal(true);
    const [sb, fb] = await Promise.all([
      authFetch(`${BINGX_URL}?action=balance`).then(r => r.json()),
      authFetch(`${BINGX_URL}?action=futures_balance`).then(r => r.json()),
    ]);
    if (sb.ok) setBalances(sb.balances || []);
    if (fb.ok) setFutBal(fb.data);
    setLoadingBal(false);
  };

  const loadSpot = async () => {
    setSpotLoading(true);
    const [tr, hr] = await Promise.all([
      authFetch(`${BINGX_URL}?action=spot_tickers`).then(r => r.json()),
      authFetch(`${BINGX_URL}?action=spot_history`).then(r => r.json()),
    ]);
    if (tr.ok) setTickers(tr.tickers || []);
    if (hr.ok) setSpotHistory(hr.trades || []);
    setSpotLoading(false);
  };

  const loadFutures = async () => {
    setFutLoading(true);
    const r = await authFetch(`${BINGX_URL}?action=futures_positions`).then(r => r.json());
    if (r.ok) setPositions(r.positions || []);
    setFutLoading(false);
  };

  useEffect(() => {
    if (!hasKeys) return;
    if (tab === "balance") loadBalance();
    if (tab === "spot") loadSpot();
    if (tab === "futures") loadFutures();
   
  }, [tab, hasKeys]);

  const spotBuy = async () => {
    setSpotLoading(true); setMsg(null);
    const r = await authFetch(BINGX_URL, { method: "POST", body: JSON.stringify({ action: "spot_buy", symbol: spotSym, amount: parseFloat(spotAmt) }) }).then(r => r.json());
    setSpotLoading(false);
    if (r.ok) { setMsg({ text: `✓ Куплено ${spotSym} на $${spotAmt}`, ok: true }); loadSpot(); }
    else setMsg({ text: r.error || "Ошибка", ok: false });
  };

  const openFutures = async () => {
    setFutLoading(true); setMsg(null);
    const r = await authFetch(BINGX_URL, { method: "POST", body: JSON.stringify({ action: "futures_open", symbol: futSym, side: futSide, amount: parseFloat(futAmt), leverage: parseInt(futLev) }) }).then(r => r.json());
    setFutLoading(false);
    if (r.ok) { setMsg({ text: `✓ Открыт ${futSide === "BUY" ? "LONG" : "SHORT"} ${futSym}`, ok: true }); loadFutures(); }
    else setMsg({ text: r.error || "Ошибка", ok: false });
  };

  const closeFutures = async (sym: string, posSide: string, amt: string) => {
    const r = await authFetch(BINGX_URL, { method: "POST", body: JSON.stringify({ action: "futures_close", symbol: sym, pos_side: posSide, amount: parseFloat(amt) }) }).then(r => r.json());
    if (r.ok) { setMsg({ text: `✓ Позиция ${sym} закрыта`, ok: true }); loadFutures(); }
    else setMsg({ text: r.error || "Ошибка", ok: false });
  };

  const runScalp = async () => {
    setScalpRunning(true); setScalpMsg(null);
    await authFetch(BINGX_URL, { method: "POST", body: JSON.stringify({ action: "save_scalp_settings", bingx_scalp_amount: scalpAmt, bingx_scalp_target: scalpTarget, bingx_scalp_stop: scalpStop }) });
    const r = await authFetch(BINGX_URL, { method: "POST", body: JSON.stringify({ action: "scalp_cycle" }) }).then(r => r.json());
    setScalpRunning(false);
    if (r.ok) setScalpMsg({ text: `⚡ Куплено: ${r.bought?.length || 0} · Продано: ${r.sold?.length || 0} · Открытых: ${r.open_count || 0}`, ok: true });
    else setScalpMsg({ text: r.error || "Ошибка", ok: false });
  };

  const TABS = [
    { id: "keys", label: "API Ключи", icon: "Key" },
    { id: "balance", label: "Баланс", icon: "Wallet" },
    { id: "spot", label: "Спот", icon: "ShoppingCart" },
    { id: "futures", label: "Фьючерсы", icon: "TrendingUp" },
    { id: "scalper", label: "Скальпинг", icon: "Zap" },
  ] as const;

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Шапка */}
      <div className="cyber-card-glow rounded-none p-4 flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ border: "1px solid var(--cyber-green)", boxShadow: "0 0 12px rgba(0,255,136,0.3)" }}>
          <Icon name="BarChart2" size={20} style={{ color: "var(--cyber-green)" }} />
        </div>
        <div>
          <div className="font-orbitron text-base font-bold neon-text">BINGX</div>
          <div className="text-[11px] font-mono text-[var(--cyber-text-dim)]">
            {hasKeys ? `Подключено · ${keyPreview}` : "Требуются API ключи"}
          </div>
        </div>
        {hasKeys && <div className="ml-auto flex items-center gap-1.5"><div className="status-dot online" /><span className="font-mono text-[11px] text-[var(--cyber-green)]">ONLINE</span></div>}
      </div>

      {/* Уведомление */}
      {msg && (
        <div className={`rounded-none p-3 font-mono text-xs border ${msg.ok ? "border-[var(--cyber-green)] text-[var(--cyber-green)]" : "border-[var(--cyber-red)] text-[var(--cyber-red)]"}`}>
          {msg.text}
        </div>
      )}

      {/* Вкладки */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setMsg(null); setTab(t.id); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs border transition-all rounded-none
              ${tab === t.id ? "border-[var(--cyber-green)] text-[var(--cyber-green)] bg-[rgba(0,255,136,0.08)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-green)]"}`}>
            <Icon name={t.icon} size={12} />{t.label}
          </button>
        ))}
      </div>

      {/* ── API КЛЮЧИ ── */}
      {tab === "keys" && (
        <div className="cyber-card rounded-none p-5 space-y-4">
          <div className="font-orbitron text-sm neon-text mb-1">КАК ПОЛУЧИТЬ КЛЮЧИ BINGX</div>
          <ol className="space-y-2 text-[12px] text-[var(--cyber-text-dim)] font-mono">
            <li className="flex gap-2"><span className="text-[var(--cyber-green)] font-bold">1.</span> Зайди на <span className="text-[var(--cyber-cyan)]">bingx.com</span> → Аккаунт → API Management</li>
            <li className="flex gap-2"><span className="text-[var(--cyber-green)] font-bold">2.</span> Нажми «Создать API» → введи название (например «КиберБот»)</li>
            <li className="flex gap-2"><span className="text-[var(--cyber-green)] font-bold">3.</span> Включи права: <span className="text-[var(--cyber-yellow)]">Чтение</span> + <span className="text-[var(--cyber-yellow)]">Торговля</span></li>
            <li className="flex gap-2"><span className="text-[var(--cyber-green)] font-bold">4.</span> Скопируй API Key и Secret Key — вставь ниже</li>
          </ol>
          <div className="border border-[rgba(255,200,0,0.3)] bg-[rgba(255,200,0,0.05)] p-3 text-[11px] font-mono text-[var(--cyber-yellow)]">
            ⚠ Не включай «Вывод средств» в правах API — это лишнее
          </div>
          <div className="space-y-3">
            <div>
              <div className="section-label mb-1">API KEY</div>
              <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Вставьте API Key..."
                className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)]" />
            </div>
            <div>
              <div className="section-label mb-1">SECRET KEY</div>
              <input value={secretKey} onChange={e => setSecretKey(e.target.value)} type="password" placeholder="Вставьте Secret Key..."
                className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)]" />
            </div>
            <button onClick={saveKeys} disabled={saving || !apiKey || !secretKey}
              className="w-full cyber-btn-primary py-2.5 font-orbitron text-xs tracking-widest disabled:opacity-40">
              {saving ? "СОХРАНЕНИЕ..." : "СОХРАНИТЬ И ПОДКЛЮЧИТЬ"}
            </button>
          </div>
          {hasKeys && <div className="text-[11px] font-mono text-[var(--cyber-green)]">✓ Ключи уже добавлены: {keyPreview}</div>}
        </div>
      )}

      {/* ── БАЛАНС ── */}
      {tab === "balance" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="section-label">СПОТ БАЛАНС</div>
            <button onClick={loadBalance} disabled={loadingBal} className="cyber-btn px-3 py-1 text-xs font-mono">
              {loadingBal ? "..." : "↺ Обновить"}
            </button>
          </div>
          {balances.length === 0 && !loadingBal && <div className="section-label text-center py-6">Нет активов или идёт загрузка...</div>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {balances.map(b => (
              <div key={b.asset} className="cyber-card rounded-none p-3">
                <div className="font-orbitron text-sm neon-text">{b.asset}</div>
                <div className="font-mono text-sm mt-1">{parseFloat(b.free).toFixed(6)}</div>
                {parseFloat(b.locked) > 0 && <div className="font-mono text-[10px] text-[var(--cyber-text-dim)]">В ордерах: {parseFloat(b.locked).toFixed(6)}</div>}
              </div>
            ))}
          </div>

          {futBal && (
            <div className="cyber-card rounded-none p-4 mt-2">
              <div className="section-label mb-3">ФЬЮЧЕРСНЫЙ СЧЁТ</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Баланс", val: parseFloat(futBal.balance || "0").toFixed(2) + " USDT" },
                  { label: "Эквити", val: parseFloat(futBal.equity || "0").toFixed(2) + " USDT" },
                  { label: "Нереализ. P&L", val: parseFloat(futBal.unrealizedProfit || "0").toFixed(2) + " USDT" },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="font-mono text-sm neon-text-cyan">{s.val}</div>
                    <div className="section-label mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── СПОТ ── */}
      {tab === "spot" && (
        <div className="space-y-4">
          {/* Форма покупки */}
          <div className="cyber-card rounded-none p-4 space-y-3">
            <div className="section-label">КУПИТЬ НА СПОТЕ</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="section-label mb-1">СИМВОЛ</div>
                <select value={spotSym} onChange={e => setSpotSym(e.target.value)}
                  className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)]">
                  {tickers.slice(0, 20).map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                </select>
              </div>
              <div>
                <div className="section-label mb-1">СУММА USDT</div>
                <input value={spotAmt} onChange={e => setSpotAmt(e.target.value)} type="number" min="5"
                  className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)]" />
              </div>
            </div>
            <button onClick={spotBuy} disabled={spotLoading}
              className="w-full cyber-btn-primary py-2.5 font-orbitron text-xs tracking-widest disabled:opacity-40">
              {spotLoading ? "ВЫПОЛНЯЕТСЯ..." : `КУПИТЬ ${spotSym}`}
            </button>
          </div>

          {/* Топ тикеры */}
          <div>
            <div className="section-label mb-2">ТОП-20 ПО ОБЪЁМУ</div>
            <div className="space-y-1">
              {tickers.slice(0, 20).map(t => {
                const chg = parseFloat(t.priceChangePercent || "0");
                return (
                  <div key={t.symbol} onClick={() => setSpotSym(t.symbol)}
                    className={`cyber-card rounded-none p-2.5 flex items-center justify-between cursor-pointer hover:border-[var(--cyber-green)] transition-all ${spotSym === t.symbol ? "border-[var(--cyber-green)]" : ""}`}>
                    <span className="font-mono text-sm">{t.symbol}</span>
                    <span className="font-mono text-sm">${parseFloat(t.lastPrice || "0").toFixed(4)}</span>
                    <span className={`font-mono text-xs ${chg >= 0 ? "profit" : "loss"}`}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* История */}
          {spotHistory.length > 0 && (
            <div>
              <div className="section-label mb-2">МОИ СДЕЛКИ</div>
              <div className="space-y-1">
                {spotHistory.slice(0, 10).map(t => (
                  <div key={t.id} className="cyber-card rounded-none p-2.5 flex items-center justify-between">
                    <span className="font-mono text-xs">{t.symbol}</span>
                    <span className={`font-mono text-xs px-1.5 py-0.5 ${t.status === "open" ? "text-[var(--cyber-yellow)]" : "text-[var(--cyber-text-dim)]"}`}>{t.status.toUpperCase()}</span>
                    {t.pnl != null && <span className={`font-mono text-xs ${t.pnl >= 0 ? "profit" : "loss"}`}>{t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(4)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ФЬЮЧЕРСЫ ── */}
      {tab === "futures" && (
        <div className="space-y-4">
          <div className="cyber-card rounded-none p-4 space-y-3">
            <div className="section-label">ОТКРЫТЬ ПОЗИЦИЮ</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="section-label mb-1">СИМВОЛ</div>
                <input value={futSym} onChange={e => setFutSym(e.target.value)} placeholder="BTC-USDT"
                  className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)]" />
              </div>
              <div>
                <div className="section-label mb-1">СТОРОНА</div>
                <div className="flex gap-1">
                  {["BUY", "SELL"].map(s => (
                    <button key={s} onClick={() => setFutSide(s)}
                      className={`flex-1 py-2 font-orbitron text-xs border rounded-none transition-all ${futSide === s ? (s === "BUY" ? "border-[var(--cyber-green)] text-[var(--cyber-green)] bg-[rgba(0,255,136,0.1)]" : "border-[var(--cyber-red)] text-[var(--cyber-red)] bg-[rgba(255,61,113,0.1)]") : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
                      {s === "BUY" ? "LONG" : "SHORT"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="section-label mb-1">ОБЪЁМ (USDT)</div>
                <input value={futAmt} onChange={e => setFutAmt(e.target.value)} type="number" min="1"
                  className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)]" />
              </div>
              <div>
                <div className="section-label mb-1">ПЛЕЧО x</div>
                <input value={futLev} onChange={e => setFutLev(e.target.value)} type="number" min="1" max="125"
                  className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)]" />
              </div>
            </div>
            <button onClick={openFutures} disabled={futLoading}
              className={`w-full py-2.5 font-orbitron text-xs tracking-widest border rounded-none transition-all disabled:opacity-40 ${futSide === "BUY" ? "border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.1)]" : "border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.1)]"}`}>
              {futLoading ? "ОТКРЫВАЮ..." : `ОТКРЫТЬ ${futSide === "BUY" ? "LONG" : "SHORT"} x${futLev}`}
            </button>
          </div>

          {/* Открытые позиции */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="section-label">ОТКРЫТЫЕ ПОЗИЦИИ</div>
              <button onClick={loadFutures} className="cyber-btn px-3 py-1 text-xs font-mono">↺</button>
            </div>
            {positions.length === 0
              ? <div className="section-label text-center py-6">Нет открытых позиций</div>
              : positions.map((p, i) => {
                const pnl = parseFloat(p.unrealizedProfit || "0");
                return (
                  <div key={i} className="cyber-card rounded-none p-3 flex items-center justify-between gap-2 mb-1">
                    <div>
                      <div className="font-mono text-sm">{p.symbol}</div>
                      <div className={`font-mono text-[10px] ${p.positionSide === "LONG" ? "profit" : "loss"}`}>{p.positionSide} · x{p.leverage}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-xs text-[var(--cyber-text-dim)]">Вход</div>
                      <div className="font-mono text-sm">${parseFloat(p.entryPrice || "0").toFixed(4)}</div>
                    </div>
                    <div className="text-center">
                      <div className={`font-mono text-sm font-bold ${pnl >= 0 ? "profit" : "loss"}`}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(4)}</div>
                      <div className="section-label">P&L</div>
                    </div>
                    <button onClick={() => closeFutures(p.symbol, p.positionSide, p.positionAmt)}
                      className="cyber-btn px-2 py-1 text-[10px] font-mono border-[var(--cyber-red)] text-[var(--cyber-red)]">
                      Закрыть
                    </button>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {/* ── СКАЛЬПИНГ ── */}
      {tab === "scalper" && (
        <div className="space-y-4">
          <div className="cyber-card rounded-none p-4 space-y-4">
            <div className="font-orbitron text-sm neon-text">СКАЛЬПЕР BINGX</div>
            <div className="text-[11px] text-[var(--cyber-text-dim)] font-mono leading-relaxed">
              Анализирует топ-20 пар по объёму. Покупает при <span className="text-[var(--cyber-green)]">RSI &lt; 35</span> + всплеске объёма. Автоматически продаёт при достижении цели или стопа.
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="section-label mb-1">СУММА (USDT)</div>
                <input value={scalpAmt} onChange={e => setScalpAmt(e.target.value)} type="number" min="5"
                  className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)]" />
              </div>
              <div>
                <div className="section-label mb-1">ТЕЙК %</div>
                <input value={scalpTarget} onChange={e => setScalpTarget(e.target.value)} type="number" step="0.1" min="0.1"
                  className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)]" />
              </div>
              <div>
                <div className="section-label mb-1">СТОП %</div>
                <input value={scalpStop} onChange={e => setScalpStop(e.target.value)} type="number" step="0.1" min="0.1"
                  className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)]" />
              </div>
            </div>
            <button onClick={runScalp} disabled={scalpRunning}
              className="w-full cyber-btn-primary py-3 font-orbitron text-xs tracking-widest disabled:opacity-40">
              {scalpRunning ? "АНАЛИЗ РЫНКА..." : "⚡ ЗАПУСТИТЬ ЦИКЛ"}
            </button>
            {scalpMsg && (
              <div className={`p-3 font-mono text-xs border rounded-none ${scalpMsg.ok ? "border-[var(--cyber-green)] text-[var(--cyber-green)]" : "border-[var(--cyber-red)] text-[var(--cyber-red)]"}`}>
                {scalpMsg.text}
              </div>
            )}
          </div>
          <div className="cyber-card rounded-none p-3 border border-[rgba(255,200,0,0.2)]">
            <div className="flex items-start gap-2 text-[11px] font-mono text-[var(--cyber-yellow)]">
              <Icon name="AlertTriangle" size={13} className="shrink-0 mt-0.5" />
              Торговля на криптобирже несёт риски. Используй только ту сумму, потерю которой готов принять.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== HISTORY PAGE ===== */
function HistoryPage() {
  const [trades, setTrades] = useState<{id:number;ticker:string;buy_price:number;sell_price:number|null;pnl:number|null;pnl_pct:number|null;status:string;opened_at:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    authFetch(`${SCALPER_URL}?action=history`)
      .then(r => r.json())
      .then(d => { setTrades(Array.isArray(d.trades) ? d.trades : []); if (d.error) setError(d.error); })
      .catch(() => setError("Ошибка соединения"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="History" size={15} style={{ color: "var(--cyber-green)" }} />
        <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 13, fontWeight: "bold", color: "var(--cyber-green)" }}>ИСТОРИЯ СДЕЛОК</span>
        {!loading && <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--cyber-text-dim)" }}>· {trades.length} записей</span>}
      </div>

      {loading && (
        <div style={{ background: "var(--cyber-surface)", border: "1px solid var(--cyber-border)", padding: "2rem", textAlign: "center" }}>
          <div style={{ width: 24, height: 24, border: "2px solid var(--cyber-green)", borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 8px", animation: "spin 1s linear infinite" }} />
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--cyber-text-dim)" }}>Загрузка...</div>
        </div>
      )}

      {!loading && error && (
        <div style={{ background: "var(--cyber-surface)", border: "1px solid var(--cyber-red)", padding: 12 }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--cyber-red)" }}>⚠ {error}</span>
        </div>
      )}

      {!loading && !error && trades.length === 0 && (
        <div style={{ background: "var(--cyber-surface)", border: "1px solid var(--cyber-border)", padding: "2rem", textAlign: "center" }}>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--cyber-text-dim)" }}>Сделок ещё не было — запусти скальпер во вкладке Т-Банк → Скальпинг</div>
        </div>
      )}

      {!loading && !error && trades.map((t, idx) => {
        const pnl = t.pnl ?? 0;
        const isProfit = pnl >= 0;
        const isClosed = t.status === "closed";
        const col = isClosed ? (isProfit ? "var(--cyber-green)" : "var(--cyber-red)") : "var(--cyber-yellow)";
        return (
          <div key={t.id ?? idx} style={{ background: "var(--cyber-surface)", border: "1px solid var(--cyber-border)", borderLeft: `3px solid ${col}`, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: "bold", color: "var(--cyber-text)" }}>{t.ticker}</span>
                <span style={{ fontFamily: "monospace", fontSize: 10, padding: "2px 6px", background: `${col}22`, color: col }}>
                  {isClosed ? (isProfit ? "✓ ПРИБЫЛЬ" : "✗ СТОП") : "● ОТКРЫТА"}
                </span>
              </div>
              <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 13, fontWeight: "bold", color: col }}>
                {t.pnl != null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} ₽` : "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 10, color: "var(--cyber-text-dim)" }}>
              <div style={{ display: "flex", gap: 12 }}>
                <span>Купил: <span style={{ color: "var(--cyber-text)" }}>{t.buy_price?.toLocaleString("ru-RU")} ₽</span></span>
                {t.sell_price != null && <span>Продал: <span style={{ color: "var(--cyber-text)" }}>{Number(t.sell_price).toLocaleString("ru-RU")} ₽</span></span>}
                {t.pnl_pct != null && <span style={{ color: t.pnl_pct >= 0 ? "var(--cyber-green)" : "var(--cyber-red)" }}>{t.pnl_pct >= 0 ? "+" : ""}{Number(t.pnl_pct).toFixed(2)}%</span>}
              </div>
              <span>{t.opened_at ? new Date(t.opened_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===== PORTFOLIO PAGE ===== */
function PortfolioPage() {
  const [positions, setPositions] = useState<{figi:string;ticker:string;lots:number;avg_price:number;current_price:number;pnl:number;pnl_pct:number}[]>([]);
  const [balance, setBalance] = useState<number|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`${TBANK_URL}?action=portfolio`)
      .then(r => r.json())
      .then(d => {
        if (d.positions) setPositions(d.positions);
        if (d.balance != null) setBalance(d.balance);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalPnl = positions.reduce((s, p) => s + (p.pnl ?? 0), 0);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="PieChart" size={15} className="neon-text-cyan" />
        <div className="font-orbitron text-sm font-bold neon-text-cyan">ПОРТФЕЛЬ Т-БАНК</div>
      </div>

      {balance != null && (
        <div className="grid grid-cols-2 gap-3">
          <div className="cyber-card-glow rounded-none p-4 text-center">
            <div className="font-orbitron text-xl font-black neon-text">{balance.toLocaleString("ru-RU")} ₽</div>
            <div className="section-label mt-1">Свободные средства</div>
          </div>
          <div className="cyber-card-glow rounded-none p-4 text-center">
            <div className={`font-orbitron text-xl font-black ${totalPnl >= 0 ? "neon-text" : "loss"}`}>
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)} ₽
            </div>
            <div className="section-label mt-1">Нереализованный P&L</div>
          </div>
        </div>
      )}

      {loading && (
        <div className="cyber-card rounded-none p-8 text-center">
          <div className="w-6 h-6 border-2 border-[var(--cyber-cyan)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <div className="font-mono text-xs text-[var(--cyber-text-dim)]">Загрузка портфеля...</div>
        </div>
      )}

      {!loading && positions.length === 0 && (
        <div className="cyber-card rounded-none p-8 text-center">
          <Icon name="PieChart" size={32} className="mx-auto mb-3 opacity-30" style={{ color: "var(--cyber-text-dim)" }} />
          <div className="font-mono text-xs text-[var(--cyber-text-dim)]">Открытых позиций нет — подключи токен Т-Банк в профиле</div>
        </div>
      )}

      {!loading && positions.map((p, i) => {
        const isPlus = (p.pnl ?? 0) >= 0;
        return (
          <div key={p.figi || i} className="cyber-card rounded-none p-3" style={{ borderLeft: `2px solid ${isPlus ? "var(--cyber-green)" : "var(--cyber-red)"}` }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-[var(--cyber-text)]">{p.ticker}</span>
                <span className="font-mono text-[10px] text-[var(--cyber-text-dim)]">{p.lots} лот</span>
              </div>
              <span className={`font-orbitron text-sm font-bold ${isPlus ? "neon-text" : "loss"}`}>
                {p.pnl >= 0 ? "+" : ""}{p.pnl?.toFixed(2)} ₽
              </span>
            </div>
            <div className="flex justify-between font-mono text-[10px] text-[var(--cyber-text-dim)]">
              <span>Ср. цена: <span className="text-[var(--cyber-text)]">{p.avg_price?.toLocaleString("ru-RU")} ₽</span></span>
              <span>Тек. цена: <span className="text-[var(--cyber-text)]">{p.current_price?.toLocaleString("ru-RU")} ₽</span></span>
              <span className={isPlus ? "profit" : "loss"}>{p.pnl_pct >= 0 ? "+" : ""}{p.pnl_pct?.toFixed(2)}%</span>
            </div>
          </div>
        );
      })}
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

/* ===== LANDING PAGE ===== */
function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  const features = [
    { icon: "Zap",        title: "Скальпинг акций",      desc: "Автоматические сделки по RSI, EMA, MACD. До 8 сделок в день. Бот сам выбирает момент входа и выхода." },
    { icon: "Bot",        title: "Автотрейдинг 24/7",    desc: "Бот работает без остановки, торгует пока ты спишь. Настрой один раз — забудь." },
    { icon: "Shield",     title: "Стоп-лосс защита",     desc: "Авто-продажа при достижении заданного % убытка. Дневной лимит убытка — бот останавливается сам." },
    { icon: "Smartphone", title: "С телефона",            desc: "Управляй ботом с мобильного — удобный интерфейс. Смотри баланс, сделки и статус в реальном времени." },
    { icon: "Users",      title: "Реф. программа",       desc: "Приглашай друзей и получай % с каждой их сделки. Пассивный доход от реферальной сети." },
    { icon: "Building2",  title: "Т-Банк Invest",        desc: "Прямое подключение через официальный Open API. Акции, ETF, фьючерсы на Московской бирже." },
    { icon: "BarChart2",  title: "BingX крипто",         desc: "Спот и фьючерсная торговля на бирже BingX. Скальпинг по топ криптопарам автоматически." },
    { icon: "TrendingUp", title: "RSI + EMA сигналы",    desc: "Технический анализ в реальном времени. Бот покупает только при подтверждённом сигнале." },
    { icon: "RefreshCw",  title: "Серверный планировщик",desc: "Бот работает на сервере 24/7 даже когда приложение закрыто. Никаких VPS не нужно." },
    { icon: "CreditCard", title: "Тарифы от 0 ₽",       desc: "Бесплатный план для старта. Базовый — 490 ₽/мес, PRO — 990 ₽/мес. Отмена в любой момент." },
  ];
  const plans = (["free", "basic", "pro"] as PlanKey[]).map(k => PLAN_INFO[k]);
  return (
    <div className="cyber-bg min-h-screen" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Hero */}
      <div className="relative flex flex-col items-center justify-center min-h-screen px-4 py-16 text-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute w-px bg-gradient-to-b from-transparent via-[rgba(0,255,136,0.1)] to-transparent"
              style={{ left: `${(i + 1) * 5}%`, top: 0, bottom: 0, animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center animate-fade-in-up"
            style={{ border: "2px solid var(--cyber-green)", boxShadow: "0 0 40px rgba(0,255,136,0.4)" }}>
            <Icon name="Bot" size={40} style={{ color: "var(--cyber-green)" }} />
          </div>
          <div className="font-orbitron text-4xl md:text-6xl font-black neon-text mb-3 animate-fade-in-up">КИБЕРБОТ</div>
          <div className="font-mono text-sm md:text-base text-[var(--cyber-cyan)] tracking-widest mb-6 animate-fade-in-up">
            АВТОМАТИЧЕСКИЙ ТОРГОВЫЙ БОТ ДЛЯ Т-БАНК INVEST
          </div>
          <div className="font-mono text-sm text-[var(--cyber-text-dim)] mb-10 max-w-lg mx-auto leading-relaxed animate-fade-in-up">
            Скальпинг, автотрейдинг и авто-продажа портфеля по заданному %. Торгуй умнее — зарабатывай больше.
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in-up">
            <button onClick={onGetStarted}
              className="px-8 py-4 font-orbitron text-sm font-bold border-2 border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.15)] transition-all"
              style={{ boxShadow: "0 0 20px rgba(0,255,136,0.3)" }}>
              НАЧАТЬ БЕСПЛАТНО →
            </button>
            <a href="#features" className="px-8 py-4 font-orbitron text-sm font-bold border border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-cyan)] transition-all text-center">
              УЗНАТЬ БОЛЬШЕ
            </a>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 font-mono text-[10px] text-[var(--cyber-text-dim)] animate-fade-in-up">
            <span>✓ Бесплатная регистрация</span>
            <span>✓ Т-Банк Open API</span>
            <span>✓ До 8 сделок в день</span>
          </div>
        </div>
      </div>

      {/* Features */}
      <div id="features" className="px-4 py-16 max-w-4xl mx-auto">
        <div className="font-orbitron text-2xl font-bold text-center neon-text-cyan mb-10">ВОЗМОЖНОСТИ</div>
        <div className="overflow-y-auto max-h-[420px] pr-1 mb-8" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--cyber-green) var(--cyber-bg-3)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {features.map(f => (
              <div key={f.title} className="cyber-card rounded-none p-4 hover:border-[var(--cyber-green)] transition-all">
                <Icon name={f.icon} size={24} className="mb-3" style={{ color: "var(--cyber-green)" }} />
                <div className="font-orbitron text-sm font-bold text-[var(--cyber-text)] mb-1">{f.title}</div>
                <div className="font-mono text-xs text-[var(--cyber-text-dim)] leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-center">
          <button onClick={onGetStarted}
            className="px-10 py-4 font-orbitron text-sm font-bold border-2 border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.15)] transition-all"
            style={{ boxShadow: "0 0 20px rgba(0,255,136,0.3)" }}>
            НАЧАТЬ БЕСПЛАТНО →
          </button>
        </div>
      </div>

      {/* Pricing */}
      <div className="py-16 px-4 max-w-4xl mx-auto">
        <div className="font-orbitron text-2xl font-bold text-center text-[var(--cyber-yellow)] mb-10">ТАРИФЫ</div>
        <div style={{ maxHeight: 480, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "thin", scrollbarColor: "var(--cyber-yellow) var(--cyber-bg-3)", paddingRight: 4 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {plans.map((p, i) => (
              <div key={p.name} style={{ background: "var(--cyber-surface)", border: `2px solid ${p.badge ? p.color : "var(--cyber-border)"}`, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12, boxShadow: p.badge ? `0 0 24px ${p.color}33` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    {p.badge && <div style={{ fontFamily: "monospace", fontSize: 10, color: p.color, letterSpacing: "0.1em", marginBottom: 2 }}>{p.badge}</div>}
                    <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 18, fontWeight: 900, color: p.color }}>{p.name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 28, fontWeight: 900, color: "var(--cyber-text)", lineHeight: 1 }}>
                      {p.price === 0 ? "0 ₽" : `${p.price} ₽`}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--cyber-text-dim)" }}>в месяц</div>
                  </div>
                </div>
                <ul style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                  {p.features.map(f => (
                    <li key={f.text} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "monospace", fontSize: 11, color: f.ok ? "var(--cyber-text)" : "var(--cyber-text-dim)", opacity: f.ok ? 1 : 0.4, textDecoration: f.ok ? "none" : "line-through" }}>
                      <span style={{ color: f.ok ? p.color : "var(--cyber-border)", flexShrink: 0 }}>{f.ok ? "✓" : "✕"}</span>
                      {f.text}
                    </li>
                  ))}
                </ul>
                <button onClick={onGetStarted}
                  style={{ alignSelf: "flex-start", padding: "8px 24px", fontFamily: "'Orbitron', monospace", fontSize: 11, fontWeight: "bold", border: `2px solid ${p.color}`, color: p.color, background: p.badge ? `${p.color}18` : "transparent", cursor: "pointer" }}>
                  {i === 0 ? "НАЧАТЬ БЕСПЛАТНО" : "ВЫБРАТЬ ТАРИФ →"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 py-16 text-center border-t border-[var(--cyber-border)]">
        <div className="font-orbitron text-xl font-bold neon-text mb-3">ГОТОВ НАЧАТЬ?</div>
        <div className="font-mono text-sm text-[var(--cyber-text-dim)] mb-6">Регистрация бесплатна. Подключи токен Т-Банк — и бот начнёт работать.</div>
        <button onClick={onGetStarted}
          className="px-10 py-4 font-orbitron text-sm font-bold border-2 border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.15)] transition-all"
          style={{ boxShadow: "0 0 20px rgba(0,255,136,0.3)" }}>
          ЗАРЕГИСТРИРОВАТЬСЯ БЕСПЛАТНО →
        </button>
        <div className="mt-8 font-mono text-[10px] text-[var(--cyber-text-dim)]">
          КиберБот · Автоматический трейдинг · Т-Банк Invest API
        </div>
      </div>
    </div>
  );
}

/* ===== ONBOARDING PAGE ===== */
function OnboardingPage({ user, onDone }: { user: { username: string; role: string }; onDone: () => void }) {
  const [selected, setSelected] = useState<PlanKey>("pro");
  const [loading, setLoading]   = useState(false);
  const [payStatus, setPayStatus] = useState<{ robokassa: boolean; yookassa: boolean }>({ robokassa: false, yookassa: false });
  const [provider, setProvider] = useState<"robokassa" | "yookassa">("robokassa");
  const [msg, setMsg]           = useState("");

  useEffect(() => {
    authFetch(`${PAYMENT_URL}?action=status`).then(r => r.json()).then(d => {
      if (d.robokassa) setPayStatus({ robokassa: d.robokassa.connected, yookassa: d.yookassa.connected });
    });
  }, []);

  const pay = async () => {
    setLoading(true);
    const r = await authFetch(PAYMENT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "create_payment", plan: selected, provider, return_url: window.location.href }),
    });
    const d = await r.json();
    setLoading(false);
    if (d.ok && d.payment_url) { window.location.href = d.payment_url; }
    else setMsg(d.error || "Ошибка. Попробуй позже.");
  };

  const hasPay = payStatus.robokassa || payStatus.yookassa;

  return (
    <div className="cyber-bg min-h-screen flex items-center justify-center p-4" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="w-full max-w-2xl animate-fade-in-up">

        {/* Шапка */}
        <div className="text-center mb-8">
          <div className="font-mono text-xs text-[var(--cyber-text-dim)] mb-1 tracking-widest">ДОБРО ПОЖАЛОВАТЬ</div>
          <div className="font-orbitron text-2xl font-black neon-text mb-1">{user.username.toUpperCase()}</div>
          <div className="font-mono text-sm text-[var(--cyber-text-dim)]">Аккаунт создан. Выбери тариф — или начни бесплатно.</div>
        </div>

        {/* Тарифы */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {(["free", "basic", "pro"] as PlanKey[]).map(key => {
            const p = PLAN_INFO[key];
            const isSelected = selected === key;
            return (
              <button key={key} onClick={() => setSelected(key)}
                className="rounded-none p-4 text-left transition-all border-2 flex flex-col"
                style={{ borderColor: isSelected ? p.color : "var(--cyber-border)", background: isSelected ? `${p.color}11` : "var(--cyber-surface)" }}>
                {p.badge && <div className="font-mono text-[9px] mb-1.5" style={{ color: p.color }}>{p.badge}</div>}
                <div className="flex items-center justify-between mb-2">
                  <div className="font-orbitron text-sm font-black" style={{ color: p.color }}>{p.name}</div>
                  <div className="font-orbitron text-base font-black text-[var(--cyber-text)]">
                    {p.price === 0 ? "Бесплатно" : `${p.price} ₽`}
                    {p.price > 0 && <span className="font-mono text-[9px] text-[var(--cyber-text-dim)]">/мес</span>}
                  </div>
                </div>
                <ul className="space-y-1 flex-1">
                  {p.features.map(f => (
                    <li key={f.text} className={`font-mono text-[10px] flex items-start gap-1.5 ${f.ok ? "text-[var(--cyber-text-dim)]" : "opacity-25"}`}>
                      <span className="flex-shrink-0 mt-0.5" style={{ color: f.ok ? p.color : "transparent" }}>✓</span>
                      {f.text}
                    </li>
                  ))}
                </ul>
                {isSelected && (
                  <div className="mt-3 font-mono text-[10px] text-center py-1 rounded-none" style={{ background: `${p.color}22`, color: p.color }}>
                    ● ВЫБРАН
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {msg && <div className="font-mono text-xs text-[var(--cyber-red)] text-center mb-3 p-2 border border-[var(--cyber-red)]">{msg}</div>}

        {/* Выбор провайдера если нужна оплата */}
        {selected !== "free" && hasPay && (
          <div className="flex gap-2 mb-3">
            {payStatus.robokassa && (
              <button onClick={() => setProvider("robokassa")}
                className={`flex-1 py-2 font-mono text-xs border rounded-none transition-all ${provider === "robokassa" ? "border-[var(--cyber-cyan)] text-[var(--cyber-cyan)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
                Robokassa (карта, СБП)
              </button>
            )}
            {payStatus.yookassa && (
              <button onClick={() => setProvider("yookassa")}
                className={`flex-1 py-2 font-mono text-xs border rounded-none transition-all ${provider === "yookassa" ? "border-[var(--cyber-cyan)] text-[var(--cyber-cyan)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
                ЮKassa
              </button>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3">
          {selected === "free" ? (
            <button onClick={onDone}
              className="flex-1 py-3 font-orbitron text-sm font-bold border-2 border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.1)] rounded-none transition-all flex items-center justify-center gap-2">
              <Icon name="Zap" size={15} /> НАЧАТЬ БЕСПЛАТНО →
            </button>
          ) : hasPay ? (
            <button onClick={pay} disabled={loading}
              className="flex-1 py-3 font-orbitron text-sm font-bold rounded-none transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ border: `2px solid ${PLAN_INFO[selected].color}`, color: PLAN_INFO[selected].color, background: `${PLAN_INFO[selected].color}11` }}>
              {loading
                ? <><div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" /><span>...</span></>
                : <><Icon name="CreditCard" size={15} /> ОПЛАТИТЬ {PLAN_INFO[selected].price} ₽ / МЕС →</>}
            </button>
          ) : (
            <button onClick={onDone}
              className="flex-1 py-3 font-orbitron text-sm font-bold border-2 border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.1)] rounded-none transition-all flex items-center justify-center gap-2">
              <Icon name="Zap" size={15} /> ВОЙТИ В КИБЕРБОТ →
            </button>
          )}
          {selected !== "free" && (
            <button onClick={onDone} className="sm:w-auto px-5 py-3 font-mono text-xs border border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-cyan)] rounded-none transition-all">
              Пропустить
            </button>
          )}
        </div>

        <div className="text-center mt-4 font-mono text-[9px] text-[var(--cyber-text-dim)]">
          🔒 Подписку можно оформить позже в разделе «Профиль»
        </div>
      </div>
    </div>
  );
}

/* ===== ROOT WRAPPER — проверка авторизации ===== */
export default function Index() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const sid = getSession();
    if (!sid) { setAuthChecked(true); return; }
    fetch(`${AUTH_URL}?action=check`, { headers: { "X-Session-Id": sid, "Content-Type": "application/json" } })
      .then(r => r.json())
      .then(d => { if (d.ok) setUser(d.user); else clearSession(); })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogin = (sid: string, u: { username: string; role: string }, isNew?: boolean) => {
    setSession(sid);
    setUser(u);
    if (isNew) setShowOnboarding(true);
  };

  if (!authChecked) return (
    <div className="cyber-bg min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[var(--cyber-green)] border-t-transparent rounded-full animate-spin" />
        <div className="font-mono text-xs text-[var(--cyber-text-dim)]">ИНИЦИАЛИЗАЦИЯ...</div>
      </div>
    </div>
  );

  if (!user && !showAuth) return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  if (!user) return <LoginPage onLogin={handleLogin} />;
  if (showOnboarding) return <OnboardingPage user={user} onDone={() => setShowOnboarding(false)} />;
  return <AppShell user={user} onLogout={() => { clearSession(); setUser(null); }} />;
}

/* ===== APP SHELL — основное приложение ===== */
function AppShell({ user, onLogout }: { user: { username: string; role: string }; onLogout: () => void }) {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [botRunning, setBotRunning] = useState(true);
  // На мобиле сайдбар закрыт по умолчанию
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [time, setTime] = useState(new Date());

  // Счётчик для принудительного обновления баланса Т-Банк
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);

  // Глобальный планировщик — живёт вне AutoBotPage
  const [botEnabled, setBotEnabled] = useState(false);
  const [botIntervalMin, setBotIntervalMin] = useState(30);
  const [botCountdown, setBotCountdown] = useState(0);
  const [botCycleCount, setBotCycleCount] = useState(0);
  const [botRunning2, setBotRunning2] = useState(false);
  const [botLastMsg, setBotLastMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Таймер — тикает всегда пока бот включён
  useEffect(() => {
    if (!botEnabled) { setBotCountdown(0); return; }
    const total = botIntervalMin * 60;
    setBotCountdown(c => c > 0 ? c : total);
    const tick = setInterval(() => {
      setBotCountdown(prev => {
        if (prev <= 1) { return total; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [botEnabled, botIntervalMin]);

  // Запуск цикла когда таймер сбрасывается (кроме самого первого раза)
  const cycleRef = useRef(0);
  useEffect(() => {
    if (!botEnabled || botCountdown !== botIntervalMin * 60) return;
    if (cycleRef.current === 0) { cycleRef.current = 1; return; }
    triggerBotCycle();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botCountdown]);

  const triggerBotCycle = useCallback(async () => {
    if (botRunning2) return;
    setBotRunning2(true);
    try {
      const r = await authFetch(AUTOTRADER_URL, {
        method: "POST",
        body: JSON.stringify({ action: "run_once" }),
      });
      const d = await r.json();
      setBotCycleCount(c => c + 1);
      if (d.stopped) {
        setBotEnabled(false);
        setBotLastMsg({ text: `🛑 Стоп: ${d.reason}`, ok: false });
      } else if (d.success) {
        const done = (d.results || []).filter((t: { order_id?: string }) => t.order_id).length;
        setBotLastMsg({ text: `✓ Цикл #${botCycleCount + 1} · сделок: ${done} · P&L: ${d.daily_pnl >= 0 ? "+" : ""}${d.daily_pnl?.toFixed(0)} ₽`, ok: true });
      }
    } catch { setBotLastMsg({ text: "Ошибка соединения", ok: false }); }
    setBotRunning2(false);
    setBalanceRefreshKey(k => k + 1); // обновить баланс после цикла
    setTimeout(() => setBotLastMsg(null), 6000);
  }, [botRunning2, botCycleCount]);

  // ── Глобальный скальпер-таймер ───────────────────────────────────────
  const [scalpEnabled, setScalpEnabled] = useState(false);
  const [scalpIntervalMin, setScalpIntervalMin] = useState(10);
  const [scalpCountdown, setScalpCountdown] = useState(0);
  const [scalpRunning, setScalpRunning] = useState(false);
  const [scalpMsg, setScalpMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const scalpRef = useRef(0);

  useEffect(() => {
    if (!scalpEnabled) { setScalpCountdown(0); return; }
    const total = scalpIntervalMin * 60;
    setScalpCountdown(c => c > 0 ? c : total);
    const tick = setInterval(() => {
      setScalpCountdown(prev => prev <= 1 ? total : prev - 1);
    }, 1000);
    return () => clearInterval(tick);
  }, [scalpEnabled, scalpIntervalMin]);

  useEffect(() => {
    if (!scalpEnabled || scalpCountdown !== scalpIntervalMin * 60) return;
    if (scalpRef.current === 0) { scalpRef.current = 1; return; }
    triggerScalpCycle();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scalpCountdown]);

  const triggerScalpCycle = useCallback(async () => {
    if (scalpRunning) return;
    setScalpRunning(true);
    try {
      // force:true — запускаем даже если scalp_enabled не сохранён в user_settings
      const r = await authFetch(SCALPER_URL, { method: "POST", body: JSON.stringify({ action: "run_scalp", force: true }) });
      const d = await r.json();
      if (d.ok) {
        const sold = d.sold?.length || 0;
        const bought = d.bought?.length || 0;
        setScalpMsg({ text: `⚡ Скальпер: куплено ${bought}, продано ${sold}`, ok: true });
        if (sold > 0 || bought > 0) setBalanceRefreshKey(k => k + 1);
      } else if (!d.ok && d.reason) {
        setScalpMsg({ text: `⚡ ${d.reason}`, ok: false });
      }
    } catch { /* skip */ }
    setScalpRunning(false);
    setTimeout(() => setScalpMsg(null), 5000);
  }, [scalpRunning]);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard": return <DashboardPage botRunning={botRunning} setBotRunning={setBotRunning} />;
      case "trading": return <TradingPage />;
      case "strategies": return <StrategiesPage />;
      case "tbank": return <TBankPage refreshKey={balanceRefreshKey}
        scalpEnabled={scalpEnabled} setScalpEnabled={setScalpEnabled}
        scalpIntervalMin={scalpIntervalMin} setScalpIntervalMin={setScalpIntervalMin}
        scalpCountdown={scalpCountdown} setScalpCountdown={setScalpCountdown}
        scalpRunning={scalpRunning} triggerScalpCycle={triggerScalpCycle}
        scalpMsg={scalpMsg}
      />;
      case "bingx": return <BingXPage />;
      case "autobot": return <AutoBotPage
        botEnabled={botEnabled} setBotEnabled={setBotEnabled}
        botIntervalMin={botIntervalMin} setBotIntervalMin={setBotIntervalMin}
        botCountdown={botCountdown} setBotCountdown={setBotCountdown}
        botCycleCount={botCycleCount} setBotCycleCount={setBotCycleCount}
        botRunning={botRunning2} triggerBotCycle={triggerBotCycle}
        botLastMsg={botLastMsg} setBotLastMsg={setBotLastMsg}
      />;
      case "wallet": return <WalletPage />;
      case "history": return <HistoryPage />;
      case "portfolio": return <PortfolioPage />;
      case "positions": return <LivePositionsPage />;
      case "referral": return <ReferralPage user={user} />;
      case "profile": return <ProfilePage user={user} />;
      case "api": return <ApiKeysPage />;
      case "signals": return <GenericPage title="ТОРГОВЫЕ СИГНАЛЫ" icon="Radio" />;
      case "risk": return <GenericPage title="РИСК-МЕНЕДЖМЕНТ" icon="Shield" />;
      case "alerts": return <GenericPage title="АЛЕРТЫ И УВЕДОМЛЕНИЯ" icon="Bell" />;
      case "settings": return <SettingsPage user={user} onLogout={onLogout} />;
      default: return null;
    }
  };

  const activeNav = NAV_ITEMS.find(n => n.id === activeSection);

  // Мобильное меню — закрываем ТОЛЬКО на мобиле
  const handleNavClick = (id: string) => {
    setActiveSection(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const BOTTOM_NAV = [
    { id: "dashboard",     icon: "LayoutDashboard", label: "Главная" },
    { id: "tbank",         icon: "Building2",       label: "Т-Банк" },
    { id: "autobot",       icon: "Bot",             label: "Автобот" },
    { id: "portfolio",     icon: "PieChart",        label: "Портфель" },
    { id: "settings_menu", icon: "Menu",            label: "Ещё" },
  ];

  return (
    <div className="cyber-bg h-screen flex flex-col md:flex-row overflow-hidden" style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: "var(--cyber-text)" }}>

      {/* Мобильный оверлей при открытом меню */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Сайдбар — на десктопе статичный, на мобиле — выезжает слева */}
      <aside className={`
        fixed md:relative z-50 md:z-auto h-full md:h-auto
        ${sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0 md:w-14"}
        flex-shrink-0 md:transition-none transition-transform duration-200 flex flex-col
      `} style={{
        background: "var(--cyber-surface)",
        borderRight: "1px solid var(--cyber-border)",
        touchAction: "none",
        overscrollBehavior: "none",
        userSelect: "none",
      }}>

        {/* Логотип */}
        <div className="p-4 border-b border-[var(--cyber-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0"
              style={{ border: "1px solid var(--cyber-green)", boxShadow: "0 0 10px rgba(0,255,136,0.3)" }}>
              <Icon name="Bot" size={16} style={{ color: "var(--cyber-green)" }} />
            </div>
            {sidebarOpen && (
              <div>
                <div className="font-orbitron text-sm font-bold neon-text">КИБЕРБОТ</div>
                <div className="text-[9px] font-mono text-[var(--cyber-text-dim)] tracking-widest">CRYPTO TRADER</div>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} className="md:hidden cyber-btn p-1 rounded-none">
              <Icon name="X" size={14} />
            </button>
          )}
        </div>

        {/* Навигация */}
        <nav className="py-1 flex-1 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <button key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`nav-item w-full text-left ${activeSection === item.id ? "active" : ""}`}
              style={{ minHeight: sidebarOpen ? 40 : 44 }}
              title={!sidebarOpen ? item.label : undefined}>
              <Icon name={item.icon} size={sidebarOpen ? 16 : 18} fallback="Circle" />
              {sidebarOpen && <span className="text-sm">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Статус бота + выход */}
        {sidebarOpen && (
          <div className="p-3 border-t border-[var(--cyber-border)] space-y-2">
            <div className="cyber-card rounded-none p-2.5">
              <div className="flex items-center gap-2 mb-0.5">
                <div className={`status-dot ${botEnabled ? "online" : "offline"}`} />
                <span className="font-mono text-xs" style={{ color: botEnabled ? "var(--cyber-green)" : "var(--cyber-text-dim)" }}>
                  {botEnabled ? "БОТ АКТИВЕН" : "БОТ СТОП"}
                </span>
              </div>
              <div className="font-mono text-[10px] text-[var(--cyber-text-dim)]">{time.toLocaleTimeString("ru-RU")} МСК</div>
            </div>
            <button onClick={onLogout}
              className="w-full flex items-center gap-2 px-2 py-1.5 border border-[var(--cyber-border)] text-[var(--cyber-text-dim)] hover:border-[var(--cyber-red)] hover:text-[var(--cyber-red)] rounded-none transition-all font-mono text-xs">
              <Icon name="LogOut" size={12} />
              <span>Выйти · {user.username}</span>
            </button>
          </div>
        )}
      </aside>

      {/* Основной контент */}
      <div className="flex-1 flex flex-col min-w-0" style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}>

        {/* Хедер */}
        <header className="flex items-center justify-between px-3 md:px-5 py-2.5 border-b sticky top-0 z-30"
          style={{ background: "var(--cyber-surface)", borderColor: "var(--cyber-border)" }}>
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            {/* Кнопка меню — на мобиле и десктопе */}
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 border rounded-none transition-all"
              style={{ borderColor: "var(--cyber-border)", color: "var(--cyber-text-dim)" }}>
              <Icon name="Menu" size={16} />
            </button>
            <div className="font-orbitron text-xs md:text-sm font-semibold text-[var(--cyber-text)] truncate">
              {activeNav?.label?.toUpperCase() ?? "КИБЕРБОТ"}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {botEnabled && (
              <button onClick={() => setActiveSection("autobot")}
                className="flex items-center gap-1 px-1.5 py-1 border border-[var(--cyber-green)] rounded-none">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--cyber-green)] animate-pulse" />
                <span className="font-orbitron text-[10px] neon-text">
                  {Math.floor(botCountdown / 60).toString().padStart(2,"0")}:{(botCountdown % 60).toString().padStart(2,"0")}
                </span>
              </button>
            )}
            {scalpEnabled && (
              <button onClick={() => setActiveSection("tbank")}
                className="flex items-center gap-1 px-1.5 py-1 border border-[var(--cyber-yellow)] rounded-none">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--cyber-yellow)] animate-pulse" />
                <span className="font-orbitron text-[10px] text-[var(--cyber-yellow)]">
                  ⚡{Math.floor(scalpCountdown / 60).toString().padStart(2,"0")}:{(scalpCountdown % 60).toString().padStart(2,"0")}
                </span>
              </button>
            )}
            {scalpMsg && (
              <div className={`hidden md:block font-mono text-xs px-2 py-1 border rounded-none ${scalpMsg.ok ? "border-[var(--cyber-yellow)] text-[var(--cyber-yellow)]" : "border-[var(--cyber-red)] loss"}`}>
                {scalpMsg.text}
              </div>
            )}
            {/* Профиль — только на мобиле в хедере */}
            <button onClick={() => handleNavClick("profile")}
              className="md:hidden flex items-center justify-center w-8 h-8 border rounded-none transition-all"
              style={{ borderColor: activeSection === "profile" ? "var(--cyber-green)" : "var(--cyber-border)", color: activeSection === "profile" ? "var(--cyber-green)" : "var(--cyber-text-dim)" }}>
              <Icon name="User" size={15} />
            </button>
            <div className="hidden md:block font-mono text-xs text-[var(--cyber-text-dim)]">
              {time.toLocaleTimeString("ru-RU")}
            </div>
          </div>
        </header>

        {/* Контент */}
        <main className="flex-1 p-3 md:p-5 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>{renderContent()}</main>
      </div>

      {/* Нижняя навигация — только на мобиле */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t"
        style={{
          background: "var(--cyber-surface)",
          borderColor: "var(--cyber-border)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
        <div className="flex items-stretch">
          {BOTTOM_NAV.map(item => {
            const isActive = activeSection === item.id && item.id !== "settings_menu";
            const hasBadge = (item.id === "autobot" && botEnabled) || (item.id === "tbank" && scalpEnabled);
            const badgeColor = item.id === "autobot" ? "var(--cyber-green)" : "var(--cyber-yellow)";
            return (
              <button key={item.id}
                onClick={() => item.id === "settings_menu" ? setSidebarOpen(true) : handleNavClick(item.id)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95"
                style={{
                  color: isActive ? "var(--cyber-green)" : "var(--cyber-text-dim)",
                  minHeight: 56,
                  borderTop: isActive ? `2px solid var(--cyber-green)` : "2px solid transparent",
                  boxShadow: isActive ? "0 -2px 8px rgba(0,255,136,0.3)" : "none",
                  background: isActive ? "rgba(0,255,136,0.04)" : "transparent",
                }}>
                <div className="relative mt-1">
                  <Icon name={item.icon} size={20} fallback="Circle" />
                  {hasBadge && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full border border-[var(--cyber-surface)] animate-pulse"
                      style={{ background: badgeColor }} />
                  )}
                </div>
                <span className="text-[9px] font-mono leading-none pb-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
}