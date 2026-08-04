CREATE INDEX `idx_items_project_room` ON `items` (`project_id`,`room`);--> statement-breakpoint
CREATE INDEX `idx_items_project_status` ON `items` (`project_id`,`status`);