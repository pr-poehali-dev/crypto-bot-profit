CREATE TABLE t_p28097026_crypto_bot_profit.trades (
  id SERIAL PRIMARY KEY,
  strategy_id INTEGER REFERENCES t_p28097026_crypto_bot_profit.strategies(id),
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(8) NOT NULL,
  order_type VARCHAR(16) NOT NULL DEFAULT 'MARKET',
  entry_price NUMERIC(20,8),
  exit_price NUMERIC(20,8),
  quantity NUMERIC(20,8) NOT NULL,
  leverage INTEGER NOT NULL DEFAULT 1,
  sl_price NUMERIC(20,8),
  tp_price NUMERIC(20,8),
  pnl NUMERIC(20,8),
  pnl_pct NUMERIC(10,4),
  fee NUMERIC(20,8) DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  binance_order_id BIGINT,
  source VARCHAR(16) NOT NULL DEFAULT 'auto',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX idx_trades_status ON t_p28097026_crypto_bot_profit.trades(status);
CREATE INDEX idx_trades_symbol ON t_p28097026_crypto_bot_profit.trades(symbol);
CREATE INDEX idx_trades_opened_at ON t_p28097026_crypto_bot_profit.trades(opened_at DESC);
CREATE INDEX idx_trades_strategy ON t_p28097026_crypto_bot_profit.trades(strategy_id);