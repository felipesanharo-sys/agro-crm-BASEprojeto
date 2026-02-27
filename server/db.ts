import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  invoices, InsertInvoice,
  clientActions, InsertClientAction,
  repAliases, InsertRepAlias,
  salesGoals, InsertSalesGoal,
  rcInvites, InsertRcInvite,
  notifications, InsertNotification,
  uploadLogs, InsertUploadLog,
  pageViews, InsertPageView,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import crypto from 'crypto';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ---- Upload Logs ----

export async function createUploadLog(data: Omit<InsertUploadLog, "id">): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(uploadLogs).values(data as InsertUploadLog);
  return (result as any)[0].insertId;
}

export async function updateUploadLog(id: number, data: Partial<InsertUploadLog>) {
  const db = await getDb();
  if (!db) return;
  await db.update(uploadLogs).set(data).where(eq(uploadLogs.id, id));
}

export async function getUploadLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(uploadLogs).orderBy(desc(uploadLogs.createdAt)).limit(50);
}

// ---- Bulk Insert Invoices ----

export async function bulkInsertInvoices(rows: any[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  let inserted = 0;
  let duplicates = 0;
  const BATCH_SIZE = 200;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      const result = await db.execute(sql`
        INSERT IGNORE INTO invoices
          (orderCode, orderItem, invoiceDate, year, yearMonth, month, origin,
           regionalManagement, districtManagement, supervision, microRegion,
           repName, repCode, repStatus, clientCodeDatasul, clientCodeSAP,
           clientGroupCodeSAP, clientName, clientParentName, clientCity, clientState,
           clientAddress, clientPhone, clientDocument, atcResponsible,
           salesChannel, salesChannelGroup, pittClassification,
           productCodeDatasul, productCodeSAP, productName, productCategory,
           productTechnological, productProgram, specialFormula, freightType,
           kgInvoiced, revenueNoTax, revenueWithTax,
           reference, implantationDate, priceFixDate, precisionFarming, uploadId)
        VALUES ${sql.join(batch.map(r => sql`(
          ${r.orderCode}, ${r.orderItem}, ${r.invoiceDate}, ${r.year ?? null}, ${r.yearMonth ?? null}, ${r.month ?? null}, ${r.origin ?? null},
          ${r.regionalManagement ?? null}, ${r.districtManagement ?? null}, ${r.supervision ?? null}, ${r.microRegion ?? null},
          ${r.repName}, ${r.repCode}, ${r.repStatus ?? null}, ${r.clientCodeDatasul ?? null}, ${r.clientCodeSAP ?? null},
          ${r.clientGroupCodeSAP ?? null}, ${r.clientName}, ${r.clientParentName ?? null}, ${r.clientCity ?? null}, ${r.clientState ?? null},
          ${r.clientAddress ?? null}, ${r.clientPhone ?? null}, ${r.clientDocument ?? null}, ${r.atcResponsible ?? null},
          ${r.salesChannel ?? null}, ${r.salesChannelGroup ?? null}, ${r.pittClassification ?? null},
          ${r.productCodeDatasul ?? null}, ${r.productCodeSAP ?? null}, ${r.productName}, ${r.productCategory ?? null},
          ${r.productTechnological ?? null}, ${r.productProgram ?? null}, ${r.specialFormula ?? null}, ${r.freightType ?? null},
          ${r.kgInvoiced}, ${r.revenueNoTax ?? null}, ${r.revenueWithTax ?? null},
          ${r.reference ?? null}, ${r.implantationDate ?? null}, ${r.priceFixDate ?? null},
          ${r.precisionFarming ?? null}, ${r.uploadId ?? null}
        )`), sql`, `)}
      `);
      const affectedRows = (result as any)[0]?.affectedRows ?? batch.length;
      inserted += affectedRows;
      duplicates += batch.length - affectedRows;
    } catch (err) {
      console.error("[DB] Batch insert error:", err);
      duplicates += batch.length;
    }
  }
  return { inserted, duplicates };
}

// ---- Client Cycle Queries ----

export async function getClientPurchaseHistory(repCode?: string, channelFilter?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (repCode) conditions.push(sql`i.repCode = ${repCode}`);
  if (channelFilter) conditions.push(sql`i.salesChannelGroup = ${channelFilter}`);
  const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
  const result = await db.execute(sql`
    SELECT
      i.clientCodeSAP, i.clientName, i.clientCity, i.clientState,
      i.clientPhone, i.clientDocument, i.salesChannel, i.salesChannelGroup,
      i.repCode, i.repName,
      MAX(i.invoiceDate) as lastPurchaseDate,
      COUNT(DISTINCT i.orderCode) as orderCount,
      SUM(CAST(i.kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(i.revenueWithTax AS DECIMAL(14,2))) as totalRevenue,
      MIN(i.invoiceDate) as firstPurchaseDate
    FROM invoices i
    ${whereClause}
    GROUP BY i.clientCodeSAP, i.clientName, i.clientCity, i.clientState, i.clientPhone,
             i.clientDocument, i.salesChannel, i.salesChannelGroup, i.repCode, i.repName
    ORDER BY lastPurchaseDate DESC
  `);
  return (result as any)[0] || [];
}

