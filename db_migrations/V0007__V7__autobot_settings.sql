INSERT INTO t_p28097026_crypto_bot_profit.bot_settings (user_id, key, value)
SELECT 1, k, v FROM (VALUES
  ('auto_bot_enabled', 'false'),
  ('trade_mode', '10pct'),
  ('trade_fixed_amount', '5000'),
  ('bot_last_run', '—'),
  ('bot_last_trades', '[]'),
  ('bot_daily_pnl', '0')
) AS t(k, v)
ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value;