CREATE TABLE t_p28097026_crypto_bot_profit.strategies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  description TEXT,
  type VARCHAR(32) NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  pairs TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);