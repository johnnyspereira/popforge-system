ALTER TABLE commerce_products
  ADD COLUMN image_url TEXT NULL AFTER description;

ALTER TABLE commerce_product_variants
  ADD COLUMN cost_price DECIMAL(12,2) NULL AFTER price;
