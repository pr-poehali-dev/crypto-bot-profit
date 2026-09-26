CREATE TABLE t_p28097026_crypto_bot_profit.manual_trades (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p28097026_crypto_bot_profit.users(id),
  broker VARCHAR(16) NOT NULL, -- 'sberbank' | 'vtb'
  ticker VARCHAR(32) NOT NULL,
  lots INTEGER NOT NULL DEFAULT 1,
  buy_price NUMERIC(20,4) NOT NULL,
  sell_price NUMERIC(20,4),
  amount NUMERIC(20,2) NOT NULL,
  pnl NUMERIC(20,2),
  pnl_pct NUMERIC(10,4),
  status VARCHAR(16) NOT NULL DEFAULT 'open', -- 'open' | 'closed'
  comment VARCHAR(256),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX idx_manual_trades_user ON t_p28097026_crypto_bot_profit.manual_trades(user_id);
CREATE INDEX idx_manual_trades_broker ON t_p28097026_crypto_bot_profit.manual_trades(broker);
