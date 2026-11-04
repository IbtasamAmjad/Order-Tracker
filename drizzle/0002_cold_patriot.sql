CREATE TABLE `item_stages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`stage_key` text NOT NULL,
	`position` integer NOT NULL,
	`status` text DEFAULT 'locked' NOT NULL,
	`completed_at` integer,
	`completed_by` text,
	FOREIGN KEY (`item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`item_id` integer,
	`stage_key` text,
	`field_key` text,
	`type` text NOT NULL,
	`file_key` text NOT NULL,
	`thumb_key` text NOT NULL,
	`bytes` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`comment` text,
	`uploaded_at` integer NOT NULL,
	`reviewed_at` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `templates` ADD `stages` text DEFAULT '[]' NOT NULL;