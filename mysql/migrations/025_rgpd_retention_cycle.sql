ALTER TABLE privacy_settings
  ADD COLUMN IF NOT EXISTS retention_notice_days INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS backup_retention_days INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS backup_erasure_policy TEXT NULL;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS retention_notified_at DATETIME(3) NULL;

CREATE TABLE IF NOT EXISTS privacy_retention_runs (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  actor_user_id CHAR(36) NULL,
  mode ENUM('preview','notify','execute') NOT NULL,
  status ENUM('completed','completed_with_errors','failed') NOT NULL,
  contact_count INT NOT NULL DEFAULT 0,
  anamnesis_count INT NOT NULL DEFAULT 0,
  message_count INT NOT NULL DEFAULT 0,
  attachment_count INT NOT NULL DEFAULT 0,
  excluded_count INT NOT NULL DEFAULT 0,
  details JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY privacy_retention_runs_account_idx (account_id, created_at),
  CONSTRAINT privacy_retention_runs_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT privacy_retention_runs_actor_fk FOREIGN KEY (actor_user_id) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
