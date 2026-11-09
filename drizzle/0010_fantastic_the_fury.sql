CREATE TABLE `stage_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`item_id` integer,
	`stage_key` text,
	`kind` text NOT NULL,
	`by` text NOT NULL,
	`master_id` integer,
	`text` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `item_stages` ADD `instruction` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `confirmed_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `confirmed_by` integer;