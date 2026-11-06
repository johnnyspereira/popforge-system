-- Per-piece production tracking for kits and multi-unit orders.
CREATE TABLE IF NOT EXISTS commerce_production_units (
  id CHAR(36) NOT NULL, account_id CHAR(36) NOT NULL, production_job_id CHAR(36) NOT NULL,
  unit_number INT NOT NULL, status ENUM('pending','printing','printed','quality_check','approved','rejected','reprint') NOT NULL DEFAULT 'pending',
  color VARCHAR(80) NULL, material_inventory_id CHAR(36) NULL, printed_at DATETIME(3) NULL,
  quality_checked_at DATETIME(3) NULL, quality_notes TEXT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY (id),
  UNIQUE KEY commerce_production_unit_number_unique (production_job_id, unit_number), KEY commerce_production_units_queue_idx (account_id, status, created_at),
  CONSTRAINT commerce_production_units_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT commerce_production_units_job_fk FOREIGN KEY (production_job_id) REFERENCES commerce_production_jobs(id) ON DELETE CASCADE,
  CONSTRAINT commerce_production_units_material_fk FOREIGN KEY (material_inventory_id) REFERENCES commerce_inventory_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO commerce_production_units(id,account_id,production_job_id,unit_number,status)
SELECT UUID(), j.account_id, j.id, 1, CASE WHEN j.status='completed' THEN 'approved' WHEN j.status='printing' THEN 'printing' ELSE 'pending' END
FROM commerce_production_jobs j;
