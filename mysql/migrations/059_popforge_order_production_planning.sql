-- Production defaults are stored on the sellable variant. This allows a public
-- order to create a useful workshop job without copying any legacy CRM data.
ALTER TABLE commerce_product_variants
  ADD COLUMN production_minutes INT NULL AFTER weight_grams,
  ADD COLUMN production_grams DECIMAL(12,3) NULL AFTER production_minutes,
  ADD COLUMN production_material_sku VARCHAR(100) NULL AFTER production_grams,
  ADD COLUMN production_printer_name VARCHAR(120) NULL AFTER production_material_sku;

ALTER TABLE commerce_production_jobs
  ADD COLUMN actual_labor_cost DECIMAL(12,2) NULL AFTER actual_labor_minutes;
