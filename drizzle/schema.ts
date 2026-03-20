import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, uniqueIndex, index } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  repCode: varchar("repCode", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Invoice lines from uploaded spreadsheets
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  orderCode: varchar("orderCode", { length: 64 }).notNull(),
  orderItem: varchar("orderItem", { length: 32 }).notNull(),
  invoiceDate: timestamp("invoiceDate").notNull(),
  year: int("year"),
  yearMonth: varchar("yearMonth", { length: 10 }),
  month: varchar("month", { length: 4 }),
  origin: varchar("origin", { length: 64 }),
  regionalManagement: varchar("regionalManagement", { length: 128 }),
  districtManagement: varchar("districtManagement", { length: 128 }),
  supervision: varchar("supervision", { length: 128 }),
  microRegion: varchar("microRegion", { length: 128 }),
  repName: varchar("repName", { length: 256 }).notNull(),
  repCode: varchar("repCode", { length: 32 }).notNull(),
  repStatus: varchar("repStatus", { length: 32 }),
  clientCodeDatasul: varchar("clientCodeDatasul", { length: 32 }),
  clientCodeSAP: varchar("clientCodeSAP", { length: 32 }),
  clientGroupCodeSAP: varchar("clientGroupCodeSAP", { length: 32 }),
  clientName: varchar("clientName", { length: 256 }).notNull(),
  clientParentName: varchar("clientParentName", { length: 256 }),
  clientCity: varchar("clientCity", { length: 128 }),
  clientState: varchar("clientState", { length: 4 }),
  clientAddress: varchar("clientAddress", { length: 512 }),
  clientPhone: varchar("clientPhone", { length: 64 }),
  clientDocument: varchar("clientDocument", { length: 32 }),
  atcResponsible: varchar("atcResponsible", { length: 256 }),
  salesChannel: varchar("salesChannel", { length: 128 }),
  salesChannelGroup: varchar("salesChannelGroup", { length: 128 }),
  pittClassification: varchar("pittClassification", { length: 64 }),
  productCodeDatasul: varchar("productCodeDatasul", { length: 32 }),
  productCodeSAP: varchar("productCodeSAP", { length: 32 }),
  productName: varchar("productName", { length: 256 }).notNull(),
  productCategory: varchar("productCategory", { length: 128 }),
  productTechnological: varchar("productTechnological", { length: 64 }),
  productProgram: varchar("productProgram", { length: 128 }),
  specialFormula: varchar("specialFormula", { length: 16 }),
  freightType: varchar("freightType", { length: 16 }),
  kgInvoiced: decimal("kgInvoiced", { precision: 14, scale: 2 }).notNull(),
  revenueNoTax: decimal("revenueNoTax", { precision: 14, scale: 2 }),
  revenueWithTax: decimal("revenueWithTax", { precision: 14, scale: 2 }),
  reference: varchar("reference", { length: 64 }),
  implantationDate: timestamp("implantationDate"),
  priceFixDate: timestamp("priceFixDate"),
  precisionFarming: varchar("precisionFarming", { length: 16 }),
  uploadId: int("uploadId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_order").on(table.orderCode, table.orderItem),
  index("idx_rep").on(table.repCode),
  index("idx_client").on(table.clientCodeSAP),
  index("idx_date").on(table.invoiceDate),
  index("idx_product").on(table.productCodeSAP),
]);

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// Client action tracking (Em Ação, Pedido na Tela, Excluído)
export const clientActions = mysqlTable("client_actions", {
  id: int("id").autoincrement().primaryKey(),
  clientCodeSAP: varchar("clientCodeSAP", { length: 32 }).notNull(),
  repCode: varchar("repCode", { length: 32 }).notNull(),
  userId: int("userId").notNull(),
  actionType: mysqlEnum("actionType", ["em_acao", "pedido_na_tela", "excluido", "reset"]).notNull(),
  note: text("note"),
  previousStatus: varchar("previousStatus", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_client_action").on(table.clientCodeSAP, table.repCode),
]);

export type ClientAction = typeof clientActions.$inferSelect;
export type InsertClientAction = typeof clientActions.$inferInsert;

// Notifications for in-app alerts
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  repCode: varchar("repCode", { length: 32 }),
  type: mysqlEnum("type", ["cycle_alert", "inactivity_warning", "new_client", "general", "status_change", "funnel_change"]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message"),
  clientCodeSAP: varchar("clientCodeSAP", { length: 32 }),
  clientName: varchar("clientName", { length: 256 }),
  isRead: int("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_notif_user").on(table.userId),
  index("idx_notif_rep").on(table.repCode),
]);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// Upload log
export const uploadLogs = mysqlTable("upload_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 256 }).notNull(),
  rowsProcessed: int("rowsProcessed").default(0),
  rowsInserted: int("rowsInserted").default(0),
  rowsDuplicate: int("rowsDuplicate").default(0),
  status: mysqlEnum("status", ["processing", "completed", "error"]).default("processing").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UploadLog = typeof uploadLogs.$inferSelect;
export type InsertUploadLog = typeof uploadLogs.$inferInsert;

// Rep aliases for short display names and grouping (prepostos)
export const repAliases = mysqlTable("rep_aliases", {
  id: int("id").autoincrement().primaryKey(),
  repCode: varchar("repCode", { length: 32 }).notNull().unique(),
  repName: varchar("repName", { length: 256 }).notNull(),
  alias: varchar("alias", { length: 128 }).notNull(),
  parentRepCode: varchar("parentRepCode", { length: 32 }),
  neCode: varchar("neCode", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RepAlias = typeof repAliases.$inferSelect;
export type InsertRepAlias = typeof repAliases.$inferInsert;

// Monthly sales goals per RC
export const salesGoals = mysqlTable("sales_goals", {
  id: int("id").autoincrement().primaryKey(),
  repCode: varchar("repCode", { length: 32 }).notNull(),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(),
  goalKg: decimal("goalKg", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uq_goal").on(table.repCode, table.yearMonth),
]);

export type SalesGoal = typeof salesGoals.$inferSelect;
export type InsertSalesGoal = typeof salesGoals.$inferInsert;

// RC invite tokens for linking users to repCodes
export const rcInvites = mysqlTable("rc_invites", {
  id: int("id").autoincrement().primaryKey(),
  repCode: varchar("repCode", { length: 32 }).notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  usedAt: timestamp("usedAt"),
  usedByUserId: int("usedByUserId"),
}, (table) => [
  index("idx_invite_token").on(table.token),
  index("idx_invite_rep").on(table.repCode),
]);

export type RcInvite = typeof rcInvites.$inferSelect;
export type InsertRcInvite = typeof rcInvites.$inferInsert;

// Manager/Admin invites for onboarding gestores
export const managerInvites = mysqlTable("manager_invites", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  usedAt: timestamp("usedAt"),
  usedByUserId: int("usedByUserId"),
}, (table) => [
  index("idx_manager_invite_token").on(table.token),
  index("idx_manager_invite_date").on(table.createdAt),
]);

export type ManagerInvite = typeof managerInvites.$inferSelect;
export type InsertManagerInvite = typeof managerInvites.$inferInsert;

// Page view tracking for user activity monitoring
export const pageViews = mysqlTable("page_views", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  page: varchar("page", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_pv_user").on(table.userId),
  index("idx_pv_page").on(table.page),
  index("idx_pv_date").on(table.createdAt),
]);

export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = typeof pageViews.$inferInsert;
