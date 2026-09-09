ALTER TABLE `participants` ADD `nickname` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `nickname_key` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `recovery_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `participants_recovery_idx` ON `participants` (`event_id`,`recovery_hash`);