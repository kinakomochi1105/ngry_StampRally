CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`location` text NOT NULL,
	`description` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `locations_event_idx` ON `locations` (`event_id`,`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`hash` text NOT NULL,
	`kind` text NOT NULL,
	`grade` text,
	`class_name` text,
	`number` integer,
	`guest_number` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_hash_idx` ON `participants` (`event_id`,`hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `participants_student_idx` ON `participants` (`event_id`,`grade`,`class_name`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `participants_guest_idx` ON `participants` (`event_id`,`guest_number`);--> statement-breakpoint
CREATE TABLE `settings` (
	`event_id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
