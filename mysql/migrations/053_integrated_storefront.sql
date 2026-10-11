ALTER TABLE commerce_products
  ADD COLUMN dimensions VARCHAR(180) NULL AFTER image_url,
  ADD COLUMN badge VARCHAR(80) NULL AFTER dimensions,
  ADD COLUMN source_reference VARCHAR(120) NULL AFTER badge;

ALTER TABLE commerce_orders
  ADD COLUMN payment_status ENUM('pending','paid','partially_paid','refunded','failed','cancelled') NOT NULL DEFAULT 'pending' AFTER status,
  ADD COLUMN customer_phone VARCHAR(40) NULL AFTER customer_name,
  ADD COLUMN billing_address JSON NULL AFTER shipping_address,
  ADD COLUMN source_reference VARCHAR(120) NULL AFTER notes;

CREATE TABLE IF NOT EXISTS commerce_product_media (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  variant_id CHAR(36) NULL,
  url TEXT NOT NULL,
  alt_text VARCHAR(240) NULL,
  media_type ENUM('image','video','model') NOT NULL DEFAULT 'image',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY commerce_media_product_idx (product_id, sort_order),
  CONSTRAINT commerce_media_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT commerce_media_product_fk FOREIGN KEY (product_id) REFERENCES commerce_products(id) ON DELETE CASCADE,
  CONSTRAINT commerce_media_variant_fk FOREIGN KEY (variant_id) REFERENCES commerce_product_variants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS commerce_order_history (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  actor_user_id CHAR(36) NULL,
  event_type VARCHAR(80) NOT NULL,
  previous_value VARCHAR(120) NULL,
  new_value VARCHAR(120) NULL,
  notes TEXT NULL,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY commerce_history_order_idx (order_id, created_at),
  CONSTRAINT commerce_history_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT commerce_history_order_fk FOREIGN KEY (order_id) REFERENCES commerce_orders(id) ON DELETE CASCADE,
  CONSTRAINT commerce_history_actor_fk FOREIGN KEY (actor_user_id) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS commerce_stock_movements (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  variant_id CHAR(36) NULL,
  inventory_item_id CHAR(36) NULL,
  order_id CHAR(36) NULL,
  movement_type ENUM('entry','exit','reservation','release','adjustment','sale') NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  reference VARCHAR(160) NULL,
  notes TEXT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY commerce_stock_variant_idx (variant_id, created_at),
  KEY commerce_stock_inventory_idx (inventory_item_id, created_at),
  CONSTRAINT commerce_stock_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT commerce_stock_variant_fk FOREIGN KEY (variant_id) REFERENCES commerce_product_variants(id) ON DELETE SET NULL,
  CONSTRAINT commerce_stock_inventory_fk FOREIGN KEY (inventory_item_id) REFERENCES commerce_inventory_items(id) ON DELETE SET NULL,
  CONSTRAINT commerce_stock_order_fk FOREIGN KEY (order_id) REFERENCES commerce_orders(id) ON DELETE SET NULL,
  CONSTRAINT commerce_stock_user_fk FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS commerce_custom_requests (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  contact_id CHAR(36) NULL,
  request_type ENUM('custom','b2b') NOT NULL DEFAULT 'custom',
  status ENUM('new','reviewing','quoted','accepted','rejected','converted') NOT NULL DEFAULT 'new',
  customer_name VARCHAR(180) NOT NULL,
  customer_email VARCHAR(320) NOT NULL,
  customer_phone VARCHAR(40) NULL,
  company_name VARCHAR(180) NULL,
  tax_number VARCHAR(40) NULL,
  description TEXT NOT NULL,
  dimensions VARCHAR(240) NULL,
  color VARCHAR(100) NULL,
  material VARCHAR(100) NULL,
  quantity INT NOT NULL DEFAULT 1,
  desired_date DATE NULL,
  attachments JSON NULL,
  internal_notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY commerce_requests_status_idx (account_id, request_type, status, created_at),
  CONSTRAINT commerce_requests_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT commerce_requests_contact_fk FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS commerce_quotes (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  contact_id CHAR(36) NULL,
  request_id CHAR(36) NULL,
  order_id CHAR(36) NULL,
  quote_number BIGINT NOT NULL AUTO_INCREMENT,
  status ENUM('draft','sent','accepted','rejected','expired','converted') NOT NULL DEFAULT 'draft',
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  valid_until DATE NULL,
  notes TEXT NULL,
  line_items JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY commerce_quotes_number_unique (quote_number),
  KEY commerce_quotes_status_idx (account_id, status, created_at),
  CONSTRAINT commerce_quotes_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT commerce_quotes_contact_fk FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  CONSTRAINT commerce_quotes_request_fk FOREIGN KEY (request_id) REFERENCES commerce_custom_requests(id) ON DELETE SET NULL,
  CONSTRAINT commerce_quotes_order_fk FOREIGN KEY (order_id) REFERENCES commerce_orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS commerce_promotions (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  code VARCHAR(80) NULL,
  name VARCHAR(160) NOT NULL,
  discount_type ENUM('percentage','fixed') NOT NULL,
  discount_value DECIMAL(12,2) NOT NULL,
  minimum_order DECIMAL(12,2) NOT NULL DEFAULT 0,
  usage_limit INT NULL,
  usage_count INT NOT NULL DEFAULT 0,
  starts_at DATETIME(3) NULL,
  ends_at DATETIME(3) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY commerce_promotions_code_unique (account_id, code),
  CONSTRAINT commerce_promotions_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
