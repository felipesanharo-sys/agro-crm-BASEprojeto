CREATE TABLE `client_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientCodeSAP` varchar(32) NOT NULL,
	`repCode` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`actionType` enum('em_acao','pedido_na_tela','excluido','reset') NOT NULL,
	`note` text,
	`previousStatus` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderCode` varchar(64) NOT NULL,
	`orderItem` varchar(32) NOT NULL,
	`invoiceDate` timestamp NOT NULL,
	`year` int,
	`yearMonth` varchar(10),
	`month` varchar(4),
	`origin` varchar(64),
	`regionalManagement` varchar(128),
	`districtManagement` varchar(128),
	`supervision` varchar(128),
	`microRegion` varchar(128),
	`repName` varchar(256) NOT NULL,
	`repCode` varchar(32) NOT NULL,
	`repStatus` varchar(32),
	`clientCodeDatasul` varchar(32),
	`clientCodeSAP` varchar(32),
	`clientGroupCodeSAP` varchar(32),
	`clientName` varchar(256) NOT NULL,
	`clientParentName` varchar(256),
	`clientCity` varchar(128),
	`clientState` varchar(4),
	`clientAddress` varchar(512),
	`clientPhone` varchar(64),
	`clientDocument` varchar(32),
	`atcResponsible` varchar(256),
	`salesChannel` varchar(128),
	`salesChannelGroup` varchar(128),
	`pittClassification` varchar(64),
	`productCodeDatasul` varchar(32),
	`productCodeSAP` varchar(32),
	`productName` varchar(256) NOT NULL,
	`productCategory` varchar(128),
	`productTechnological` varchar(64),
	`productProgram` varchar(128),
	`specialFormula` varchar(16),
	`freightType` varchar(16),
	`kgInvoiced` decimal(14,2) NOT NULL,
	`revenueNoTax` decimal(14,2),
	`revenueWithTax` decimal(14,2),
	`reference` varchar(64),
	`implantationDate` timestamp,
	`priceFixDate` timestamp,
	`precisionFarming` varchar(16),
	`uploadId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`repCode` varchar(32),
	`type` enum('cycle_alert','inactivity_warning','new_client','general','status_change','funnel_change') NOT NULL,
	`title` varchar(256) NOT NULL,
	`message` text,
	`clientCodeSAP` varchar(32),
	`clientName` varchar(256),
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `page_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`page` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `page_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rc_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`repCode` varchar(32) NOT NULL,
	`token` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`usedAt` timestamp,
	`usedByUserId` int,
	CONSTRAINT `rc_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `rc_invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `rep_aliases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`repCode` varchar(32) NOT NULL,
	`repName` varchar(256) NOT NULL,
	`alias` varchar(128) NOT NULL,
	`parentRepCode` varchar(32),
	`neCode` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rep_aliases_id` PRIMARY KEY(`id`),
	CONSTRAINT `rep_aliases_repCode_unique` UNIQUE(`repCode`)
);
--> statement-breakpoint
CREATE TABLE `sales_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`repCode` varchar(32) NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`goalKg` decimal(14,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_goals_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_goal` UNIQUE(`repCode`,`yearMonth`)
);
--> statement-breakpoint
CREATE TABLE `upload_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(256) NOT NULL,
	`rowsProcessed` int DEFAULT 0,
	`rowsInserted` int DEFAULT 0,
	`rowsDuplicate` int DEFAULT 0,
	`status` enum('processing','completed','error') NOT NULL DEFAULT 'processing',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `upload_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `repCode` varchar(32);--> statement-breakpoint
CREATE INDEX `idx_client_action` ON `client_actions` (`clientCodeSAP`,`repCode`);--> statement-breakpoint
CREATE INDEX `idx_order` ON `invoices` (`orderCode`,`orderItem`);--> statement-breakpoint
CREATE INDEX `idx_rep` ON `invoices` (`repCode`);--> statement-breakpoint
CREATE INDEX `idx_client` ON `invoices` (`clientCodeSAP`);--> statement-breakpoint
CREATE INDEX `idx_date` ON `invoices` (`invoiceDate`);--> statement-breakpoint
CREATE INDEX `idx_product` ON `invoices` (`productCodeSAP`);--> statement-breakpoint
CREATE INDEX `idx_notif_user` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_notif_rep` ON `notifications` (`repCode`);--> statement-breakpoint
CREATE INDEX `idx_pv_user` ON `page_views` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_pv_page` ON `page_views` (`page`);--> statement-breakpoint
CREATE INDEX `idx_pv_date` ON `page_views` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_invite_token` ON `rc_invites` (`token`);--> statement-breakpoint
CREATE INDEX `idx_invite_rep` ON `rc_invites` (`repCode`);