CREATE TABLE `workflows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`stages` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflows_name_unique` ON `workflows` (`name`);--> statement-breakpoint
ALTER TABLE `templates` ADD `workflow_id` integer;