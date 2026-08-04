CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer DEFAULT 1 NOT NULL,
	`item_id` integer NOT NULL,
	`object_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_photos_project_item` ON `photos` (`project_id`,`item_id`);