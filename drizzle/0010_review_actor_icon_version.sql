ALTER TABLE `audit_log` ADD `actor` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `updated_at` integer DEFAULT 0 NOT NULL;