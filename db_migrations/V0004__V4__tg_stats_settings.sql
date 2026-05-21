CREATE TABLE t_p28097026_crypto_bot_profit.tg_notifications (
  id SERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'trade',
  sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tg_notifications_sent ON t_p28097026_crypto_bot_profit.tg_notifications(sent);

CREATE TABLE t_p28097026_crypto_bot_profit.daily_stats (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_trades INTEGER NOT NULL DEFAULT 0,
  winning_trades INTEGER NOT NULL DEFAULT 0,
  losing_trades INTEGER NOT NULL DEFAULT 0,
  total_pnl NUMERIC(20,8) NOT NULL DEFAULT 0,
  total_fees NUMERIC(20,8) NOT NULL DEFAULT 0,
  best_trade NUMERIC(20,8),
  worst_trade NUMERIC(20,8),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_daily_stats_date ON t_p28097026_crypto_bot_profit.daily_stats(date DESC);

CREATE TABLE t_p28097026_crypto_bot_profit.bot_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES t_p28097026_crypto_bot_profit.users(id),
  key VARCHAR(64) NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, key)
);