export async function getClientOrderDates(clientCodeSAP: string, repCode: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT orderCode, MIN(DATE(invoiceDate)) as orderDate, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as kgTotal
    FROM invoices
    WHERE clientCodeSAP = ${clientCodeSAP} AND repCode = ${repCode}
    GROUP BY orderCode
    ORDER BY orderDate ASC
  `);
  return (result as any)[0] || [];
}

export async function getClientTopProduct(clientCodeSAP: string, repCode: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.execute(sql`
    SELECT productName, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg
    FROM invoices WHERE clientCodeSAP = ${clientCodeSAP} AND repCode = ${repCode}
    GROUP BY productName ORDER BY totalKg DESC LIMIT 1
  `);
  const rows = (result as any)[0];
  return rows.length > 0 ? rows[0].productName : null;
}

// ---- Client Actions ----

export async function getLatestClientAction(clientCodeSAP: string, repCode: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(clientActions)
    .where(and(eq(clientActions.clientCodeSAP, clientCodeSAP), eq(clientActions.repCode, repCode)))
    .orderBy(desc(clientActions.createdAt)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getClientActionHistory(clientCodeSAP: string, repCode: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientActions)
    .where(and(eq(clientActions.clientCodeSAP, clientCodeSAP), eq(clientActions.repCode, repCode)))
    .orderBy(desc(clientActions.createdAt)).limit(50);
}

export async function insertClientAction(data: InsertClientAction) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(clientActions).values(data);
}

export async function getAllClientActions(repCode?: string) {
  const db = await getDb();
  if (!db) return [];
  if (repCode) {
    return db.execute(sql`
      SELECT ca.* FROM client_actions ca
      INNER JOIN (
        SELECT clientCodeSAP, repCode, MAX(createdAt) as maxCreated
        FROM client_actions WHERE repCode = ${repCode}
        GROUP BY clientCodeSAP, repCode
      ) latest ON ca.clientCodeSAP = latest.clientCodeSAP AND ca.repCode = latest.repCode AND ca.createdAt = latest.maxCreated
      WHERE ca.actionType != 'reset'
    `).then(r => (r as any)[0] || []);
  }
  return db.execute(sql`
    SELECT ca.* FROM client_actions ca
    INNER JOIN (
      SELECT clientCodeSAP, repCode, MAX(createdAt) as maxCreated
      FROM client_actions GROUP BY clientCodeSAP, repCode
    ) latest ON ca.clientCodeSAP = latest.clientCodeSAP AND ca.repCode = latest.repCode AND ca.createdAt = latest.maxCreated
    WHERE ca.actionType != 'reset'
  `).then(r => (r as any)[0] || []);
}

// ---- Product Queries ----

export async function getProductAnalysis(repCode?: string, filters?: { product?: string; channel?: string; city?: string; microRegion?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (repCode) conditions.push(sql`i.repCode = ${repCode}`);
  if (filters?.product) conditions.push(sql`i.productName LIKE ${`%${filters.product}%`}`);
  if (filters?.channel) conditions.push(sql`i.salesChannelGroup = ${filters.channel}`);
  if (filters?.city) conditions.push(sql`i.clientCity LIKE ${`%${filters.city}%`}`);
  if (filters?.microRegion) conditions.push(sql`i.microRegion = ${filters.microRegion}`);
  const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
  const result = await db.execute(sql`
    SELECT
      i.productName, i.productCategory, i.clientName, i.clientCodeSAP,
      i.clientCity, i.clientState, i.salesChannelGroup, i.microRegion,
      SUM(CAST(i.kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(i.revenueWithTax AS DECIMAL(14,2))) as totalRevenue,
      MAX(i.invoiceDate) as lastSale,
      COUNT(DISTINCT i.orderCode) as orderCount
    FROM invoices i ${whereClause}
    GROUP BY i.productName, i.productCategory, i.clientName, i.clientCodeSAP, i.clientCity, i.clientState, i.salesChannelGroup, i.microRegion
    ORDER BY totalKg DESC
  `);
  return (result as any)[0] || [];
}

// ---- Dashboard Queries ----

export async function getDashboardKgByPeriod(repCode?: string, days: number = 30) {
  const db = await getDb();
  if (!db) return 0;
  const repCondition = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(kgInvoiced AS DECIMAL(14,2))), 0) as total
    FROM invoices WHERE invoiceDate >= DATE_SUB(NOW(), INTERVAL ${days} DAY) ${repCondition}
  `);
  return Number((result as any)[0]?.[0]?.total ?? 0);
}

export async function getMonthlyEvolution(repCode?: string, months: number = 24) {
  const db = await getDb();
  if (!db) return [];
  const repCondition = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT yearMonth, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue,
      COUNT(DISTINCT clientCodeSAP) as uniqueClients
    FROM invoices
    WHERE invoiceDate >= DATE_SUB(NOW(), INTERVAL ${months} MONTH) ${repCondition}
    GROUP BY yearMonth ORDER BY yearMonth ASC
  `);
  return (result as any)[0] || [];
}

export async function getTopClientsByVolume(repCode?: string, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  const repCondition = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT clientCodeSAP, clientName, clientCity,
      SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue,
      COUNT(DISTINCT orderCode) as orderCount
    FROM invoices
    WHERE invoiceDate >= DATE_SUB(NOW(), INTERVAL 12 MONTH) ${repCondition}
    GROUP BY clientCodeSAP, clientName, clientCity ORDER BY totalKg DESC LIMIT ${limit}
  `);
  return (result as any)[0] || [];
}

