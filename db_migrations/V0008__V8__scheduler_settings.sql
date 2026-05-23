INSERT INTO t_p28097026_crypto_bot_profit.bot_settings (user_id, key, value)
SELECT 1, k, v FROM (VALUES
  ('scheduler_last_run', '—'),
  ('scheduler_last_result', ''),
  ('scheduler_last_error', ''),
  ('scheduler_interval_min', '60')
) AS t(k, v)
ON CONFLICT (user_id, key) DO NOTHING;