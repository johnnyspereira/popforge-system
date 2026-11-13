ALTER TABLE commerce_products
  MODIFY COLUMN product_type ENUM('ready_made','made_to_order','custom_quote','kit','pack') NOT NULL DEFAULT 'ready_made';