export async function getPricePerKgByProduct(repCode?: string) {
  const db = await getDb();
  if (!db) return [];
  const repCondition = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT productName, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue,
      CASE WHEN SUM(CAST(kgInvoiced AS DECIMAL(14,2))) > 0
        THEN SUM(CAST(revenueWithTax AS DECIMAL(14,2))) / SUM(CAST(kgInvoiced AS DECIMAL(14,2)))
        ELSE 0 END as pricePerKg
    FROM invoices WHERE invoiceDate >= DATE_SUB(NOW(), INTERVAL 12 MONTH) ${repCondition}
    GROUP BY productName ORDER BY totalKg DESC
  `);
  return (result as any)[0] || [];
}

// ---- Manager Queries ----

export async function getRepSummary() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT repCode, repName, COUNT(DISTINCT clientCodeSAP) as totalClients,
      SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue,
      MAX(invoiceDate) as lastInvoice
    FROM invoices WHERE invoiceDate >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
    GROUP BY repCode, repName ORDER BY totalKg DESC
  `);
  return (result as any)[0] || [];
}

export async function getFilterOptions(repCode?: string) {
  const db = await getDb();
  if (!db) return { products: [], channels: [], cities: [], microRegions: [], reps: [] };
  const repCondition = repCode ? sql`WHERE repCode = ${repCode}` : sql``;
  const [products, channels, cities, microRegions, reps] = await Promise.all([
    db.execute(sql`SELECT DISTINCT productName FROM invoices ${repCondition} ORDER BY productName`).then(r => ((r as any)[0] || []).map((x: any) => x.productName)),
    db.execute(sql`SELECT DISTINCT salesChannelGroup FROM invoices ${repCondition} ORDER BY salesChannelGroup`).then(r => ((r as any)[0] || []).map((x: any) => x.salesChannelGroup).filter(Boolean)),
    db.execute(sql`SELECT DISTINCT clientCity FROM invoices ${repCondition} ORDER BY clientCity`).then(r => ((r as any)[0] || []).map((x: any) => x.clientCity).filter(Boolean)),
    db.execute(sql`SELECT DISTINCT microRegion FROM invoices ${repCondition} ORDER BY microRegion`).then(r => ((r as any)[0] || []).map((x: any) => x.microRegion).filter(Boolean)),
    db.execute(sql`SELECT DISTINCT repCode, repName FROM invoices ORDER BY repName`).then(r => (r as any)[0] || []),
  ]);
  return { products, channels, cities, microRegions, reps };
}

// ---- Notifications ----

export async function getUserNotifications(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.execute(sql`SELECT COUNT(*) as cnt FROM notifications WHERE userId = ${userId} AND isRead = 0`);
  return Number((result as any)[0]?.[0]?.cnt ?? 0);
}

