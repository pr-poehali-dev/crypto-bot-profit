CREATE TABLE IF NOT EXISTS t_p28097026_crypto_bot_profit.portfolio_scalp_settings (
  user_id   INTEGER NOT NULL PRIMARY KEY REFERENCES t_p28097026_crypto_bot_profit.users(id),
  enabled   BOOLEAN NOT NULL DEFAULT false,
  target_pct NUMERIC(6,2) NOT NULL DEFAULT 2.0,
  stop_pct   NUMERIC(6,2) NOT NULL DEFAULT 3.0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO t_p28097026_crypto_bot_profit.portfolio_scalp_settings (user_id, enabled, target_pct, stop_pct)
SELECT id, false, 2.0, 3.0 FROM t_p28097026_crypto_bot_profit.users
ON CONFLICT (user_id) DO NOTHING;
