-- POPForge workshop operations: actual material usage, manual orders and a
-- direct finance link. No legacy service/clinic data is referenced here.

ALTER TABLE commerce_inventory_items
  MODIFY COLUMN item_type ENUM('filament','packaging','consumable','paint','tool','finished_product') NOT NULL;

ALTER TABLE commerce_orders
  ADD COLUMN finance_sale_id CHAR(36) NULL AFTER contact_id,
  ADD KEY commerce_orders_finance_sale_idx (finance_sale_id),
  ADD CONSTRAINT commerce_orders_finance_sale_fk FOREIGN KEY (finance_sale_id) REFERENCES finance_sales(id) ON DELETE SET NULL;

ALTER TABLE commerce_production_jobs
  ADD COLUMN order_id CHAR(36) NULL AFTER account_id,
  ADD COLUMN title VARCHAR(180) NULL AFTER order_item_id,
  ADD COLUMN priority ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal' AFTER status,
  ADD COLUMN due_date DATE NULL AFTER priority,
  ADD COLUMN internal_notes TEXT NULL AFTER failure_reason,
  ADD COLUMN actual_labor_minutes INT NULL AFTER actual_minutes,
  ADD COLUMN actual_energy_cost DECIMAL(12,2) NULL AFTER actual_labor_minutes,
  ADD COLUMN actual_other_cost DECIMAL(12,2) NULL AFTER actual_energy_cost,
  ADD KEY commerce_jobs_order_idx (order_id),
  ADD CONSTRAINT commerce_jobs_order_fk FOREIGN KEY (order_id) REFERENCES commerce_orders(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS commerce_production_material_usage (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  production_job_id CHAR(36) NOT NULL,
  inventory_item_id CHAR(36) NOT NULL,
  usage_type ENUM('planned','actual','waste') NOT NULL DEFAULT 'actual',
  quantity DECIMAL(12,3) NOT NULL,
  unit_cost DECIMAL(12,6) NOT NULL DEFAULT 0,
  item_sku VARCHAR(100) NULL,
  item_name VARCHAR(180) NOT NULL,
  notes TEXT NULL,
  recorded_by_user_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY commerce_material_usage_job_idx (production_job_id, created_at),
  KEY commerce_material_usage_inventory_idx (inventory_item_id, created_at),
  CONSTRAINT commerce_material_usage_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT commerce_material_usage_job_fk FOREIGN KEY (production_job_id) REFERENCES commerce_production_jobs(id) ON DELETE CASCADE,
  CONSTRAINT commerce_material_usage_inventory_fk FOREIGN KEY (inventory_item_id) REFERENCES commerce_inventory_items(id) ON DELETE RESTRICT,
  CONSTRAINT commerce_material_usage_user_fk FOREIGN KEY (recorded_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT commerce_material_usage_quantity_check CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
