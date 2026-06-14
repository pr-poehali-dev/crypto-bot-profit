-- Подписки пользователей
CREATE TABLE IF NOT EXISTS t_p28097026_crypto_bot_profit.subscriptions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES t_p28097026_crypto_bot_profit.users(id),
    plan        VARCHAR(16) NOT NULL DEFAULT 'free',   -- free / basic / pro
    price_rub   NUMERIC(10,2) NOT NULL DEFAULT 0,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    payment_id  VARCHAR(128),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Доход платформы (владельца) с каждой сделки
CREATE TABLE IF NOT EXISTS t_p28097026_crypto_bot_profit.platform_revenue (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES t_p28097026_crypto_bot_profit.users(id),
    source          VARCHAR(32) NOT NULL DEFAULT 'trade_fee',  -- trade_fee / subscription
    trade_amount    NUMERIC(20,2) NOT NULL DEFAULT 0,
    fee_pct         NUMERIC(6,4) NOT NULL DEFAULT 0.3,
    revenue         NUMERIC(20,2) NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Настройки монетизации (в bot_settings)
INSERT INTO t_p28097026_crypto_bot_profit.bot_settings (user_id, key, value)
VALUES 
    (1, 'platform_fee_pct',  '0.3'),
    (1, 'price_basic_rub',   '490'),
    (1, 'price_pro_rub',     '990')
ON CONFLICT (user_id, key) DO NOTHING;
