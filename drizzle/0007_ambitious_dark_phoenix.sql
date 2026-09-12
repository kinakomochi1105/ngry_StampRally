CREATE TABLE `spot_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`spot_id` text NOT NULL,
	`level` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `spot_reports_recent_idx` ON `spot_reports` (`event_id`,`spot_id`,`created_at`);