export async function markNotificationsRead(userId: number, ids?: number[]) {
  const db = await getDb();
  if (!db) return;
  if (ids && ids.length > 0) {
    await db.execute(sql`UPDATE notifications SET isRead = 1 WHERE userId = ${userId} AND id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
  } else {
    await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.userId, userId));
  }
}

export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

// ---- Export Helpers ----

export async function getInvoicesForExport(filters: { repCode?: string; startDate?: string; endDate?: string; clientCodeSAP?: string; productName?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters.repCode) conditions.push(sql`repCode = ${filters.repCode}`);
  if (filters.startDate) conditions.push(sql`invoiceDate >= ${filters.startDate}`);
  if (filters.endDate) conditions.push(sql`invoiceDate <= ${filters.endDate}`);
  if (filters.clientCodeSAP) conditions.push(sql`clientCodeSAP = ${filters.clientCodeSAP}`);
  if (filters.productName) conditions.push(sql`productName LIKE ${`%${filters.productName}%`}`);
  const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
  const result = await db.execute(sql`
    SELECT invoiceDate, repName, repCode, clientName, clientCodeSAP, clientCity, clientState,
           salesChannelGroup, productName, productCategory, kgInvoiced, revenueNoTax, revenueWithTax
    FROM invoices ${whereClause} ORDER BY invoiceDate DESC LIMIT 50000
  `);
  return (result as any)[0] || [];
}

export async function getAnnotationsExport(repCode?: string) {
  const db = await getDb();
  if (!db) return [];
  const repCondition = repCode ? sql`WHERE ca.repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT ca.clientCodeSAP, ca.repCode, ca.actionType, ca.note, ca.previousStatus, ca.createdAt,
           u.name as userName
    FROM client_actions ca LEFT JOIN users u ON ca.userId = u.id
    ${repCondition} ORDER BY ca.createdAt DESC
  `);
  return (result as any)[0] || [];
}

// ---- Benchmarking & Client Detail Queries ----

export async function getRepBenchmarking() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      r.repCode,
      COALESCE(ra.alias, r.repName) as repName,
      r.totalClients, r.totalKg, r.totalRevenue,
      r.avgKgPerClient, r.avgRevenuePerClient,
      COALESCE(a.emAcaoCount, 0) as emAcaoCount,
      COALESCE(a.pedidoNaTelaCount, 0) as pedidoNaTelaCount,
      COALESCE(a.excluidoCount, 0) as excluidoCount
    FROM (
      SELECT repCode, MAX(repName) as repName,
        COUNT(DISTINCT clientCodeSAP) as totalClients,
        SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
        SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue,
        ROUND(SUM(CAST(kgInvoiced AS DECIMAL(14,2))) / NULLIF(COUNT(DISTINCT clientCodeSAP), 0), 0) as avgKgPerClient,
        ROUND(SUM(CAST(revenueWithTax AS DECIMAL(14,2))) / NULLIF(COUNT(DISTINCT clientCodeSAP), 0), 0) as avgRevenuePerClient
      FROM invoices WHERE invoiceDate >= DATE_SUB(NOW(), INTERVAL 12 MONTH) GROUP BY repCode
    ) r
    LEFT JOIN rep_aliases ra ON r.repCode = ra.repCode
    LEFT JOIN (
      SELECT ca.repCode,
        SUM(CASE WHEN ca.actionType = 'em_acao' THEN 1 ELSE 0 END) as emAcaoCount,
        SUM(CASE WHEN ca.actionType = 'pedido_na_tela' THEN 1 ELSE 0 END) as pedidoNaTelaCount,
        SUM(CASE WHEN ca.actionType = 'excluido' THEN 1 ELSE 0 END) as excluidoCount
      FROM client_actions ca
      INNER JOIN (
        SELECT clientCodeSAP, repCode, MAX(createdAt) as maxCreated FROM client_actions GROUP BY clientCodeSAP, repCode
      ) latest ON ca.clientCodeSAP = latest.clientCodeSAP AND ca.repCode = latest.repCode AND ca.createdAt = latest.maxCreated
      GROUP BY ca.repCode
    ) a ON r.repCode = a.repCode
    ORDER BY r.totalKg DESC
  `);
  return (result as any)[0] || [];
}

export async function getClientLastOrders(clientCodeSAP: string, repCode: string, limit: number = 3) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT orderCode, DATE(invoiceDate) as orderDate,
      SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue,
      COUNT(*) as itemCount
    FROM invoices WHERE clientCodeSAP = ${clientCodeSAP} AND repCode = ${repCode}
    GROUP BY orderCode, DATE(invoiceDate) ORDER BY orderDate DESC LIMIT ${limit}
  `);
  return (result as any)[0] || [];
}

export async function getClientProductBreakdown(clientCodeSAP: string, repCode: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT productName, productCategory,
      SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue,
      CASE WHEN SUM(CAST(kgInvoiced AS DECIMAL(14,2))) > 0
        THEN ROUND(SUM(CAST(revenueWithTax AS DECIMAL(14,2))) / SUM(CAST(kgInvoiced AS DECIMAL(14,2))), 2)
        ELSE 0 END as pricePerKg,
      COUNT(DISTINCT orderCode) as orderCount,
      MAX(invoiceDate) as lastPurchaseDate
    FROM invoices WHERE clientCodeSAP = ${clientCodeSAP} AND repCode = ${repCode}
    GROUP BY productName, productCategory ORDER BY totalKg DESC
  `);
  return (result as any)[0] || [];
}

