ALTER TABLE t_p28097026_crypto_bot_profit.users
  ADD COLUMN IF NOT EXISTS bingx_api_key text NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bingx_secret_key text NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS t_p28097026_crypto_bot_profit.bingx_spot_trades (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p28097026_crypto_bot_profit.users(id),
  symbol VARCHAR(32) NOT NULL,
  side VARCHAR(8) NOT NULL DEFAULT 'BUY',
  quantity NUMERIC(20,8) NOT NULL DEFAULT 0,
  price NUMERIC(20,8) NOT NULL DEFAULT 0,
  close_price NUMERIC(20,8) NULL,
  amount_usdt NUMERIC(12,4) NOT NULL DEFAULT 0,
  pnl NUMERIC(12,4) NULL,
  order_id VARCHAR(64) NULL,
  target_pct NUMERIC(6,2) NOT NULL DEFAULT 0.8,
  stop_pct NUMERIC(6,2) NOT NULL DEFAULT 1.5,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS t_p28097026_crypto_bot_profit.bingx_futures_trades (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p28097026_crypto_bot_profit.users(id),
  symbol VARCHAR(32) NOT NULL,
  side VARCHAR(8) NOT NULL,
  pos_side VARCHAR(8) NOT NULL DEFAULT 'LONG',
  quantity NUMERIC(20,8) NOT NULL DEFAULT 0,
  entry_price NUMERIC(20,8) NULL,
  close_price NUMERIC(20,8) NULL,
  leverage INTEGER NOT NULL DEFAULT 10,
  pnl NUMERIC(12,4) NULL,
  order_id VARCHAR(64) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL
);
