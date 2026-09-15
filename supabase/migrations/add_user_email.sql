-- Add user email for transfer notifications
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