export async function getOrderProductDetails(orderCode: string, clientCodeSAP: string, repCode: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT productName, productCategory,
      CAST(kgInvoiced AS DECIMAL(14,2)) as kg,
      CAST(revenueWithTax AS DECIMAL(14,2)) as revenue,
      CASE WHEN CAST(kgInvoiced AS DECIMAL(14,2)) > 0
        THEN ROUND(CAST(revenueWithTax AS DECIMAL(14,2)) / CAST(kgInvoiced AS DECIMAL(14,2)), 2)
        ELSE 0 END as pricePerKg
    FROM invoices WHERE orderCode = ${orderCode} AND clientCodeSAP = ${clientCodeSAP} AND repCode = ${repCode}
    ORDER BY CAST(kgInvoiced AS DECIMAL(14,2)) DESC
  `);
  return (result as any)[0] || [];
}

export async function getClientsByProduct(productName: string, repCode?: string) {
  const db = await getDb();
  if (!db) return [];
  const repCondition = repCode ? sql`AND i.repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT i.clientCodeSAP, i.clientName, i.clientCity, i.clientState, i.repCode, i.repName,
      SUM(CAST(i.kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(i.revenueWithTax AS DECIMAL(14,2))) as totalRevenue,
      CASE WHEN SUM(CAST(i.kgInvoiced AS DECIMAL(14,2))) > 0
        THEN ROUND(SUM(CAST(i.revenueWithTax AS DECIMAL(14,2))) / SUM(CAST(i.kgInvoiced AS DECIMAL(14,2))), 2)
        ELSE 0 END as pricePerKg,
      COUNT(DISTINCT i.orderCode) as orderCount,
      MAX(i.invoiceDate) as lastPurchaseDate
    FROM invoices i WHERE i.productName = ${productName} ${repCondition}
    GROUP BY i.clientCodeSAP, i.clientName, i.clientCity, i.clientState, i.repCode, i.repName
    ORDER BY totalKg DESC
  `);
  return (result as any)[0] || [];
}

// ---- Rep Aliases ----

export async function getRepAliases() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(repAliases).orderBy(repAliases.alias);
}

export async function getRepAlias(repCode: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(repAliases).where(eq(repAliases.repCode, repCode)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertRepAlias(data: InsertRepAlias) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(repAliases).values(data).onDuplicateKeyUpdate({
    set: { alias: data.alias, parentRepCode: data.parentRepCode ?? null, neCode: data.neCode ?? null },
  });
}

// ---- Sales Goals ----

export async function getSalesGoals(yearMonth: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(salesGoals).where(eq(salesGoals.yearMonth, yearMonth));
}

export async function getSalesGoalForRep(repCode: string, yearMonth: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(salesGoals)
    .where(and(eq(salesGoals.repCode, repCode), eq(salesGoals.yearMonth, yearMonth))).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertSalesGoal(repCode: string, yearMonth: string, goalKg: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(salesGoals).values({ repCode, yearMonth, goalKg }).onDuplicateKeyUpdate({ set: { goalKg } });
}

// ---- Monthly Billed by Rep ----

export async function getMonthlyBilledByRep(yearMonth: string) {
  const db = await getDb();
  if (!db) return [];
  const dotFormat = yearMonth.replace('-', '.');
  const dashFormat = yearMonth.replace('.', '-');
  const result = await db.execute(sql`
    SELECT i.repCode, COALESCE(ra.alias, MAX(i.repName)) as repAlias, ra.parentRepCode,
      SUM(CAST(i.kgInvoiced AS DECIMAL(14,2))) as billedKg,
      SUM(CAST(i.revenueWithTax AS DECIMAL(14,2))) as billedRevenue,
      COUNT(DISTINCT i.orderCode) as orderCount,
      COUNT(DISTINCT i.clientCodeSAP) as clientCount
    FROM invoices i LEFT JOIN rep_aliases ra ON i.repCode = ra.repCode
    WHERE i.yearMonth IN (${dotFormat}, ${dashFormat})
    GROUP BY i.repCode, ra.alias, ra.parentRepCode ORDER BY billedKg DESC
  `);
  return (result as any)[0] || [];
}

// ---- Notification Helpers for Status Changes ----

const STATUS_LABELS: Record<string, string> = {
  em_acao: "Em Ação", pedido_na_tela: "Pedido na Tela", excluido: "Excluído", reset: "Reset",
  ativo: "Ativo", em_ciclo: "Em Ciclo", alerta: "Alerta", pre_inativacao: "Pré-Inativação", inativo: "Inativo",
};

export async function getAdminUserIds(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  return result.map(r => r.id);
}

export async function getUserIdByRepCode(repCode: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({ id: users.id }).from(users).where(eq(users.repCode, repCode)).limit(1);
  return result.length > 0 ? result[0].id : null;
}

export async function notifyStatusChange(params: {
  clientCodeSAP: string; clientName: string; repCode: string;
  actionType: string; previousStatus?: string | null; note?: string | null; actorUserId: number;
}) {
  const db = await getDb();
  if (!db) return;
  const newLabel = STATUS_LABELS[params.actionType] || params.actionType;
  const prevLabel = params.previousStatus ? (STATUS_LABELS[params.previousStatus] || params.previousStatus) : "—";
  const title = `Status alterado: ${params.clientName}`;
  const message = `Cliente ${params.clientName} (SAP: ${params.clientCodeSAP}) mudou de "${prevLabel}" para "${newLabel}".${params.note ? ` Nota: ${params.note}` : ""}`;
  const adminIds = await getAdminUserIds();
  for (const adminId of adminIds) {
    if (adminId === params.actorUserId) continue;
    await createNotification({ userId: adminId, repCode: params.repCode, type: "status_change", title, message, clientCodeSAP: params.clientCodeSAP, clientName: params.clientName });
  }
  const rcUserId = await getUserIdByRepCode(params.repCode);
  if (rcUserId && rcUserId !== params.actorUserId && !adminIds.includes(rcUserId)) {
    await createNotification({ userId: rcUserId, repCode: params.repCode, type: "status_change", title, message, clientCodeSAP: params.clientCodeSAP, clientName: params.clientName });
  }
}

// ---- Sales History ----

export async function getSalesHistory(repCode?: string, months: number = 12) {
  const db = await getDb();
  if (!db) return [];
  const repCondition = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT yearMonth,
      SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueNoTax AS DECIMAL(14,2))) as totalRevenue,
      COUNT(DISTINCT clientCodeSAP) as uniqueClients,
      COUNT(DISTINCT productName) as uniqueProducts
    FROM invoices
    WHERE yearMonth >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL ${months} MONTH), '%Y.%m')
    ${repCondition}
    GROUP BY yearMonth ORDER BY yearMonth ASC
  `);
  return (result as any)[0] || [];
}

