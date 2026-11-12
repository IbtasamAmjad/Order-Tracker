ALTER TABLE `orders` ADD `sent_at` integer;
--> statement-breakpoint
UPDATE `orders` SET `sent_at` = `created_at` WHERE `sent_at` IS NULL;
