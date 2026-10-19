import { useState } from "react";
import Icon from "@/components/ui/icon";

type Status = "connected" | "soon";

interface Exchange {
  id: string;
  name: string;
  status: Status;
  about: string;
  features: string[];
  connect: string[];
  risks: string[];
}

const COMMON_CONNECT_TAIL = [
  "Права на ключ: только «Чтение» и «Спотовая торговля». Вывод средств НЕ включай",
  "Включи привязку ключа к IP-адресу, если биржа это поддерживает",
  "Вставь ключ в разделе «API Ключи» платформы",
];

const EXCHANGES: Exchange[] = [
  {
    id: "bingx",
    name: "BingX",
    status: "connected",
    about: "Биржа со спотом, фьючерсами и копи-трейдингом. Уже подключена к платформе.",
    features: ["Спот и фьючерсы", "Копи-трейдинг", "Много альткоинов"],
    connect: ["Зарегистрируйся и пройди верификацию на бирже", "В профиле биржи создай API-ключ", ...COMMON_CONNECT_TAIL],
    risks: ["Фьючерсы с плечом могут привести к потере всего депозита", "Низколиквидные монеты резко меняют цену", "Верификация и доступность зависят от твоей страны"],
  },
  {
    id: "binance",
    name: "Binance",
    status: "soon",
    about: "Крупнейшая по объёмам биржа: самый большой выбор монет и высокая ликвидность.",
    features: ["Спот, фьючерсы, маржа", "Высокая ликвидность", "Большой выбор монет"],
    connect: ["Зарегистрируйся и пройди верификацию", "Раздел «Управление API» — создай ключ", ...COMMON_CONNECT_TAIL],
    risks: ["Доступность для жителей разных стран меняется — проверяй условия", "Регуляторные ограничения и блокировки аккаунтов", "Плечо и маржа — риск потери депозита"],
  },
  {
    id: "bybit",
    name: "Bybit",
    status: "soon",
    about: "Биржа с упором на деривативы, также есть спот и копи-трейдинг.",
    features: ["Деривативы", "Спот", "Копи-трейдинг"],
    connect: ["Зарегистрируйся и пройди верификацию", "В разделе API создай ключ", ...COMMON_CONNECT_TAIL],
    risks: ["Доступность зависит от страны", "Высокие риски при торговле с плечом", "Ликвидация позиции при резком движении цены"],
  },
  {
    id: "okx",
    name: "OKX",
    status: "soon",
    about: "Универсальная биржа: спот, фьючерсы, опционы и встроенный Web3-кошелёк.",
    features: ["Спот, фьючерсы, опционы", "Web3-кошелёк", "Демо-режим торговли"],
    connect: ["Зарегистрируйся и пройди верификацию", "В разделе API создай ключ с парольной фразой", ...COMMON_CONNECT_TAIL],
    risks: ["Доступность зависит от страны", "Сложный интерфейс для новичков", "Риски плеча и опционов"],
  },
  {
    id: "kucoin",
    name: "KuCoin",
    status: "soon",
    about: "Биржа с очень широким выбором альткоинов, в том числе новых.",
    features: ["Много новых монет", "Спот и фьючерсы", "Торговые боты"],
    connect: ["Зарегистрируйся и пройди верификацию", "В разделе API создай ключ", ...COMMON_CONNECT_TAIL],
    risks: ["Новые монеты часто теряют в цене", "Низкая ликвидность у редких токенов", "Доступность зависит от страны"],
  },
  {
    id: "gate",
    name: "Gate.io",
    status: "soon",
    about: "Биржа с огромным списком токенов и ранними листингами.",
    features: ["Очень много токенов", "Спот и фьючерсы", "Ранние листинги"],
    connect: ["Зарегистрируйся и пройди верификацию", "В разделе API создай ключ", ...COMMON_CONNECT_TAIL],
    risks: ["Высокий риск у малоизвестных токенов", "Возможны «скам»-проекты", "Доступность зависит от страны"],
  },
  {
    id: "mexc",
    name: "MEXC",
    status: "soon",
    about: "Биржа с большим числом монет и быстрыми листингами новых токенов.",
    features: ["Быстрые листинги", "Спот и фьючерсы", "Много альткоинов"],
    connect: ["Зарегистрируйся и пройди верификацию", "В разделе API создай ключ", ...COMMON_CONNECT_TAIL],
    risks: ["Новые токены очень волатильны", "Высок риск «пампов и дампов»", "Доступность зависит от страны"],
  },
  {
    id: "bitget",
    name: "Bitget",
    status: "soon",
    about: "Биржа, известная копи-трейдингом: можно повторять сделки опытных трейдеров.",
    features: ["Копи-трейдинг", "Спот и фьючерсы", "Торговые боты"],
    connect: ["Зарегистрируйся и пройди верификацию", "В разделе API создай ключ с парольной фразой", ...COMMON_CONNECT_TAIL],
    risks: ["Копирование чужих сделок не гарантирует прибыль", "Риски плеча", "Доступность зависит от страны"],
  },
  {
    id: "htx",
    name: "HTX",
    status: "soon",
    about: "Старая биржа (бывший Huobi) со спотом, фьючерсами и широким выбором монет.",
    features: ["Спот и фьючерсы", "Широкий выбор монет", "Давно на рынке"],
    connect: ["Зарегистрируйся и пройди верификацию", "В разделе API создай ключ", ...COMMON_CONNECT_TAIL],
    risks: ["Репутационные и регуляторные риски", "Доступность зависит от страны", "Риски плеча"],
  },
  {
    id: "kraken",
    name: "Kraken",
    status: "soon",
    about: "Одна из старейших бирж с акцентом на безопасность и соблюдение требований регуляторов.",
    features: ["Строгое соблюдение правил", "Спот и фьючерсы", "Высокая безопасность"],
    connect: ["Зарегистрируйся и пройди полную верификацию", "В настройках создай API-ключ", ...COMMON_CONNECT_TAIL],
    risks: ["Жёсткие ограничения по странам", "Более высокие комиссии на некоторых парах", "Строгая верификация"],
  },
  {
    id: "coinbase",
    name: "Coinbase",
    status: "soon",
    about: "Простая в использовании биржа, ориентированная на новичков и регулируемые рынки.",
    features: ["Простой интерфейс", "Регулируемая биржа", "Удобно для новичков"],
    connect: ["Зарегистрируйся и пройди верификацию", "В настройках создай API-ключ", ...COMMON_CONNECT_TAIL],
    risks: ["Ограничения по странам", "Выше комиссии, чем у многих конкурентов", "Меньше экзотических монет"],
  },
];

