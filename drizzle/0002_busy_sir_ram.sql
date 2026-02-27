CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`repCode` varchar(32),
	`type` enum('cycle_alert','inactivity_warning','new_client','general','status_change') NOT NULL,
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
DROP INDEX `idx_ca_client` ON `client_actions`;--> statement-breakpoint
DROP INDEX `idx_inv_order` ON `invoices`;--> statement-breakpoint
DROP INDEX `idx_inv_rep` ON `invoices`;--> statement-breakpoint
DROP INDEX `idx_inv_client` ON `invoices`;--> statement-breakpoint
DROP INDEX `idx_inv_date` ON `invoices`;--> statement-breakpoint
DROP INDEX `idx_inv_ym` ON `invoices`;--> statement-breakpoint
ALTER TABLE `invoices` ADD `year` int;--> statement-breakpoint
ALTER TABLE `invoices` ADD `month` varchar(4);--> statement-breakpoint
ALTER TABLE `invoices` ADD `origin` varchar(64);--> statement-breakpoint
ALTER TABLE `invoices` ADD `regionalManagement` varchar(128);--> statement-breakpoint
ALTER TABLE `invoices` ADD `districtManagement` varchar(128);--> statement-breakpoint
ALTER TABLE `invoices` ADD `supervision` varchar(128);--> statement-breakpoint
ALTER TABLE `invoices` ADD `microRegion` varchar(128);--> statement-breakpoint
ALTER TABLE `invoices` ADD `repStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `invoices` ADD `clientCodeDatasul` varchar(32);--> statement-breakpoint
ALTER TABLE `invoices` ADD `clientGroupCodeSAP` varchar(32);--> statement-breakpoint
ALTER TABLE `invoices` ADD `clientParentName` varchar(256);--> statement-breakpoint
ALTER TABLE `invoices` ADD `clientCity` varchar(128);--> statement-breakpoint
ALTER TABLE `invoices` ADD `clientState` varchar(4);--> statement-breakpoint
ALTER TABLE `invoices` ADD `clientAddress` varchar(512);--> statement-breakpoint
ALTER TABLE `invoices` ADD `clientPhone` varchar(64);--> statement-breakpoint
ALTER TABLE `invoices` ADD `clientDocument` varchar(32);--> statement-breakpoint
ALTER TABLE `invoices` ADD `atcResponsible` varchar(256);--> statement-breakpoint
ALTER TABLE `invoices` ADD `salesChannelGroup` varchar(128);--> statement-breakpoint
ALTER TABLE `invoices` ADD `pittClassification` varchar(64);--> statement-breakpoint
ALTER TABLE `invoices` ADD `productCodeDatasul` varchar(32);--> statement-breakpoint
ALTER TABLE `invoices` ADD `productCodeSAP` varchar(32);--> statement-breakpoint
ALTER TABLE `invoices` ADD `productCategory` varchar(128);--> statement-breakpoint
ALTER TABLE `invoices` ADD `productTechnological` varchar(64);--> statement-breakpoint
ALTER TABLE `invoices` ADD `productProgram` varchar(128);--> statement-breakpoint
ALTER TABLE `invoices` ADD `specialFormula` varchar(16);--> statement-breakpoint
ALTER TABLE `invoices` ADD `freightType` varchar(16);--> statement-breakpoint
ALTER TABLE `invoices` ADD `revenueWithTax` decimal(14,2);--> statement-breakpoint
ALTER TABLE `invoices` ADD `reference` varchar(64);--> statement-breakpoint
ALTER TABLE `invoices` ADD `implantationDate` timestamp;--> statement-breakpoint
ALTER TABLE `invoices` ADD `priceFixDate` timestamp;--> statement-breakpoint
ALTER TABLE `invoices` ADD `precisionFarming` varchar(16);--> statement-breakpoint
ALTER TABLE `invoices` ADD `uploadId` int;--> statement-breakpoint
ALTER TABLE `invoices` ADD `createdAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `rep_aliases` ADD `createdAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `rep_aliases` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `sales_goals` ADD `createdAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_goals` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
CREATE INDEX `idx_notif_user` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_notif_rep` ON `notifications` (`repCode`);--> statement-breakpoint
CREATE INDEX `idx_pv_user` ON `page_views` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_pv_page` ON `page_views` (`page`);--> statement-breakpoint
CREATE INDEX `idx_pv_date` ON `page_views` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_client_action` ON `client_actions` (`clientCodeSAP`,`repCode`);--> statement-breakpoint
CREATE INDEX `idx_order` ON `invoices` (`orderCode`,`orderItem`);--> statement-breakpoint
CREATE INDEX `idx_rep` ON `invoices` (`repCode`);--> statement-breakpoint
CREATE INDEX `idx_client` ON `invoices` (`clientCodeSAP`);--> statement-breakpoint
CREATE INDEX `idx_date` ON `invoices` (`invoiceDate`);--> statement-breakpoint
CREATE INDEX `idx_product` ON `invoices` (`productCodeSAP`);