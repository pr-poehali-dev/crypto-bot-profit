CREATE TABLE t_p28097026_crypto_bot_profit.users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(256) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'user',
  email VARCHAR(128),
  telegram_chat_id BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);