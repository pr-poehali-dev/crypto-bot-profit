import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

const NAV_ITEMS = [
  { id: "dashboard", icon: "LayoutDashboard", label: "Дашборд" },
  { id: "trading", icon: "TrendingUp", label: "Торговля" },
  { id: "strategies", icon: "Brain", label: "Стратегии" },
  { id: "positions", icon: "Layers", label: "Позиции" },
  { id: "history", icon: "History", label: "История" },
  { id: "arbitrage", icon: "ArrowLeftRight", label: "Арбитраж" },
  { id: "signals", icon: "Radio", label: "Сигналы" },
  { id: "risk", icon: "Shield", label: "Риск-менедж" },
  { id: "portfolio", icon: "PieChart", label: "Портфель" },
  { id: "alerts", icon: "Bell", label: "Алерты" },
  { id: "api", icon: "Key", label: "API Ключи" },
  { id: "settings", icon: "Settings", label: "Настройки" },
];

const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "DOGE/USDT"];

const MOCK_POSITIONS = [
  { pair: "BTC/USDT", side: "LONG", entry: 67420, current: 69850, size: 0.15, pnl: 364.5, pnlPct: 3.6, leverage: 5 },
  { pair: "ETH/USDT", side: "SHORT", entry: 3280, current: 3195, size: 1.2, pnl: 102.0, pnlPct: 3.1, leverage: 3 },
  { pair: "SOL/USDT", side: "LONG", entry: 178.5, current: 171.2, size: 12, pnl: -87.6, pnlPct: -4.1, leverage: 2 },
];

const MOCK_HISTORY = [
  { id: "T-4821", pair: "BTC/USDT", side: "LONG", open: "19:24:07", close: "21:15:33", pnl: 284.2, pnlPct: 2.8 },
  { id: "T-4820", pair: "ETH/USDT", side: "SHORT", open: "17:05:12", close: "18:44:00", pnl: -56.1, pnlPct: -1.7 },
  { id: "T-4819", pair: "SOL/USDT", side: "LONG", open: "14:32:48", close: "16:10:22", pnl: 127.0, pnlPct: 7.2 },
  { id: "T-4818", pair: "BNB/USDT", side: "LONG", open: "12:18:03", close: "13:55:41", pnl: 43.5, pnlPct: 1.4 },
  { id: "T-4817", pair: "XRP/USDT", side: "SHORT", open: "09:44:17", close: "11:02:55", pnl: -18.9, pnlPct: -0.9 },
];

const STRATEGIES = [
  { name: "Momentum RSI", status: true, pairs: 4, winrate: 68, today: 312.4 },
  { name: "Grid Trading", status: true, pairs: 2, winrate: 82, today: 94.7 },
  { name: "MACD Cross", status: false, pairs: 3, winrate: 61, today: 0 },
  { name: "DCA Bot", status: true, pairs: 6, winrate: 74, today: 58.2 },
  { name: "Scalper X3", status: false, pairs: 1, winrate: 71, today: 0 },
];

const CHART_DATA = [42, 58, 35, 72, 89, 64, 78, 91, 55, 83, 76, 95, 68, 88, 72, 96, 84, 79, 92, 87, 94, 76, 88, 99];

