CREATE TABLE `design_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`design_id` integer NOT NULL,
	`file_key` text NOT NULL,
	`thumb_key` text NOT NULL,
	`bytes` integer NOT NULL,
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `designs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`template_id` integer,
	`notes` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `order_items` ADD `design_id` integer;--> statement-breakpoint
ALTER TABLE `photos` ADD `from_design_id` integer;