function ExchangeCard({ ex, onBack }: { ex: Exchange; onBack: () => void }) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <button onClick={onBack} className="font-mono text-xs text-[var(--cyber-cyan)] flex items-center gap-1 hover:opacity-80">
        <Icon name="ArrowLeft" size={13} /> Ко всем биржам
      </button>

      <div className="cyber-card-glow rounded-none p-4">
        <div className="flex items-center justify-between">
          <div className="font-orbitron text-lg font-bold neon-text">{ex.name}</div>
          <span
            className="font-mono text-[10px] px-2 py-1 border"
            style={{
              color: ex.status === "connected" ? "var(--cyber-green)" : "var(--cyber-yellow)",
              borderColor: ex.status === "connected" ? "var(--cyber-green)" : "var(--cyber-yellow)",
            }}
          >
            {ex.status === "connected" ? "ПОДКЛЮЧЕНА" : "СКОРО"}
          </span>
        </div>
        <p className="font-mono text-xs text-[var(--cyber-text-dim)] leading-relaxed mt-2">{ex.about}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {ex.features.map(f => (
            <span key={f} className="font-mono text-[10px] px-2 py-0.5 border border-[var(--cyber-border)] text-[var(--cyber-text)]">{f}</span>
          ))}
        </div>
      </div>

      <div className="cyber-card rounded-none p-5">
        <div className="section-label mb-3 flex items-center gap-1.5"><Icon name="Plug" size={13} /> КАК ПОДКЛЮЧИТЬ</div>
        <ol className="space-y-2">
          {ex.connect.map((s, i) => (
            <li key={i} className="flex gap-2.5 font-mono text-xs text-[var(--cyber-text-dim)] leading-relaxed">
              <span className="neon-text font-bold shrink-0">{i + 1}.</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="cyber-card rounded-none p-5 border border-[rgba(255,61,113,0.35)]">
        <div className="section-label mb-3 flex items-center gap-1.5 text-[var(--cyber-red)]"><Icon name="TriangleAlert" size={13} /> РИСКИ</div>
        <ul className="space-y-2">
          {ex.risks.map((r, i) => (
            <li key={i} className="flex gap-2 font-mono text-xs text-[var(--cyber-text-dim)] leading-relaxed">
              <span className="text-[var(--cyber-red)] shrink-0">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="cyber-card rounded-none p-4 font-mono text-[11px] text-[var(--cyber-text-dim)] leading-relaxed">
        Криптовалюты очень волатильны — можно потерять вложенное. Платформа не хранит твои деньги: средства остаются на твоём аккаунте биржи. Это не инвестиционная рекомендация.
      </div>
    </div>
  );
}

function CreditInfo() {
  return (
    <div className="cyber-card rounded-none p-5 border border-[rgba(255,200,0,0.3)] space-y-3">
      <div className="section-label text-[var(--cyber-yellow)] flex items-center gap-1.5">
        <Icon name="Landmark" size={13} /> КРЕДИТ НА ПОКУПКУ КРИПТЫ
      </div>
      <p className="font-mono text-xs text-[var(--cyber-text-dim)] leading-relaxed">
        Платформа сама не выдаёт кредиты. Планируем подбор предложений банков-партнёров: пользователь оставляет заявку, банк принимает решение сам, платформа получает партнёрское вознаграждение. Раздел появится после заключения договоров с банками.
      </p>
      <div className="p-2.5 border border-[var(--cyber-red)] font-mono text-[11px] text-[var(--cyber-red)] leading-relaxed">
        Важно: покупка криптовалюты в долг очень рискованна. Если курс упадёт, кредит всё равно придётся вернуть с процентами.
      </div>
    </div>
  );
}

export default function CryptoExchangesPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const ex = EXCHANGES.find(e => e.id === selected);

  if (ex) return <ExchangeCard ex={ex} onBack={() => setSelected(null)} />;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="cyber-card-glow rounded-none p-4">
        <div className="font-orbitron text-base font-bold neon-text">КРИПТОБИРЖИ</div>
        <div className="font-mono text-[11px] text-[var(--cyber-text-dim)] mt-1">
          Выбери биржу — расскажем, как её подключить и какие у неё риски
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {EXCHANGES.map(e => (
          <button
            key={e.id}
            onClick={() => setSelected(e.id)}
            className="cyber-card rounded-none p-4 text-left hover:border-[var(--cyber-green)] transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="font-orbitron text-sm font-bold text-[var(--cyber-text)]">{e.name}</span>
              <span
                className="font-mono text-[9px] px-1.5 py-0.5 border"
                style={{
                  color: e.status === "connected" ? "var(--cyber-green)" : "var(--cyber-yellow)",
                  borderColor: e.status === "connected" ? "var(--cyber-green)" : "var(--cyber-yellow)",
                }}
              >
                {e.status === "connected" ? "ПОДКЛЮЧЕНА" : "СКОРО"}
              </span>
            </div>
            <p className="font-mono text-[11px] text-[var(--cyber-text-dim)] leading-relaxed mt-2 line-clamp-2">{e.about}</p>
          </button>
        ))}
      </div>

      <CreditInfo />
    </div>
  );
}