export async function getTopClientsForMonth(yearMonth: string, repCode?: string, channelFilter?: string, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  const repCondition = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const channelCondition = channelFilter ? sql`AND salesChannelGroup = ${channelFilter}` : sql``;
  const result = await db.execute(sql`
    SELECT clientCodeSAP, clientName, clientCity, clientState,
      salesChannelGroup as channel,
      SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueNoTax AS DECIMAL(14,2))) as totalRevenue,
      COUNT(DISTINCT productName) as productCount,
      CASE WHEN SUM(CAST(kgInvoiced AS DECIMAL(14,2))) > 0
        THEN SUM(CAST(revenueNoTax AS DECIMAL(14,2))) / SUM(CAST(kgInvoiced AS DECIMAL(14,2)))
        ELSE 0 END as pricePerKg
    FROM invoices WHERE yearMonth = ${yearMonth} ${repCondition} ${channelCondition}
    GROUP BY clientCodeSAP, clientName, clientCity, clientState, salesChannelGroup
    ORDER BY totalKg DESC LIMIT ${limit}
  `);
  return (result as any)[0] || [];
}

export async function getClientProductsForMonth(yearMonth: string, clientCodeSAP: string, repCode?: string) {
  const db = await getDb();
  if (!db) return [];
  const repCondition = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT productName,
      SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueNoTax AS DECIMAL(14,2))) as totalRevenue,
      CASE WHEN SUM(CAST(kgInvoiced AS DECIMAL(14,2))) > 0
        THEN SUM(CAST(revenueNoTax AS DECIMAL(14,2))) / SUM(CAST(kgInvoiced AS DECIMAL(14,2)))
        ELSE 0 END as pricePerKg
    FROM invoices WHERE yearMonth = ${yearMonth} AND clientCodeSAP = ${clientCodeSAP} ${repCondition}
    GROUP BY productName ORDER BY totalKg DESC
  `);
  return (result as any)[0] || [];
}

export async function getTopProductsForMonth(yearMonth: string, repCode?: string, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  const repCondition = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT productName,
      SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueNoTax AS DECIMAL(14,2))) as totalRevenue,
      COUNT(DISTINCT clientCodeSAP) as clientCount,
      CASE WHEN SUM(CAST(kgInvoiced AS DECIMAL(14,2))) > 0
        THEN SUM(CAST(revenueNoTax AS DECIMAL(14,2))) / SUM(CAST(kgInvoiced AS DECIMAL(14,2)))
        ELSE 0 END as pricePerKg
    FROM invoices WHERE yearMonth = ${yearMonth} ${repCondition}
    GROUP BY productName ORDER BY totalKg DESC LIMIT ${limit}
  `);
  return (result as any)[0] || [];
}

