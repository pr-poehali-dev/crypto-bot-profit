UPDATE t_p28097026_crypto_bot_profit.bot_settings
SET value = '2000-01-01T00:00:00+00:00', updated_at = NOW()
WHERE key = 'watchlist_cached_at' AND user_id = 1;