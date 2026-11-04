CREATE TABLE IF NOT EXISTS member_email_challenges (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  nonce_hash TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  payer_id TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS member_email_expiry ON member_email_challenges(expires);
CREATE TABLE IF NOT EXISTS member_email_limits (
  key TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY(key, bucket)
);