function useCounter(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const steps = 40;
    const step = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

interface StatCardProps { label: string; value: string | number; sub?: string; color?: string; delay?: number; }
function StatCard({ label, value, sub, color = "green", delay = 0 }: StatCardProps) {
  return (
    <div className="cyber-card-glow rounded-none p-4 animate-fade-in-up" style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
      <div className="section-label mb-2">{label}</div>
      <div className={`font-orbitron text-2xl font-bold ${color === "green" ? "neon-text" : color === "red" ? "text-[var(--cyber-red)]" : color === "cyan" ? "neon-text-cyan" : "text-[var(--cyber-yellow)]"}`}>
        {value}
      </div>
      {sub && <div className="font-mono text-xs text-[var(--cyber-text-dim)] mt-1">{sub}</div>}
    </div>
  );
}

function DashboardPage({ botRunning, setBotRunning }: { botRunning: boolean; setBotRunning: (v: boolean) => void }) {
  const totalPnl = useCounter(4827);
  const todayPnl = useCounter(465);
  const winrate = useCounter(72);
  const trades = useCounter(48);

  return (
    <div className="space-y-6">
      <div className="cyber-card rounded-none p-4 flex flex-wrap items-center justify-between gap-4 animate-fade-in-up">
        <div className="flex items-center gap-4">
          <div className={`status-dot ${botRunning ? "online" : "offline"}`} />
          <span className="font-orbitron text-sm font-semibold" style={{ color: botRunning ? "var(--cyber-green)" : "var(--cyber-red)" }}>
            {botRunning ? "БОТ АКТИВЕН" : "БОТ ОСТАНОВЛЕН"}
          </span>
          <span className="section-label">v2.4.1 · BINANCE FUTURES</span>
        </div>
        <div className="flex gap-3">
          <button className="cyber-btn-primary rounded-none" onClick={() => setBotRunning(true)} disabled={botRunning}>
            ЗАПУСТИТЬ
          </button>
          <button className="cyber-btn-danger rounded-none" onClick={() => setBotRunning(false)} disabled={!botRunning}>
            СТОП
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Общий P&L" value={`$${totalPnl.toLocaleString()}`} sub="+18.4% за месяц" color="green" delay={100} />
        <StatCard label="P&L сегодня" value={`+$${todayPnl}`} sub="23 сделки закрыто" color="green" delay={200} />
        <StatCard label="Винрейт" value={`${winrate}%`} sub="последние 30 дней" color="cyan" delay={300} />
        <StatCard label="Сделок всего" value={trades} sub="активных: 3" color="yellow" delay={400} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 cyber-card rounded-none p-4 animate-fade-in-up delay-200">
          <div className="flex items-center justify-between mb-4">
            <div className="section-label">P&L — 24Ч ГРАФИК</div>
            <span className="font-mono text-xs neon-text">+$465.30</span>
          </div>
          <div className="chart-bar">
            {CHART_DATA.map((h, i) => (
              <div
                key={i}
                className="chart-bar-item"
                style={{
                  height: `${h}%`,
                  background: h > 70
                    ? `linear-gradient(180deg, var(--cyber-green), rgba(0,255,136,0.3))`
                    : h > 50
                    ? `linear-gradient(180deg, var(--cyber-cyan), rgba(0,212,255,0.3))`
                    : `linear-gradient(180deg, var(--cyber-yellow), rgba(255,170,0,0.3))`,
                  boxShadow: h > 70 ? `0 0 6px var(--cyber-green)` : h > 50 ? `0 0 6px var(--cyber-cyan)` : `0 0 6px var(--cyber-yellow)`
                }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="section-label">00:00</span>
            <span className="section-label">12:00</span>
            <span className="section-label">24:00</span>
          </div>
        </div>

        <div className="cyber-card rounded-none p-4 animate-fade-in-up delay-300">
          <div className="section-label mb-3">МАРКЕТ ДАННЫЕ</div>
          {[
            { p: "BTC/USDT", v: "69,842", c: "+2.14%" },
            { p: "ETH/USDT", v: "3,195", c: "-0.87%" },
            { p: "SOL/USDT", v: "171.2", c: "+5.32%" },
            { p: "BNB/USDT", v: "412.5", c: "+0.41%" },
            { p: "XRP/USDT", v: "0.6284", c: "-1.22%" },
            { p: "DOGE/USDT", v: "0.1847", c: "+3.67%" },
          ].map((t) => (
            <div key={t.p} className="ticker-row">
              <span className="font-mono text-xs text-[var(--cyber-text)]">{t.p}</span>
              <div className="text-right">
                <div className="font-mono text-xs text-[var(--cyber-text)]">${t.v}</div>
                <div className={`font-mono text-xs ${t.c.startsWith("+") ? "profit" : "loss"}`}>{t.c}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="cyber-card rounded-none p-4 animate-fade-in-up delay-400">
        <div className="section-label mb-4">ОТКРЫТЫЕ ПОЗИЦИИ</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--cyber-border)]">
                {["Пара", "Сторона", "Плечо", "Вход", "Текущая", "Объём", "P&L", ""].map((h) => (
                  <th key={h} className="section-label text-left py-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_POSITIONS.map((p) => (
                <tr key={p.pair} className="border-b border-[rgba(26,58,74,0.4)] hover:bg-[rgba(0,255,136,0.03)]">
                  <td className="font-mono text-sm text-[var(--cyber-text)] py-3 pr-4">{p.pair}</td>
                  <td className={`font-mono text-xs py-3 pr-4 font-semibold ${p.side === "LONG" ? "profit" : "loss"}`}>{p.side}</td>
                  <td className="font-mono text-xs text-[var(--cyber-cyan)] py-3 pr-4">x{p.leverage}</td>
                  <td className="font-mono text-xs text-[var(--cyber-text-dim)] py-3 pr-4">${p.entry.toLocaleString()}</td>
                  <td className="font-mono text-xs text-[var(--cyber-text)] py-3 pr-4">${p.current.toLocaleString()}</td>
                  <td className="font-mono text-xs text-[var(--cyber-text-dim)] py-3 pr-4">{p.size}</td>
                  <td className={`font-mono text-sm py-3 pr-4 font-semibold ${p.pnl >= 0 ? "profit" : "loss"}`}>
                    {p.pnl >= 0 ? "+" : ""}${p.pnl} ({p.pnlPct >= 0 ? "+" : ""}{p.pnlPct}%)
                  </td>
                  <td className="py-3">
                    <button className="cyber-btn rounded-none text-xs px-3 py-1">Закрыть</button>
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

function TradingPage() {
  const [pair, setPair] = useState("BTC/USDT");
  const [side, setSide] = useState("LONG");
  const [orderType, setOrderType] = useState("MARKET");
  const [leverage, setLeverage] = useState(5);
  const [amount, setAmount] = useState("100");
  const [sl, setSl] = useState("2");
  const [tp, setTp] = useState("5");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-4">
        <div className="cyber-card-glow rounded-none p-5 animate-fade-in-up">
          <div className="section-label mb-4">НОВАЯ СДЕЛКА</div>
          <div className="space-y-3">
            <div>
              <div className="section-label mb-1">Торговая пара</div>
              <select className="cyber-select rounded-none" value={pair} onChange={e => setPair(e.target.value)}>
                {PAIRS.map(p => <option key={p} value={p} style={{ background: "#0a1520" }}>{p}</option>)}
              </select>
            </div>

            <div>
              <div className="section-label mb-1">Сторона</div>
              <div className="flex gap-2">
                {["LONG", "SHORT"].map(s => (
                  <button key={s} onClick={() => setSide(s)}
                    className={`flex-1 py-2 font-mono text-xs rounded-none transition-all ${
                      side === s
                        ? s === "LONG" ? "bg-[rgba(0,255,136,0.2)] border border-[var(--cyber-green)] text-[var(--cyber-green)]" : "bg-[rgba(255,61,113,0.2)] border border-[var(--cyber-red)] text-[var(--cyber-red)]"
                        : "border border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"
                    }`}
                  >{s}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="section-label mb-1">Тип ордера</div>
              <div className="flex gap-2">
                {["MARKET", "LIMIT", "STOP"].map(t => (
                  <button key={t} onClick={() => setOrderType(t)}
                    className={`flex-1 py-2 font-mono text-xs rounded-none transition-all ${
                      orderType === t ? "bg-[rgba(0,212,255,0.15)] border border-[var(--cyber-cyan)] text-[var(--cyber-cyan)]" : "border border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"
                    }`}
                  >{t}</button>
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

            <div>
              <div className="section-label mb-1">Объём ($)</div>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="cyber-input rounded-none" placeholder="100" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="section-label mb-1">Stop Loss (%)</div>
                <input type="number" value={sl} onChange={e => setSl(e.target.value)} className="cyber-input rounded-none" />
              </div>
              <div>
                <div className="section-label mb-1">Take Profit (%)</div>
                <input type="number" value={tp} onChange={e => setTp(e.target.value)} className="cyber-input rounded-none" />
              </div>
            </div>

            <div className="cyber-card rounded-none p-3 mt-2">
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div><span className="text-[var(--cyber-text-dim)]">Ликвидация:</span> <span className="loss">$62,180</span></div>
                <div><span className="text-[var(--cyber-text-dim)]">Маржа:</span> <span className="text-[var(--cyber-text)]">${(+amount * leverage).toFixed(0)}</span></div>
                <div><span className="text-[var(--cyber-text-dim)]">TP цель:</span> <span className="profit">+${((+amount * leverage) * (+tp / 100)).toFixed(1)}</span></div>
                <div><span className="text-[var(--cyber-text-dim)]">SL риск:</span> <span className="loss">-${((+amount * leverage) * (+sl / 100)).toFixed(1)}</span></div>
              </div>
            </div>

            <button className={`w-full py-3 font-orbitron text-sm font-bold tracking-widest rounded-none transition-all ${
              side === "LONG"
                ? "bg-[rgba(0,255,136,0.15)] border border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.25)] hover:shadow-[0_0_20px_rgba(0,255,136,0.4)]"
                : "bg-[rgba(255,61,113,0.15)] border border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.25)] hover:shadow-[0_0_20px_rgba(255,61,113,0.4)]"
            }`}>
              ОТКРЫТЬ {side} {pair}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="cyber-card rounded-none p-5 animate-fade-in-up delay-200">
          <div className="section-label mb-4">ОРДЕРБУК BTC/USDT</div>
          <div className="space-y-0.5">
            {[69920, 69890, 69865, 69850].map((p, i) => (
              <div key={p} className="flex justify-between items-center py-1 px-2 hover:bg-[rgba(255,61,113,0.05)]">
                <span className="font-mono text-xs loss">{p.toLocaleString()}</span>
                <div className="cyber-progress flex-1 mx-3" style={{ height: 2 }}>
                  <div className="cyber-progress-bar" style={{ width: `${60 - i * 12}%`, background: "var(--cyber-red)" }} />
                </div>
                <span className="font-mono text-xs text-[var(--cyber-text-dim)]">{(1.24 - i * 0.18).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between px-2 py-2 border-y border-[var(--cyber-border)] my-1">
              <span className="font-orbitron text-sm neon-text font-bold">69,842</span>
              <span className="section-label">LAST PRICE</span>
            </div>
            {[69830, 69810, 69780, 69745].map((p, i) => (
              <div key={p} className="flex justify-between items-center py-1 px-2 hover:bg-[rgba(0,255,136,0.05)]">
                <span className="font-mono text-xs profit">{p.toLocaleString()}</span>
                <div className="cyber-progress flex-1 mx-3" style={{ height: 2 }}>
                  <div className="cyber-progress-bar" style={{ width: `${45 + i * 10}%` }} />
                </div>
                <span className="font-mono text-xs text-[var(--cyber-text-dim)]">{(0.85 + i * 0.3).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="cyber-card rounded-none p-5 animate-fade-in-up delay-300">
          <div className="section-label mb-3">БАЛАНС БИРЖИ</div>
          <div className="space-y-2">
            {[
              { coin: "USDT", val: "12,450.00", sub: "Доступно" },
              { coin: "BTC", val: "0.1842", sub: "В позиции" },
              { coin: "ETH", val: "2.45", sub: "В позиции" },
            ].map(b => (
              <div key={b.coin} className="flex justify-between items-center py-2 border-b border-[rgba(26,58,74,0.4)]">
                <div>
                  <div className="font-mono text-sm text-[var(--cyber-text)]">{b.coin}</div>
                  <div className="section-label">{b.sub}</div>
                </div>
                <div className="font-mono text-sm neon-text-cyan">{b.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
                    <div className={`font-mono text-sm font-semibold ${s.today > 0 ? "profit" : "neutral"}`}>
                      {s.today > 0 ? `+$${s.today}` : "—"}
                    </div>
                    <div className="section-label">сегодня</div>
                  </div>
                  <button
                    onClick={() => setStrategies(prev => prev.map((st, j) => j === i ? { ...st, status: !st.status } : st))}
                    className={`px-4 py-1.5 font-mono text-xs rounded-none transition-all border ${
                      s.status
                        ? "border-[var(--cyber-red)] text-[var(--cyber-red)] hover:bg-[rgba(255,61,113,0.1)]"
                        : "border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.1)]"
                    }`}
                  >
                    {s.status ? "СТОП" : "СТАРТ"}
                  </button>
                </div>
              </div>
              {s.status && (
                <div className="mt-3">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="cyber-card rounded-none p-4 animate-fade-in-up delay-300">
          <div className="section-label mb-3">ПАРАМЕТРЫ RSI</div>
          <div className="space-y-2">
            {[
              { label: "Период RSI", val: "14" },
              { label: "Уровень перекупки", val: "70" },
              { label: "Уровень перепродажи", val: "30" },
              { label: "Таймфрейм", val: "15m" },
            ].map(p => (
              <div key={p.label} className="flex justify-between py-1 border-b border-[rgba(26,58,74,0.4)]">
                <span className="font-mono text-xs text-[var(--cyber-text-dim)]">{p.label}</span>
                <span className="font-mono text-xs neon-text-cyan">{p.val}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="cyber-card rounded-none p-4 animate-fade-in-up delay-400">
          <div className="section-label mb-3">ПАРАМЕТРЫ GRID</div>
          <div className="space-y-2">
            {[
              { label: "Кол-во ячеек", val: "20" },
              { label: "Диапазон", val: "±5%" },
              { label: "Объём на ячейку", val: "$50" },
              { label: "Реинвестирование", val: "ON" },
            ].map(p => (
              <div key={p.label} className="flex justify-between py-1 border-b border-[rgba(26,58,74,0.4)]">
                <span className="font-mono text-xs text-[var(--cyber-text-dim)]">{p.label}</span>
                <span className="font-mono text-xs neon-text-cyan">{p.val}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="cyber-card rounded-none p-4 animate-fade-in-up delay-500">
          <div className="section-label mb-3">РИСК ЛИМИТЫ</div>
          <div className="space-y-2">
            {[
              { label: "Макс. просадка", val: "10%" },
              { label: "Макс. позиция", val: "$500" },
              { label: "Дневной лимит потерь", val: "$200" },
              { label: "Макс. открытых", val: "5" },
            ].map(p => (
              <div key={p.label} className="flex justify-between py-1 border-b border-[rgba(26,58,74,0.4)]">
                <span className="font-mono text-xs text-[var(--cyber-text-dim)]">{p.label}</span>
                <span className="font-mono text-xs text-[var(--cyber-yellow)]">{p.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
            <div className={`font-orbitron text-xl font-bold ${
              s.color === "green" ? "neon-text" : s.color === "cyan" ? "neon-text-cyan" : s.color === "red" ? "text-[var(--cyber-red)]" : "text-[var(--cyber-yellow)]"
            }`}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="cyber-card rounded-none p-5 animate-fade-in-up delay-200">
        <div className="flex items-center justify-between mb-4">
          <div className="section-label">ИСТОРИЯ СДЕЛОК</div>
          <select className="cyber-select rounded-none" style={{ width: "auto", padding: "0.25rem 0.5rem" }}>
            <option style={{ background: "#0a1520" }}>Все пары</option>
            {PAIRS.map(p => <option key={p} style={{ background: "#0a1520" }}>{p}</option>)}
          </select>
        </div>
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

function PortfolioPage() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="cyber-card-glow rounded-none p-5 animate-fade-in-up">
          <div className="section-label mb-4">РАСПРЕДЕЛЕНИЕ ПОРТФЕЛЯ</div>
          <div className="space-y-3">
            {[
              { coin: "BTC", pct: 45, val: "$5,602", color: "var(--cyber-yellow)" },
              { coin: "ETH", pct: 28, val: "$3,488", color: "var(--cyber-cyan)" },
              { coin: "SOL", pct: 15, val: "$1,868", color: "var(--cyber-green)" },
              { coin: "USDT", pct: 12, val: "$1,494", color: "var(--cyber-text-dim)" },
            ].map(a => (
              <div key={a.coin}>
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-xs text-[var(--cyber-text)]">{a.coin}</span>
                  <div className="flex gap-3">
                    <span className="font-mono text-xs" style={{ color: a.color }}>{a.pct}%</span>
                    <span className="font-mono text-xs text-[var(--cyber-text-dim)]">{a.val}</span>
                  </div>
                </div>
                <div className="cyber-progress">
                  <div className="cyber-progress-bar" style={{ width: `${a.pct}%`, background: a.color, boxShadow: `0 0 8px ${a.color}` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--cyber-border)] flex justify-between">
            <span className="section-label">ИТОГО ПОРТФЕЛЬ</span>
            <span className="font-orbitron text-sm neon-text font-bold">$12,452</span>
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
              { label: "Avg. hold time", val: "1h 42m", good: null },
            ].map(s => (
              <div key={s.label} className="flex justify-between border-b border-[rgba(26,58,74,0.4)] pb-2">
                <span className="font-mono text-xs text-[var(--cyber-text-dim)]">{s.label}</span>
                <span className={`font-mono text-xs font-semibold ${s.good === true ? "profit" : s.good === false ? "loss" : "neon-text-cyan"}`}>
                  {s.val}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GenericPage({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="cyber-card-glow rounded-none p-8 animate-fade-in-up text-center">
      <Icon name={icon} size={48} className="mx-auto mb-4" style={{ color: "var(--cyber-green)", filter: "drop-shadow(0 0 10px var(--cyber-green))" }} />
      <div className="font-orbitron text-xl neon-text mb-2">{title}</div>
      <div className="section-label">Раздел в разработке · Напишите, что здесь должно быть</div>
    </div>
  );
}

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
      case "history": return <HistoryPage />;
      case "portfolio": return <PortfolioPage />;
      case "positions": return <GenericPage title="ОТКРЫТЫЕ ПОЗИЦИИ" icon="Layers" />;
      case "arbitrage": return <GenericPage title="АРБИТРАЖ" icon="ArrowLeftRight" />;
      case "signals": return <GenericPage title="ТОРГОВЫЕ СИГНАЛЫ" icon="Radio" />;
      case "risk": return <GenericPage title="РИСК-МЕНЕДЖМЕНТ" icon="Shield" />;
      case "alerts": return <GenericPage title="АЛЕРТЫ И УВЕДОМЛЕНИЯ" icon="Bell" />;
      case "api": return <GenericPage title="API КЛЮЧИ" icon="Key" />;
      case "settings": return <GenericPage title="НАСТРОЙКИ" icon="Settings" />;
      default: return null;
    }
  };

  const activeNav = NAV_ITEMS.find(n => n.id === activeSection);

  return (
    <div className="cyber-bg min-h-screen flex" style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: "var(--cyber-text)" }}>
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-56" : "w-14"} flex-shrink-0 transition-all duration-300 relative`}
        style={{ background: "var(--cyber-surface)", borderRight: "1px solid var(--cyber-border)" }}
      >
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
              title={!sidebarOpen ? item.label : undefined}
            >
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
              <div className="section-label" style={{ fontSize: "0.6rem" }}>
                {time.toLocaleTimeString("ru-RU")} МСК
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
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
              <span className="font-mono text-xs text-[var(--cyber-green)]">BINANCE</span>
            </div>
            <div className="hidden md:block font-mono text-xs text-[var(--cyber-text-dim)] cursor-blink">
              {time.toLocaleTimeString("ru-RU")}
            </div>
            <div className="flex items-center gap-1 px-2 py-1" style={{ border: "1px solid var(--cyber-border)" }}>
              <Icon name="Wallet" size={14} style={{ color: "var(--cyber-cyan)" }} />
              <span className="font-mono text-xs neon-text-cyan">$12,450</span>
            </div>
            <button className="cyber-btn p-1.5 rounded-none">
              <Icon name="Bell" size={14} />
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}