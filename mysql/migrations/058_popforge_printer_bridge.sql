-- POPForge local-printer bridge. The public server never opens a connection
-- to a private LAN address; a local worker posts signed telemetry instead.
CREATE TABLE IF NOT EXISTS commerce_printers (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  model VARCHAR(160) NULL,
  nozzle_diameter DECIMAL(4,2) NULL,
  local_address VARCHAR(255) NULL,
  connection_mode ENUM('manual','local_worker') NOT NULL DEFAULT 'manual',
  worker_key_hash CHAR(64) NULL,
  status ENUM('offline','idle','printing','paused','error') NOT NULL DEFAULT 'offline',
  current_file VARCHAR(255) NULL,
  progress_percent DECIMAL(5,2) NULL,
  nozzle_temperature DECIMAL(6,2) NULL,
  bed_temperature DECIMAL(6,2) NULL,
  last_error TEXT NULL,
  last_seen_at DATETIME(3) NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY commerce_printers_account_idx (account_id, created_at),
  CONSTRAINT commerce_printers_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
