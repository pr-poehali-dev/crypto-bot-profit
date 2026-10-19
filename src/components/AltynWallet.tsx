import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

type FetchFn = (url: string, opts?: RequestInit) => Promise<Response>;

interface PlanOut { name: string; price_rub: number; desc: string }
interface Tx { kind: string; amount: number | string; status: string; description: string; created_at: string }
interface WalletData {
  balance: number; plan: string; plan_expires_at: string | null; days_left: number | null;
  history: Tx[]; plans: Record<string, PlanOut>; min_topup: number; max_topup: number;
  robokassa: boolean; yookassa: boolean;
}

const QUICK = [500, 1000, 3000, 5000];

export default function AltynWallet({ paymentUrl, authFetch }: { paymentUrl: string; authFetch: FetchFn }) {
  const [data, setData] = useState<WalletData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("1000");
  const [provider, setProvider] = useState<"robokassa" | "yookassa">("robokassa");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    authFetch(`${paymentUrl}?action=wallet`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setError(null);
        setData(d);
        setProvider(p => (p === "robokassa" && !d.robokassa && d.yookassa ? "yookassa" : p));
      })
      .catch(() => setError("Нет связи с сервером"));
  }, [authFetch, paymentUrl]);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4500);
  };

  const topup = async () => {
    setBusy(true);
    try {
      const r = await authFetch(paymentUrl, {
        method: "POST",
        body: JSON.stringify({ action: "wallet_topup", amount: Number(amount), provider, return_url: window.location.href }),
      });
      const d = await r.json();
      if (d.ok && d.payment_url) window.location.href = d.payment_url;
      else flash(d.error || "Не удалось создать платёж", false);
    } catch {
      flash("Нет связи с сервером", false);
    }
    setBusy(false);
  };

  const payPlan = async (plan: string) => {
    setBusy(true);
    try {
      const r = await authFetch(paymentUrl, { method: "POST", body: JSON.stringify({ action: "wallet_pay_plan", plan }) });
      const d = await r.json();
      if (d.ok) { flash(`Тариф ${plan.toUpperCase()} включён на 30 дней`, true); load(); }
      else flash(d.error || "Не удалось оплатить", false);
    } catch {
      flash("Нет связи с сервером", false);
    }
    setBusy(false);
  };

  if (error) return <div className="cyber-card rounded-none p-6 font-mono text-xs loss">{error}</div>;
  if (!data) return <div className="cyber-card rounded-none p-6 font-mono text-xs text-[var(--cyber-text-dim)]">Загрузка кошелька...</div>;

  const paid = data.plan !== "free" && data.days_left !== null;
  const noProviders = !data.robokassa && !data.yookassa;

  return (
    <div className="max-w-2xl space-y-4 animate-fade-in-up">
      {msg && <div className={`p-3 border font-mono text-xs ${msg.ok ? "border-[var(--cyber-green)] profit" : "border-[var(--cyber-red)] loss"}`}>{msg.text}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="cyber-card-glow rounded-none p-4">
          <div className="section-label mb-1 flex items-center gap-1.5"><Icon name="Wallet" size={12} /> КОШЕЛЁК АЛТЫН</div>
          <div className="font-orbitron text-2xl font-bold neon-text">{data.balance.toFixed(2)} ₽</div>
          <div className="font-mono text-[10px] text-[var(--cyber-text-dim)] mt-1">Доступно для оплаты тарифов</div>
        </div>
        <div className="cyber-card-glow rounded-none p-4">
          <div className="section-label mb-1 flex items-center gap-1.5"><Icon name="CalendarClock" size={12} /> ТАРИФ</div>
          <div className="font-orbitron text-2xl font-bold neon-text-cyan">{data.plan.toUpperCase()}</div>
          <div className="font-mono text-[10px] text-[var(--cyber-text-dim)] mt-1">
            {paid
              ? `Осталось ${data.days_left} дн. · до ${new Date(data.plan_expires_at as string).toLocaleDateString("ru-RU")}`
              : "Платный тариф не активен"}
          </div>
        </div>
      </div>

      <div className="cyber-card rounded-none p-5 space-y-3">
        <div className="section-label">ПОПОЛНИТЬ КОШЕЛЁК</div>
        <div className="flex flex-wrap gap-2">
          {QUICK.map(q => (
            <button key={q} onClick={() => setAmount(String(q))}
              className={`px-3 py-1.5 font-mono text-xs border transition-all ${Number(amount) === q ? "border-[var(--cyber-green)] text-[var(--cyber-green)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
              {q} ₽
            </button>
          ))}
        </div>
        <input value={amount} onChange={e => setAmount(e.target.value)} type="number" min={data.min_topup} max={data.max_topup}
          className="w-full bg-[var(--cyber-bg-3)] border border-[var(--cyber-border)] text-[var(--cyber-text)] font-mono text-sm px-3 py-2 rounded-none outline-none focus:border-[var(--cyber-green)]" />
        <div className="font-mono text-[10px] text-[var(--cyber-text-dim)]">От {data.min_topup} до {data.max_topup} ₽</div>

        {data.robokassa && data.yookassa && (
          <div className="flex gap-2">
            {(["robokassa", "yookassa"] as const).map(p => (
              <button key={p} onClick={() => setProvider(p)}
                className={`flex-1 py-1.5 font-mono text-xs border transition-all ${provider === p ? "border-[var(--cyber-cyan)] text-[var(--cyber-cyan)]" : "border-[var(--cyber-border)] text-[var(--cyber-text-dim)]"}`}>
                {p === "robokassa" ? "Robokassa" : "ЮKassa"}
              </button>
            ))}
          </div>
        )}

        {noProviders ? (
          <div className="p-3 border border-[var(--cyber-yellow)] font-mono text-[11px] text-[var(--cyber-yellow)]">
            Платёжные системы ещё не подключены. Пополнение заработает после подключения Robokassa или ЮKassa в настройках.
          </div>
        ) : (
          <button onClick={topup} disabled={busy || !Number(amount)}
            className="w-full cyber-btn-primary py-2.5 font-orbitron text-xs tracking-widest disabled:opacity-40 flex items-center justify-center gap-2">
            <Icon name="CreditCard" size={13} /> {busy ? "ПОДОЖДИ..." : `ПОПОЛНИТЬ НА ${Number(amount) || 0} ₽`}
          </button>
        )}
      </div>

      <div className="cyber-card rounded-none p-5 space-y-3">
        <div className="section-label">ОПЛАТИТЬ ТАРИФ С КОШЕЛЬКА</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(data.plans).map(([key, p]) => {
            const enough = data.balance >= p.price_rub;
            return (
              <div key={key} className="border border-[var(--cyber-border)] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-orbitron text-sm font-bold text-[var(--cyber-text)]">{p.name}</span>
                  <span className="font-orbitron text-sm neon-text">{p.price_rub} ₽</span>
                </div>
                <div className="font-mono text-[10px] text-[var(--cyber-text-dim)]">{p.desc} · 30 дней</div>
                <button onClick={() => payPlan(key)} disabled={busy || !enough}
                  className="w-full py-2 font-mono text-[11px] border border-[var(--cyber-green)] text-[var(--cyber-green)] hover:bg-[rgba(0,255,136,0.08)] disabled:opacity-40 transition-all">
                  {enough ? (data.plan === key && paid ? "ПРОДЛИТЬ НА 30 ДНЕЙ" : "ВКЛЮЧИТЬ") : "НЕ ХВАТАЕТ СРЕДСТВ"}
                </button>
              </div>
            );
          })}
        </div>
        <div className="font-mono text-[10px] text-[var(--cyber-text-dim)]">
          После оплаты тариф включается сразу и начинается отсчёт 30 дней. При продлении того же тарифа дни добавляются к остатку.
        </div>
      </div>

      <div className="cyber-card rounded-none p-5">
        <div className="section-label mb-3">ИСТОРИЯ ОПЕРАЦИЙ</div>
        {data.history.length === 0 ? (
          <div className="font-mono text-xs text-[var(--cyber-text-dim)]">Операций пока нет</div>
        ) : (
          <div className="space-y-1.5">
            {data.history.map((t, i) => {
              const v = Number(t.amount);
              return (
                <div key={i} className="flex items-center justify-between font-mono text-xs border-b border-[var(--cyber-border)] pb-1.5">
                  <div>
                    <div className="text-[var(--cyber-text)]">{t.description}</div>
                    <div className="text-[10px] text-[var(--cyber-text-dim)]">{new Date(t.created_at).toLocaleString("ru-RU")}</div>
                  </div>
                  <span className={v >= 0 ? "profit" : "loss"}>{v >= 0 ? "+" : ""}{v.toFixed(2)} ₽</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="cyber-card rounded-none p-4 border border-[rgba(255,200,0,0.3)] font-mono text-[11px] text-[var(--cyber-text-dim)] leading-relaxed">
        Кошелёк Алтын работает только внутри платформы: на нём можно оплачивать тарифы. Перевод денег на брокерский счёт или вывод на карту сейчас недоступны — банки и брокеры такой интеграции не дают.
      </div>
    </div>
  );
}
