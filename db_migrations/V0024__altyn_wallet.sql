ALTER TABLE t_p28097026_crypto_bot_profit.users
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS t_p28097026_crypto_bot_profit.wallet_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p28097026_crypto_bot_profit.users(id),
  kind VARCHAR(16) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  provider VARCHAR(16),
  payment_id VARCHAR(128),
  description VARCHAR(256),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON t_p28097026_crypto_bot_profit.wallet_transactions(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_payment ON t_p28097026_crypto_bot_profit.wallet_transactions(provider, payment_id) WHERE payment_id IS NOT NULL AND kind = 'topup';