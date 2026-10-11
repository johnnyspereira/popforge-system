CREATE TABLE IF NOT EXISTS commerce_customer_sessions (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  contact_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY commerce_customer_sessions_token_unique (token_hash),
  KEY commerce_customer_sessions_contact_idx (account_id, contact_id, expires_at),
  CONSTRAINT commerce_customer_sessions_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT commerce_customer_sessions_contact_fk FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
