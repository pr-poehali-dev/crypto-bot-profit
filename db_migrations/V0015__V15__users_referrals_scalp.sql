-- Расширяем users: email, tokens, реферал
ALTER TABLE t_p28097026_crypto_bot_profit.users
  ADD COLUMN IF NOT EXISTS email VARCHAR(128),
  ADD COLUMN IF NOT EXISTS tbank_token TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS binance_api_key TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS binance_secret_key TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES t_p28097026_crypto_bot_profit.users(id),
  ADD COLUMN IF NOT EXISTS ref_code VARCHAR(16) UNIQUE,
  ADD COLUMN IF NOT EXISTS plan VARCHAR(16) DEFAULT 'free';

-- Реферальные начисления
CREATE TABLE t_p28097026_crypto_bot_profit.referral_earnings (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES t_p28097026_crypto_bot_profit.users(id),
  from_user_id INTEGER NOT NULL REFERENCES t_p28097026_crypto_bot_profit.users(id),
  trade_amount NUMERIC(20,2) NOT NULL,
  earn_pct NUMERIC(6,4) NOT NULL,
  earned NUMERIC(20,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Скальпинг-сделки
CREATE TABLE t_p28097026_crypto_bot_profit.scalp_trades (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p28097026_crypto_bot_profit.users(id),
  figi VARCHAR(32) NOT NULL,
  ticker VARCHAR(16) NOT NULL,
  lots INTEGER NOT NULL,
  buy_price NUMERIC(20,4) NOT NULL,
  sell_price NUMERIC(20,4),
  amount NUMERIC(20,2) NOT NULL,
  target_pct NUMERIC(6,2) NOT NULL DEFAULT 1.0,
  stop_pct NUMERIC(6,2) NOT NULL DEFAULT 2.0,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  pnl NUMERIC(20,2),
  pnl_pct NUMERIC(10,4),
  order_buy_id VARCHAR(64),
  order_sell_id VARCHAR(64),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX idx_scalp_user ON t_p28097026_crypto_bot_profit.scalp_trades(user_id);
CREATE INDEX idx_scalp_status ON t_p28097026_crypto_bot_profit.scalp_trades(status);

-- Настройки пользователей (расширяем bot_settings до user_settings)
CREATE TABLE t_p28097026_crypto_bot_profit.user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p28097026_crypto_bot_profit.users(id),
  key VARCHAR(64) NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- Реф-код для admin/raziklon
UPDATE t_p28097026_crypto_bot_profit.users SET ref_code = 'RAZIKLON' WHERE username = 'raziklon';

-- Настройки реферальной системы (глобальные)
INSERT INTO t_p28097026_crypto_bot_profit.bot_settings (user_id, key, value)
SELECT 1, k, v FROM (VALUES
  ('ref_earn_pct', '0.5'),
  ('ref_earn_mode', 'trade_amount'),
  ('scalp_default_target_pct', '1.0'),
  ('scalp_default_stop_pct', '2.0'),
  ('scalp_enabled', 'false')
) AS t(k, v)
ON CONFLICT (user_id, key) DO NOTHING;