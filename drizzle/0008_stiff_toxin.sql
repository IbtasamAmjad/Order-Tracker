ALTER TABLE `orders` ADD `design_number` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `linked_design_number` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_design_number_unique` ON `orders` (`design_number`);