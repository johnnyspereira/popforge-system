-- POPForge-only operating capital and cost ledger. Sales and POS payments stay
-- in the existing finance_* tables; this table records the business capital
-- and operating costs required to calculate a true ecommerce margin.
CREATE TABLE IF NOT EXISTS commerce_financial_entries (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  entry_type ENUM('initial_investment','capital_injection','operating_expense','owner_draw') NOT NULL,
  category VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  occurred_on DATE NOT NULL,
  payment_method VARCHAR(64) NULL,
  reference VARCHAR(160) NULL,
  commerce_order_id CHAR(36) NULL,
  production_job_id CHAR(36) NULL,
  notes TEXT NULL,
  created_by_user_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY commerce_financial_entries_account_date (account_id, occurred_on),
  KEY commerce_financial_entries_order (commerce_order_id),
  CONSTRAINT commerce_financial_entries_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT commerce_financial_entries_order_fk FOREIGN KEY (commerce_order_id) REFERENCES commerce_orders(id) ON DELETE SET NULL,
  CONSTRAINT commerce_financial_entries_job_fk FOREIGN KEY (production_job_id) REFERENCES commerce_production_jobs(id) ON DELETE SET NULL,
  CONSTRAINT commerce_financial_entries_user_fk FOREIGN KEY (created_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT commerce_financial_entries_amount_check CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
