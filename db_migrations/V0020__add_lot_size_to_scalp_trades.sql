ALTER TABLE t_p28097026_crypto_bot_profit.scalp_trades
ADD COLUMN IF NOT EXISTS lot_size integer NOT NULL DEFAULT 1;