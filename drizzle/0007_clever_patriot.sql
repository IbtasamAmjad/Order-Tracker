CREATE TABLE `order_masters` (
	`order_id` integer NOT NULL,
	`master_id` integer NOT NULL,
	PRIMARY KEY(`order_id`, `master_id`),
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`master_id`) REFERENCES `masters`(`id`) ON UPDATE no action ON DELETE no action
);
