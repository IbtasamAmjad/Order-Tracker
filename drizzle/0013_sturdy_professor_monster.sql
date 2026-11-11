CREATE TABLE `order_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`name` text NOT NULL,
	`file_key` text NOT NULL,
	`bytes` integer NOT NULL,
	`uploaded_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
