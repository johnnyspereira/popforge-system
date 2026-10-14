-- Internal technical files (G-code, 3MF, STL and job notes). These records
-- are deliberately separate from customer-facing storefront attachments.
CREATE TABLE IF NOT EXISTS commerce_production_files (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  production_job_id CHAR(36) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(160) NULL,
  byte_size BIGINT NOT NULL,
  uploaded_by_user_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY commerce_production_files_job_idx (production_job_id, created_at),
  CONSTRAINT commerce_production_files_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT commerce_production_files_job_fk FOREIGN KEY (production_job_id) REFERENCES commerce_production_jobs(id) ON DELETE CASCADE,
  CONSTRAINT commerce_production_files_user_fk FOREIGN KEY (uploaded_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