export async function getProductClientsForMonth(yearMonth: string, productName: string, repCode?: string) {
  const db = await getDb();
  if (!db) return [];
  const repCondition = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT clientCodeSAP, clientName, clientCity, salesChannelGroup as channel,
      SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueNoTax AS DECIMAL(14,2))) as totalRevenue
    FROM invoices WHERE yearMonth = ${yearMonth} AND productName = ${productName} ${repCondition}
    GROUP BY clientCodeSAP, clientName, clientCity, salesChannelGroup ORDER BY totalKg DESC
  `);
  return (result as any)[0] || [];
}

export async function getRcRankingForMonth(yearMonth: string) {
  const db = await getDb();
  if (!db) return [];
  const aliases = await db.select().from(repAliases);
  const aliasMap = new Map(aliases.map(a => [a.repCode, a]));
  const result = await db.execute(sql`
    SELECT repCode, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueNoTax AS DECIMAL(14,2))) as totalRevenue,
      COUNT(DISTINCT clientCodeSAP) as uniqueClients,
      COUNT(DISTINCT productName) as uniqueProducts
    FROM invoices WHERE yearMonth = ${yearMonth} GROUP BY repCode ORDER BY totalKg DESC
  `);
  const rows: any[] = (result as any)[0] || [];
  const [prevYear, prevMonth] = yearMonth.split('.').map(Number);
  const pm = prevMonth === 1 ? 12 : prevMonth - 1;
  const py = prevMonth === 1 ? prevYear - 1 : prevYear;
  const prevYearMonth = `${py}.${String(pm).padStart(2, '0')}`;
  const prevResult = await db.execute(sql`
    SELECT repCode, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg
    FROM invoices WHERE yearMonth = ${prevYearMonth} GROUP BY repCode
  `);
  const prevRows: any[] = (prevResult as any)[0] || [];
  const prevMap = new Map(prevRows.map((r: any) => [r.repCode, Number(r.totalKg)]));

  const consolidated = new Map<string, any>();
  for (const row of rows) {
    const alias = aliasMap.get(row.repCode);
    const parentCode = alias?.parentRepCode || row.repCode;
    const parentAlias = aliasMap.get(parentCode);
    const key = parentCode;
    const existing = consolidated.get(key);
    if (existing) {
      existing.totalKg += Number(row.totalKg);
      existing.totalRevenue += Number(row.totalRevenue);
      existing.uniqueClients += Number(row.uniqueClients);
      existing.prevKg += prevMap.get(row.repCode) || 0;
      if (alias && alias.repCode !== parentCode) existing.childAliases.push(alias.alias || row.repCode);
    } else {
      consolidated.set(key, {
        repCode: parentCode,
        alias: parentAlias?.alias || alias?.alias || row.repCode,
        neCode: parentAlias?.neCode || alias?.neCode || null,
        totalKg: Number(row.totalKg), totalRevenue: Number(row.totalRevenue),
        uniqueClients: Number(row.uniqueClients), uniqueProducts: Number(row.uniqueProducts),
        prevKg: prevMap.get(row.repCode) || 0,
        childAliases: alias?.parentRepCode ? [alias.alias || row.repCode] : [],
      });
    }
  }
  let grandTotalKg = 0;
  for (const v of Array.from(consolidated.values())) grandTotalKg += v.totalKg;
  const ranking = Array.from(consolidated.values()).map(r => ({
    repCode: r.repCode, repAlias: r.alias, neCode: r.neCode,
    totalKg: r.totalKg, totalRevenue: r.totalRevenue,
    uniqueClients: r.uniqueClients, uniqueProducts: r.uniqueProducts,
    ticketMedio: r.uniqueClients > 0 ? r.totalRevenue / r.uniqueClients : 0,
    pctOfTotal: grandTotalKg > 0 ? (r.totalKg / grandTotalKg) * 100 : 0,
    varVsPrev: r.prevKg > 0 ? ((r.totalKg - r.prevKg) / r.prevKg) * 100 : (r.totalKg > 0 ? 100 : 0),
    childAliases: r.childAliases,
  }));
  ranking.sort((a, b) => b.totalKg - a.totalKg);
  const totalRevenue = ranking.reduce((s, r) => s + r.totalRevenue, 0);
  const totalClients = ranking.reduce((s, r) => s + r.uniqueClients, 0);
  const totalPrevKg = Array.from(consolidated.values()).reduce((s, r) => s + r.prevKg, 0);
  ranking.push({
    repCode: "TOTAL", repAlias: "TOTAL", neCode: null,
    totalKg: grandTotalKg, totalRevenue, uniqueClients: totalClients, uniqueProducts: 0,
    ticketMedio: totalClients > 0 ? totalRevenue / totalClients : 0, pctOfTotal: 100,
    varVsPrev: totalPrevKg > 0 ? ((grandTotalKg - totalPrevKg) / totalPrevKg) * 100 : 0,
    childAliases: [],
  });
  return ranking;
}

export async function getAvailableMonths() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`SELECT DISTINCT yearMonth FROM invoices ORDER BY yearMonth DESC`);
  return ((result as any)[0] || []).map((r: any) => r.yearMonth);
}

// ---- RC Invites ----

export async function createRcInvite(repCode: string): Promise<{ token: string }> {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const token = crypto.randomBytes(24).toString('hex');
  await db.insert(rcInvites).values({ repCode, token });
  return { token };
}

export async function getInviteByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(rcInvites).where(eq(rcInvites.token, token)).limit(1);
  return rows[0] || null;
}

export async function acceptInvite(token: string, userId: number): Promise<{ repCode: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const invite = await getInviteByToken(token);
  if (!invite || invite.usedAt) return null;
  await db.update(rcInvites).set({ usedAt: new Date(), usedByUserId: userId }).where(eq(rcInvites.id, invite.id));
  if (invite.repCode === '__GESTOR__') {
    await db.update(users).set({ repCode: null, role: 'admin' }).where(eq(users.id, userId));
  } else {
    await db.update(users).set({ repCode: invite.repCode, role: 'user' }).where(eq(users.id, userId));
  }
  return { repCode: invite.repCode };
}

export async function listInvites() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rcInvites).orderBy(desc(rcInvites.createdAt));
}

export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id, openId: users.openId, name: users.name, email: users.email,
    role: users.role, repCode: users.repCode, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.lastSignedIn));
}

export async function updateUserRole(userId: number, role: 'admin' | 'user') {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function updateUserRepCode(userId: number, repCode: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ repCode }).where(eq(users.id, userId));
}

export async function deleteInvite(inviteId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(rcInvites).where(eq(rcInvites.id, inviteId));
}

// ---- Programa Aceleração ----

export async function getAceleracaoData(repCode?: string, startYm?: string, endYm?: string) {
  const db = await getDb();
  if (!db) return { rows: [], lastInvoiceDate: null };
  const ymStart = startYm || '2025.03';
  const ymEnd = endYm || '2026.02';
  const repCondition = repCode ? sql`AND i.repCode = ${repCode}` : sql``;
  const [result] = await db.execute(sql`
    SELECT
      i.clientGroupCodeSAP as groupCode,
      MAX(i.clientParentName) as clientName,
      GROUP_CONCAT(DISTINCT i.repCode) as repCodes,
      SUM(CAST(i.kgInvoiced AS DECIMAL(14,2))) as totalKg,
      COUNT(DISTINCT i.clientCodeSAP) as subClients,
      COUNT(DISTINCT i.yearMonth) as monthsActive,
      MAX(i.clientCity) as city,
      MAX(i.clientState) as state,
      (
        SELECT
          CASE
            WHEN lat.salesChannel LIKE 'Master%' THEN 'Master'
            WHEN lat.salesChannel LIKE 'Especial Plus%' THEN 'Especial Plus'
            WHEN lat.salesChannel LIKE 'Especial%' THEN 'Especial'
            WHEN lat.salesChannel LIKE 'Essencial%' THEN 'Essencial'
            ELSE lat.salesChannel
          END
        FROM invoices lat
        WHERE lat.clientGroupCodeSAP = i.clientGroupCodeSAP
          AND lat.salesChannelGroup LIKE '%Revenda%'
        ORDER BY lat.invoiceDate DESC LIMIT 1
      ) as currentCategory
    FROM invoices i
    WHERE i.salesChannelGroup LIKE '%Revenda%'
      AND i.yearMonth >= ${ymStart} AND i.yearMonth <= ${ymEnd}
      ${repCondition}
    GROUP BY i.clientGroupCodeSAP ORDER BY totalKg DESC
  `);
  const [lastDateResult] = await db.execute(sql`
    SELECT MAX(i.invoiceDate) as lastDate FROM invoices i
    WHERE i.salesChannelGroup LIKE '%Revenda%' AND i.yearMonth >= ${ymStart} AND i.yearMonth <= ${ymEnd} ${repCondition}
  `);
  const lastInvoiceDate = (lastDateResult as any)?.[0]?.lastDate || null;
  return { rows: (result as unknown as any[]) || [], lastInvoiceDate };
}

export async function getAceleracaoMonthly(groupCode: string, repCode?: string, startYm?: string, endYm?: string) {
  const db = await getDb();
  if (!db) return [];
  const ymStart = startYm || '2025.03';
  const ymEnd = endYm || '2026.02';
  const repCondition = repCode ? sql`AND i.repCode = ${repCode}` : sql``;
  const [result] = await db.execute(sql`
    SELECT i.yearMonth, SUM(CAST(i.kgInvoiced AS DECIMAL(14,2))) as kg
    FROM invoices i
    WHERE i.salesChannelGroup LIKE '%Revenda%'
      AND i.yearMonth >= ${ymStart} AND i.yearMonth <= ${ymEnd}
      AND i.clientGroupCodeSAP = ${groupCode} ${repCondition}
    GROUP BY i.yearMonth ORDER BY i.yearMonth
  `);
  return (result as unknown as any[]) || [];
}

// ---- Page View Tracking ----

export async function recordPageView(userId: number, page: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(pageViews).values({ userId, page });
}

export async function getUserActivitySummary() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT u.id AS userId, u.name, u.email, u.role, u.repCode, u.lastSignedIn,
      (SELECT COUNT(*) FROM page_views pv WHERE pv.userId = u.id) AS totalViews,
      (SELECT COUNT(DISTINCT DATE(pv.createdAt)) FROM page_views pv WHERE pv.userId = u.id) AS activeDays,
      (SELECT MAX(pv.createdAt) FROM page_views pv WHERE pv.userId = u.id) AS lastPageView,
      (SELECT pv.page FROM page_views pv WHERE pv.userId = u.id ORDER BY pv.createdAt DESC LIMIT 1) AS lastPage
    FROM users u WHERE u.role != 'admin' OR u.repCode IS NOT NULL ORDER BY u.lastSignedIn DESC
  `);
  return (rows as any)[0] || [];
}

