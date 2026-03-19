CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`ws_url` text
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_key` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`timestamp` text NOT NULL,
	`failed` integer DEFAULT false,
	`run_id` text
);
--> statement-breakpoint
CREATE TABLE `office_desks` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text,
	`pos_x` real DEFAULT 0 NOT NULL,
	`pos_y` real DEFAULT 0 NOT NULL,
	`pos_z` real DEFAULT 0 NOT NULL,
	`rotation` real DEFAULT 0 NOT NULL,
	`label` text
);
--> statement-breakpoint
CREATE TABLE `board_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '',
	`column` text DEFAULT 'backlog' NOT NULL,
	`priority` text DEFAULT 'P2' NOT NULL,
	`assignee_id` text,
	`agent_id` text,
	`labels` text DEFAULT '[]',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`due_date` text,
	`pnl` text,
	`estimated_hours` real,
	`comments` text DEFAULT '[]'
);
