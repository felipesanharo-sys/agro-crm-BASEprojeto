CREATE TABLE `manager_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`usedAt` timestamp,
	`usedByUserId` int,
	CONSTRAINT `manager_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `manager_invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE INDEX `idx_manager_invite_token` ON `manager_invites` (`token`);--> statement-breakpoint
CREATE INDEX `idx_manager_invite_date` ON `manager_invites` (`createdAt`);