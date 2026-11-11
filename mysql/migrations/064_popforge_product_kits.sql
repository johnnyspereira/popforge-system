-- A kit is a sellable product composed of independent production components.
ALTER TABLE commerce_products
  MODIFY COLUMN product_type ENUM('ready_made','made_to_order','custom_quote','kit') NOT NULL DEFAULT 'ready_made';

CREATE TABLE IF NOT EXISTS commerce_product_kit_components (
  id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  kit_variant_id CHAR(36) NOT NULL,
  component_variant_id CHAR(36) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY commerce_kit_component_unique (kit_variant_id, component_variant_id),
  KEY commerce_kit_component_account_idx (account_id, kit_variant_id),
  CONSTRAINT commerce_kit_component_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT commerce_kit_component_kit_variant_fk FOREIGN KEY (kit_variant_id) REFERENCES commerce_product_variants(id) ON DELETE CASCADE,
  CONSTRAINT commerce_kit_component_variant_fk FOREIGN KEY (component_variant_id) REFERENCES commerce_product_variants(id) ON DELETE RESTRICT,
  CONSTRAINT commerce_kit_component_quantity_check CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE commerce_production_jobs
  ADD COLUMN kit_component_id CHAR(36) NULL AFTER order_item_id,
  ADD KEY commerce_jobs_kit_component_idx (kit_component_id),
  ADD CONSTRAINT commerce_jobs_kit_component_fk FOREIGN KEY (kit_component_id) REFERENCES commerce_product_kit_components(id) ON DELETE SET NULL;
