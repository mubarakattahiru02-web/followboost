CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email_hash TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  device_hash TEXT NOT NULL UNIQUE,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_device_hash_idx
ON users(device_hash);
