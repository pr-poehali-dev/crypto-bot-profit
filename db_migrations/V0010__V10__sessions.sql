CREATE TABLE t_p28097026_crypto_bot_profit.sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p28097026_crypto_bot_profit.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  ip VARCHAR(64),
  user_agent VARCHAR(256)
);
CREATE INDEX idx_sessions_user ON t_p28097026_crypto_bot_profit.sessions(user_id);
CREATE INDEX idx_sessions_expires ON t_p28097026_crypto_bot_profit.sessions(expires_at);