-- Commerce integrity: confirmed state, reservation ledger, customer review
-- flag and email-verified customer portal access. Additive only.

ALTER TABLE commerce_orders
  MODIFY COLUMN status ENUM('draft','pending_payment','confirmed','paid','in_production','quality_check','ready_to_ship','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'draft';

ALTER TABLE commerce_orders
  ADD COLUMN stock_state ENUM('none','reserved','released','consumed') NOT NULL DEFAULT 'none' AFTER payment_status;

ALTER TABLE commerce_orders
  ADD COLUMN customer_review_required BOOLEAN NOT NULL DEFAULT FALSE AFTER contact_id;

ALTER TABLE commerce_product_variants
  ADD COLUMN stock_reserved DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER stock_quantity;

ALTER TABLE commerce_product_variants
  ADD COLUMN stock_minimum DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER stock_reserved;

-- quantity keeps meaning "change in available stock". reserved_delta is the
-- change in reserved stock, so both columns reconcile with the variant row.
ALTER TABLE commerce_stock_movements
  ADD COLUMN reserved_delta DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER quantity;

-- Open orders created before this migration already decremented available
-- stock at checkout. Mark them as holding a reservation.
UPDATE commerce_orders o
   SET o.stock_state = 'reserved'
 WHERE o.stock_state = 'none'
   AND o.status IN ('draft','pending_payment','paid','in_production','quality_check','ready_to_ship')
   AND EXISTS (SELECT 1 FROM commerce_stock_movements m WHERE m.order_id = o.id AND m.movement_type = 'reservation');

UPDATE commerce_orders o
   SET o.stock_state = 'consumed'
 WHERE o.stock_state = 'none'
   AND o.status IN ('shipped','delivered')
   AND EXISTS (SELECT 1 FROM commerce_stock_movements m WHERE m.order_id = o.id AND m.movement_type = 'reservation');

UPDATE commerce_stock_movements m
  JOIN commerce_orders o ON o.id = m.order_id
   SET m.reserved_delta = -m.quantity
 WHERE m.movement_type = 'reservation'
   AND o.stock_state = 'reserved'
   AND m.reserved_delta = 0;

UPDATE commerce_product_variants v
  JOIN (
    SELECT variant_id, SUM(reserved_delta) AS reserved
      FROM commerce_stock_movements
     WHERE variant_id IS NOT NULL
     GROUP BY variant_id
  ) r ON r.variant_id = v.id
   SET v.stock_reserved = GREATEST(r.reserved, 0);

CREATE TABLE IF NOT EXISTS commerce_customer_login_tokens (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  contact_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY commerce_customer_login_tokens_hash_unique (token_hash),
  KEY commerce_customer_login_tokens_contact_idx (account_id, contact_id, created_at),
  CONSTRAINT commerce_customer_login_tokens_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT commerce_customer_login_tokens_contact_fk FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Portal sessions issued before email verification existed are expired, not
-- deleted, so the audit trail stays intact.
UPDATE commerce_customer_sessions
   SET expires_at = UTC_TIMESTAMP(3)
 WHERE expires_at > UTC_TIMESTAMP(3);
