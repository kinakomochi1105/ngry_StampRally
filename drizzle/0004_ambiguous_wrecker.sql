CREATE TABLE `spot_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`spot_id` text NOT NULL,
	`accessed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `spot_activity_recent_idx` ON `spot_activity` (`event_id`,`spot_id`,`accessed_at`);