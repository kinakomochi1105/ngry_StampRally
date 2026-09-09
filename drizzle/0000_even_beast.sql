CREATE TABLE `stamps` (
	`event_id` text NOT NULL,
	`participant_hash` text NOT NULL,
	`spot_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`event_id`, `participant_hash`, `spot_id`)
);
--> statement-breakpoint
CREATE INDEX `stamps_created_at_idx` ON `stamps` (`created_at`);