CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `item_stages` ADD `started_at` integer;
--> statement-breakpoint
UPDATE item_stages SET started_at = COALESCE((SELECT p.completed_at FROM item_stages p WHERE p.item_id = item_stages.item_id AND p.position = item_stages.position - 1), (SELECT o.created_at FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.id = item_stages.item_id)) WHERE status = 'open' AND started_at IS NULL;
