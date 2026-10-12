-- POPForge customer account and fulfilment metadata.
-- This migration is additive: it keeps the commerce operation independent
-- while making delivery and payment choices visible to the customer portal.

ALTER TABLE commerce_orders
  ADD COLUMN payment_method VARCHAR(64) NULL AFTER payment_status,
  ADD COLUMN delivery_method VARCHAR(120) NULL AFTER shipping_total,
  ADD COLUMN delivery_status ENUM('pending','preparing','shipped','delivered','issue') NOT NULL DEFAULT 'pending' AFTER delivery_method,
  ADD COLUMN estimated_dispatch_at DATE NULL AFTER tracking_code;

CREATE TABLE IF NOT EXISTS commerce_order_documents (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  document_type ENUM('invoice','receipt','shipping_label','other') NOT NULL DEFAULT 'other',
  name VARCHAR(180) NOT NULL,
  url TEXT NOT NULL,
  created_by_user_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY commerce_order_documents_order_idx (order_id, created_at),
  CONSTRAINT commerce_order_documents_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT commerce_order_documents_order_fk FOREIGN KEY (order_id) REFERENCES commerce_orders(id) ON DELETE CASCADE,
  CONSTRAINT commerce_order_documents_user_fk FOREIGN KEY (created_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
