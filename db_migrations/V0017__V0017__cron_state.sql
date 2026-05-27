CREATE TABLE IF NOT EXISTS t_p28097026_crypto_bot_profit.cron_state (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO t_p28097026_crypto_bot_profit.cron_state (key, value) VALUES
  ('enabled', 'false'),
  ('interval_min', '15'),
  ('last_ping', '1970-01-01T00:00:00+00:00'),
  ('last_trade_run', '1970-01-01T00:00:00+00:00'),
  ('cycle_count', '0'),
  ('status', 'stopped')
ON CONFLICT (key) DO NOTHING;
