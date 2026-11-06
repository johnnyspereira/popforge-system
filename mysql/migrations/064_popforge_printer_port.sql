ALTER TABLE commerce_printers
  ADD COLUMN IF NOT EXISTS local_port INT UNSIGNED NOT NULL DEFAULT 4408 AFTER local_address;
UPDATE commerce_printers SET local_port=4408 WHERE local_port=44808;
