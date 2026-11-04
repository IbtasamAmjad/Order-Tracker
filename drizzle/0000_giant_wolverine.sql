CREATE TABLE `masters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`pin_hash` text NOT NULL,
	`session_secret` text NOT NULL,
	`whatsapp_number` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `masters_token_unique` ON `masters` (`token`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_number` integer NOT NULL,
	`customer_name` text NOT NULL,
	`my_due_date` text NOT NULL,
	`karigar_due_date` text NOT NULL,
	`master_id` integer NOT NULL,
	`priority_position` integer NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`allow_out_of_sequence` integer DEFAULT false NOT NULL,
	`master_seen_at` integer,
	`master_last_seen_at` integer,
	`changed_for_master_at` integer,
	`moved_up_at` integer,
	`closed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`master_id`) REFERENCES `masters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);