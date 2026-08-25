CREATE TABLE IF NOT EXISTS t_p28097026_crypto_bot_profit.chat_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p28097026_crypto_bot_profit.users(id),
    sender_role VARCHAR(10) NOT NULL CHECK (sender_role IN ('user','admin')),
    message TEXT NOT NULL,
    is_broadcast BOOLEAN NOT NULL DEFAULT FALSE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON t_p28097026_crypto_bot_profit.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON t_p28097026_crypto_bot_profit.chat_messages(created_at);