export async function getUserPageBreakdown(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT page, COUNT(*) AS views, MAX(createdAt) AS lastVisit
    FROM page_views WHERE userId = ${userId} GROUP BY page ORDER BY views DESC
  `);
  return (rows as any)[0] || [];
}

export async function getUserRecentActivity(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT page, createdAt FROM page_views WHERE userId = ${userId} ORDER BY createdAt DESC LIMIT ${limit}
  `);
  return (rows as any)[0] || [];
}

export async function getUserDailyActivity(userId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT DATE(createdAt) AS day, COUNT(*) AS views, COUNT(DISTINCT page) AS uniquePages
    FROM page_views WHERE userId = ${userId} AND createdAt >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
    GROUP BY DATE(createdAt) ORDER BY day DESC
  `);
  return (rows as any)[0] || [];
}

// ---- Auto-reset "Pedido na Tela" for clients that appear in uploaded invoices ----

export async function resetPedidoNaTelaForInvoicedClients(yearMonths: string[]): Promise<number> {
  const db = await getDb();
  if (!db || yearMonths.length === 0) return 0;
  const ymPlaceholders = yearMonths.map(ym => `'${ym.replace(/'/g, "")}'`).join(",");
  const [invoicedClients] = await db.execute(sql.raw(`
    SELECT DISTINCT i.clientCodeSAP, i.repCode FROM invoices i
    WHERE i.yearMonth IN (${ymPlaceholders}) AND i.clientCodeSAP IS NOT NULL
  `));
  if (!Array.isArray(invoicedClients) || invoicedClients.length === 0) return 0;
  let resetCount = 0;
  for (const ic of invoicedClients as any[]) {
    const clientCode = ic.clientCodeSAP;
    const repCode = ic.repCode;
    if (!clientCode || !repCode) continue;
    const [latestActions] = await db.execute(sql`
      SELECT actionType FROM client_actions
      WHERE clientCodeSAP = ${clientCode} AND repCode = ${repCode}
      ORDER BY createdAt DESC LIMIT 1
    `);
    const latest = (latestActions as unknown as any[])?.[0];
    if (latest?.actionType === "pedido_na_tela") {
      await db.insert(clientActions).values({
        clientCodeSAP: clientCode, repCode: repCode, userId: 0, actionType: "reset",
        note: "Auto-reset: fatura importada para o mês", previousStatus: "pedido_na_tela",
      });
      resetCount++;
    }
  }
  return resetCount;
}
