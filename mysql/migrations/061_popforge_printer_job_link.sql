-- Link a production job to a registered printer. Telemetry advances only the
-- assigned job; quality control and dispatch remain explicit human actions.
ALTER TABLE commerce_production_jobs
  ADD COLUMN printer_id CHAR(36) NULL AFTER printer_name,
  ADD COLUMN printer_file VARCHAR(255) NULL AFTER printer_id,
  ADD COLUMN printer_progress_percent DECIMAL(5,2) NULL AFTER printer_file,
  ADD COLUMN printer_last_seen_at DATETIME(3) NULL AFTER printer_progress_percent,
  ADD KEY commerce_jobs_printer_idx (printer_id, status),
  ADD CONSTRAINT commerce_jobs_printer_fk FOREIGN KEY (printer_id) REFERENCES commerce_printers(id) ON DELETE SET NULL;
