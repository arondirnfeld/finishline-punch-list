CREATE TABLE `project_settings` (
	`project_id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`address` text DEFAULT '123 Maple Street' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
