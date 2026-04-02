import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, invoices, clientActions, notifications, uploadLogs, rcInvites, repAliases, salesGoals, pageViews, managerInvites, type InsertInvoice, type InsertClientAction, type InsertUploadLog, type InsertManagerInvite } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
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
    const assignNullable = (field: TextField) => { const value = user[field]; if (value === undefined) return; const normalized = value ?? null; values[field] = normalized; updateSet[field] = normalized; };
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

// ---- Upload & Invoice Helpers ----
export async function createUploadLog(data: InsertUploadLog) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  const result = await db.insert(uploadLogs).values(data);
  return result[0].insertId;
}

export async function updateUploadLog(id: number, data: Partial<InsertUploadLog>) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  await db.update(uploadLogs).set(data).where(eq(uploadLogs.id, id));
}

export async function getUploadLogs(limit = 20) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(uploadLogs).orderBy(desc(uploadLogs.createdAt)).limit(limit);
}

export async function bulkInsertInvoices(rows: InsertInvoice[]) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  let inserted = 0; let duplicates = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    try {
      const result = await db.execute(sql`
        INSERT INTO invoices (orderCode, orderItem, invoiceDate, year, yearMonth, month, origin,
          regionalManagement, districtManagement, supervision, microRegion, repName, repCode, repStatus,
          clientCodeDatasul, clientCodeSAP, clientGroupCodeSAP, clientName, clientParentName,
          clientCity, clientState, clientAddress, clientPhone, clientDocument, atcResponsible,
          salesChannel, salesChannelGroup, pittClassification, productCodeDatasul, productCodeSAP,
          productName, productCategory, productTechnological, productProgram, specialFormula,
          freightType, kgInvoiced, revenueNoTax, revenueWithTax, reference, implantationDate,
          priceFixDate, precisionFarming, uploadId)
        VALUES ${sql.join(batch.map(r => sql`(
          ${r.orderCode}, ${r.orderItem}, ${r.invoiceDate}, ${r.year ?? null}, ${r.yearMonth ?? null},
          ${r.month ?? null}, ${r.origin ?? null}, ${r.regionalManagement ?? null}, ${r.districtManagement ?? null},
          ${r.supervision ?? null}, ${r.microRegion ?? null}, ${r.repName}, ${r.repCode}, ${r.repStatus ?? null},
          ${r.clientCodeDatasul ?? null}, ${r.clientCodeSAP ?? null}, ${r.clientGroupCodeSAP ?? null},
          ${r.clientName}, ${r.clientParentName ?? null}, ${r.clientCity ?? null}, ${r.clientState ?? null},
          ${r.clientAddress ?? null}, ${r.clientPhone ?? null}, ${r.clientDocument ?? null},
          ${r.atcResponsible ?? null}, ${r.salesChannel ?? null}, ${r.salesChannelGroup ?? null},
          ${r.pittClassification ?? null}, ${r.productCodeDatasul ?? null}, ${r.productCodeSAP ?? null},
          ${r.productName}, ${r.productCategory ?? null}, ${r.productTechnological ?? null},
          ${r.productProgram ?? null}, ${r.specialFormula ?? null}, ${r.freightType ?? null},
          ${r.kgInvoiced}, ${r.revenueNoTax ?? null}, ${r.revenueWithTax ?? null},
          ${r.reference ?? null}, ${r.implantationDate ?? null}, ${r.priceFixDate ?? null},
          ${r.precisionFarming ?? null}, ${r.uploadId ?? null}
        )`), sql`, `)}
      `);
      const affectedRows = (result as any)[0]?.affectedRows ?? batch.length;
      inserted += affectedRows; duplicates += batch.length - affectedRows;
    } catch (err) { console.error("[DB] Batch insert error:", err); duplicates += batch.length; }
  }
  return { inserted, duplicates };
}

export async function deleteInvoicesByYearMonths(yearMonths: string[]) {
  const db = await getDb(); if (!db) return 0;
  let deleted = 0;
  for (const ym of yearMonths) {
    const result = await db.execute(sql`DELETE FROM invoices WHERE yearMonth = ${ym}`);
    deleted += (result as any)[0]?.affectedRows ?? 0;
  }
  return deleted;
}

// ---- Client Cycle Queries ----
export async function getClientPurchaseHistory(repCode?: string, channelFilter?: string) {
  const db = await getDb(); if (!db) return [];
  const conditions: any[] = [];
  if (repCode) conditions.push(sql`i.repCode = ${repCode}`);
  if (channelFilter) conditions.push(sql`i.salesChannelGroup = ${channelFilter}`);
  const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
  const result = await db.execute(sql`
    SELECT i.clientCodeSAP, i.clientName, i.clientCity, i.clientState, i.clientPhone, i.clientDocument,
      i.salesChannel, i.salesChannelGroup, i.repCode, i.repName,
      MAX(i.invoiceDate) as lastPurchaseDate, COUNT(DISTINCT i.orderCode) as orderCount,
      SUM(CAST(i.kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(i.revenueWithTax AS DECIMAL(14,2))) as totalRevenue,
      MIN(i.invoiceDate) as firstPurchaseDate
    FROM invoices i ${whereClause}
    GROUP BY i.clientCodeSAP, i.clientName, i.clientCity, i.clientState, i.clientPhone,
             i.clientDocument, i.salesChannel, i.salesChannelGroup, i.repCode, i.repName
    ORDER BY lastPurchaseDate DESC
  `);
  return (result as any)[0] || [];
}

export async function getClientOrderDates(clientCodeSAP: string, repCode: string) {
  const db = await getDb(); if (!db) return [];
  const result = await db.execute(sql`
    SELECT orderCode, MIN(DATE(invoiceDate)) as orderDate, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as kgTotal
    FROM invoices WHERE clientCodeSAP = ${clientCodeSAP} AND repCode = ${repCode}
    GROUP BY orderCode ORDER BY orderDate ASC
  `);
  return (result as any)[0] || [];
}

export async function getClientLastOrders(clientCodeSAP: string, repCode: string, limit = 3) {
  const db = await getDb(); if (!db) return [];
  const result = await db.execute(sql`
    SELECT orderCode, DATE(invoiceDate) as orderDate, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue, COUNT(*) as itemCount
    FROM invoices WHERE clientCodeSAP = ${clientCodeSAP} AND repCode = ${repCode}
    GROUP BY orderCode, DATE(invoiceDate) ORDER BY orderDate DESC LIMIT ${limit}
  `);
  return (result as any)[0] || [];
}

export async function getClientOrderProducts(clientCodeSAP: string, repCode: string, orderCode: string) {
  const db = await getDb(); if (!db) return [];
  const result = await db.execute(sql`
    SELECT productName, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as kgTotal,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as revenueTotal
    FROM invoices WHERE clientCodeSAP = ${clientCodeSAP} AND repCode = ${repCode} AND orderCode = ${orderCode}
    GROUP BY productName ORDER BY kgTotal DESC
  `);
  return (result as any)[0] || [];
}

export async function getClientProductBreakdown(clientCodeSAP: string, repCode: string) {
  const db = await getDb(); if (!db) return [];
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
  const db = await getDb(); if (!db) return [];
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

// ---- Client Actions ----
export async function getLatestClientAction(clientCodeSAP: string, repCode: string) {
  const db = await getDb(); if (!db) return null;
  const result = await db.select().from(clientActions)
    .where(and(eq(clientActions.clientCodeSAP, clientCodeSAP), eq(clientActions.repCode, repCode)))
    .orderBy(desc(clientActions.createdAt)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getClientActionHistory(clientCodeSAP: string, repCode: string) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(clientActions)
    .where(and(eq(clientActions.clientCodeSAP, clientCodeSAP), eq(clientActions.repCode, repCode)))
    .orderBy(desc(clientActions.createdAt)).limit(50);
}

export async function insertClientAction(data: InsertClientAction) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  await db.insert(clientActions).values(data);
}

export async function getAllClientActions(repCode?: string) {
  const db = await getDb(); if (!db) return [];
  const filter = repCode ? sql`WHERE ca.repCode = ${repCode}` : sql``;
  return db.execute(sql`
    SELECT ca.* FROM client_actions ca
    INNER JOIN (SELECT clientCodeSAP, repCode, MAX(createdAt) as maxCreated FROM client_actions ${filter} GROUP BY clientCodeSAP, repCode) latest
    ON ca.clientCodeSAP = latest.clientCodeSAP AND ca.repCode = latest.repCode AND ca.createdAt = latest.maxCreated
    WHERE ca.actionType != 'reset'
  `).then(r => (r as any)[0] || []);
}

// ---- Dashboard Metrics ----
export async function getDashboardKgByPeriod(repCode: string | undefined, days: number) {
  const db = await getDb(); if (!db) return 0;
  const filter = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(kgInvoiced AS DECIMAL(14,2))), 0) as total
    FROM invoices WHERE invoiceDate >= DATE_SUB(NOW(), INTERVAL ${days} DAY) ${filter}
  `);
  return Number((result as any)[0]?.[0]?.total) || 0;
}

export async function getMonthlyEvolution(repCode?: string) {
  const db = await getDb(); if (!db) return [];
  const filter = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT yearMonth, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue, COUNT(DISTINCT clientCodeSAP) as clientCount
    FROM invoices WHERE yearMonth IS NOT NULL ${filter}
    GROUP BY yearMonth ORDER BY yearMonth DESC LIMIT 12
  `);
  return ((result as any)[0] || []).reverse();
}

export async function getTopClientsByVolume(repCode?: string) {
  const db = await getDb(); if (!db) return [];
  const filter = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT clientCodeSAP, clientName, clientCity, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue, COUNT(DISTINCT orderCode) as orderCount
    FROM invoices WHERE invoiceDate >= DATE_SUB(NOW(), INTERVAL 12 MONTH) ${filter}
    GROUP BY clientCodeSAP, clientName, clientCity ORDER BY totalKg DESC LIMIT 10
  `);
  return (result as any)[0] || [];
}

export async function getPricePerKgByProduct(repCode?: string) {
  const db = await getDb(); if (!db) return [];
  const filter = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT productName, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueNoTax AS DECIMAL(14,2))) as totalRevenue,
      CASE WHEN SUM(CAST(kgInvoiced AS DECIMAL(14,2))) > 0
        THEN ROUND(SUM(CAST(revenueNoTax AS DECIMAL(14,2))) / SUM(CAST(kgInvoiced AS DECIMAL(14,2))), 2)
        ELSE 0 END as pricePerKg
    FROM invoices WHERE 1=1 ${filter}
    GROUP BY productName HAVING totalKg > 0 ORDER BY totalKg DESC LIMIT 20
  `);
  return (result as any)[0] || [];
}

// ---- Rep Benchmarking ----
export async function getRepBenchmarking() {
  const db = await getDb(); if (!db) return [];
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
      INNER JOIN (SELECT clientCodeSAP, repCode, MAX(createdAt) as maxCreated FROM client_actions GROUP BY clientCodeSAP, repCode) latest
      ON ca.clientCodeSAP = latest.clientCodeSAP AND ca.repCode = latest.repCode AND ca.createdAt = latest.maxCreated
      GROUP BY ca.repCode
    ) a ON r.repCode = a.repCode
    ORDER BY r.totalKg DESC
  `);
  return (result as any)[0] || [];
}

// ---- Product Analysis ----
export async function getProductAnalysis(repCode?: string, filters?: { product?: string; channel?: string; city?: string; microRegion?: string }) {
  const db = await getDb(); if (!db) return [];
  const conditions: any[] = [];
  if (repCode) conditions.push(sql`repCode = ${repCode}`);
  if (filters?.product) conditions.push(sql`productName = ${filters.product}`);
  if (filters?.channel) conditions.push(sql`salesChannelGroup = ${filters.channel}`);
  if (filters?.city) conditions.push(sql`clientCity = ${filters.city}`);
  if (filters?.microRegion) conditions.push(sql`microRegion = ${filters.microRegion}`);
  const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
  const result = await db.execute(sql`
    SELECT productName, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueNoTax AS DECIMAL(14,2))) as totalRevenue,
      COUNT(DISTINCT clientCodeSAP) as clientCount, COUNT(DISTINCT orderCode) as orderCount
    FROM invoices ${whereClause}
    GROUP BY productName ORDER BY totalKg DESC
  `);
  return (result as any)[0] || [];
}

export async function getProductFilters(repCode?: string) {
  const db = await getDb(); if (!db) return { channels: [], cities: [], microRegions: [], products: [] };
  const filter = repCode ? sql`WHERE repCode = ${repCode}` : sql``;
  const [ch, ci, mr, pr] = await Promise.all([
    db.execute(sql`SELECT DISTINCT salesChannelGroup as v FROM invoices ${filter} ORDER BY v`),
    db.execute(sql`SELECT DISTINCT clientCity as v FROM invoices ${filter} ORDER BY v`),
    db.execute(sql`SELECT DISTINCT microRegion as v FROM invoices ${filter} ORDER BY v`),
    db.execute(sql`SELECT DISTINCT productName as v FROM invoices ${filter} ORDER BY v`),
  ]);
  return {
    channels: ((ch as any)[0] || []).map((r: any) => r.v).filter(Boolean),
    cities: ((ci as any)[0] || []).map((r: any) => r.v).filter(Boolean),
    microRegions: ((mr as any)[0] || []).map((r: any) => r.v).filter(Boolean),
    products: ((pr as any)[0] || []).map((r: any) => r.v).filter(Boolean),
  };
}

export async function getClientsByProduct(productName: string, repCode?: string) {
  const db = await getDb(); if (!db) return [];
  const repCondition = repCode ? sql`AND i.repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT i.clientCodeSAP, i.clientName, i.clientCity, i.clientState, i.repCode, i.repName,
      SUM(CAST(i.kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(i.revenueWithTax AS DECIMAL(14,2))) as totalRevenue,
      CASE WHEN SUM(CAST(i.kgInvoiced AS DECIMAL(14,2))) > 0
        THEN ROUND(SUM(CAST(i.revenueWithTax AS DECIMAL(14,2))) / SUM(CAST(i.kgInvoiced AS DECIMAL(14,2))), 2)
        ELSE 0 END as pricePerKg,
      COUNT(DISTINCT i.orderCode) as orderCount, MAX(i.invoiceDate) as lastPurchaseDate
    FROM invoices i WHERE i.productName = ${productName} ${repCondition}
    GROUP BY i.clientCodeSAP, i.clientName, i.clientCity, i.clientState, i.repCode, i.repName
    ORDER BY totalKg DESC
  `);
  return (result as any)[0] || [];
}

// ---- Sales History ----
export async function getAvailableMonths() {
  const db = await getDb(); if (!db) return [];
  const result = await db.execute(sql`SELECT DISTINCT yearMonth FROM invoices WHERE yearMonth IS NOT NULL ORDER BY yearMonth DESC`);
  return ((result as any)[0] || []).map((r: any) => r.yearMonth);
}

export async function getSalesHistory(repCode?: string, months = 12) {
  const db = await getDb(); if (!db) return [];
  const filter = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT yearMonth, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue,
      COUNT(DISTINCT clientCodeSAP) as clientCount, COUNT(DISTINCT orderCode) as orderCount
    FROM invoices WHERE yearMonth IS NOT NULL ${filter}
    GROUP BY yearMonth ORDER BY yearMonth DESC LIMIT ${months}
  `);
  return ((result as any)[0] || []).reverse();
}

export async function getTopClientsForMonth(yearMonth: string, repCode?: string, channelFilter?: string) {
  const db = await getDb(); if (!db) return [];
  const conditions = [sql`yearMonth = ${yearMonth}`];
  if (repCode) conditions.push(sql`repCode = ${repCode}`);
  if (channelFilter) conditions.push(sql`salesChannelGroup = ${channelFilter}`);
  const result = await db.execute(sql`
    SELECT clientCodeSAP, clientName, repCode, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue
    FROM invoices WHERE ${sql.join(conditions, sql` AND `)}
    GROUP BY clientCodeSAP, clientName, repCode ORDER BY totalKg DESC LIMIT 20
  `);
  return (result as any)[0] || [];
}

export async function getClientProductsForMonth(yearMonth: string, clientCodeSAP: string, repCode?: string) {
  const db = await getDb(); if (!db) return [];
  const filter = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT productName, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue
    FROM invoices WHERE yearMonth = ${yearMonth} AND clientCodeSAP = ${clientCodeSAP} ${filter}
    GROUP BY productName ORDER BY totalKg DESC
  `);
  return (result as any)[0] || [];
}

export async function getTopProductsForMonth(yearMonth: string, repCode?: string) {
  const db = await getDb(); if (!db) return [];
  const filter = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT productName, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue, COUNT(DISTINCT clientCodeSAP) as clientCount
    FROM invoices WHERE yearMonth = ${yearMonth} ${filter}
    GROUP BY productName ORDER BY totalKg DESC LIMIT 20
  `);
  return (result as any)[0] || [];
}

export async function getProductClientsForMonth(yearMonth: string, productName: string, repCode?: string) {
  const db = await getDb(); if (!db) return [];
  const filter = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT clientCodeSAP, clientName, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue
    FROM invoices WHERE yearMonth = ${yearMonth} AND productName = ${productName} ${filter}
    GROUP BY clientCodeSAP, clientName ORDER BY totalKg DESC
  `);
  return (result as any)[0] || [];
}

export async function getRcRankingForMonth(yearMonth: string) {
  const db = await getDb(); if (!db) return [];
  const result = await db.execute(sql`
    SELECT i.repCode, MAX(i.repName) as repName, SUM(CAST(i.kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(i.revenueWithTax AS DECIMAL(14,2))) as totalRevenue,
      COUNT(DISTINCT i.clientCodeSAP) as clientCount, COUNT(DISTINCT i.orderCode) as orderCount
    FROM invoices i WHERE i.yearMonth = ${yearMonth}
    GROUP BY i.repCode ORDER BY totalKg DESC
  `);
  const rows = (result as any)[0] || [];
  const aliases = await getRepAliases();
  const aliasMap = new Map(aliases.map((a: any) => [a.repCode, a]));
  return rows.map((r: any) => ({ ...r, alias: aliasMap.get(r.repCode)?.alias || r.repName, parentRepCode: aliasMap.get(r.repCode)?.parentRepCode || null }));
}

// ---- Aceleração ----
export async function getAceleracaoData(repCode?: string, startYm?: string, endYm?: string) {
  const db = await getDb(); if (!db) return [];
  const start = startYm || "2025.03";
  const end = endYm || "2026.02";
  const filter = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT clientGroupCodeSAP as groupCode, MAX(clientParentName) as groupName, MAX(clientName) as clientName,
      repCode, MAX(repName) as repName, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      COUNT(DISTINCT yearMonth) as monthsActive, COUNT(DISTINCT orderCode) as orderCount
    FROM invoices WHERE salesChannelGroup = 'Revenda' AND yearMonth >= ${start} AND yearMonth <= ${end} ${filter}
    GROUP BY clientGroupCodeSAP, repCode ORDER BY totalKg DESC
  `);
  return (result as any)[0] || [];
}

export async function getAceleracaoMonthly(groupCode: string, repCode?: string, startYm?: string, endYm?: string) {
  const db = await getDb(); if (!db) return [];
  const start = startYm || "2025.03";
  const end = endYm || "2026.02";
  const filter = repCode ? sql`AND repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT yearMonth, SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg,
      SUM(CAST(revenueWithTax AS DECIMAL(14,2))) as totalRevenue, COUNT(DISTINCT orderCode) as orderCount
    FROM invoices WHERE clientGroupCodeSAP = ${groupCode} AND salesChannelGroup = 'Revenda'
      AND yearMonth >= ${start} AND yearMonth <= ${end} ${filter}
    GROUP BY yearMonth ORDER BY yearMonth ASC
  `);
  return (result as any)[0] || [];
}

// ---- Rep Summary (Manager) ----
export async function getRepSummary() {
  const db = await getDb(); if (!db) return [];
  const result = await db.execute(sql`
    SELECT repCode, MAX(repName) as repName, COUNT(DISTINCT clientCodeSAP) as clientCount,
      SUM(CAST(kgInvoiced AS DECIMAL(14,2))) as totalKg, COUNT(DISTINCT orderCode) as orderCount,
      MAX(invoiceDate) as lastInvoiceDate
    FROM invoices GROUP BY repCode ORDER BY totalKg DESC
  `);
  return (result as any)[0] || [];
}

// ---- Notifications ----
export async function getUserNotifications(userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb(); if (!db) return 0;
  const result = await db.execute(sql`SELECT COUNT(*) as cnt FROM notifications WHERE userId = ${userId} AND isRead = 0`);
  return Number((result as any)[0]?.[0]?.cnt) || 0;
}

export async function markNotificationsRead(userId: number, ids?: number[]) {
  const db = await getDb(); if (!db) return;
  if (ids && ids.length > 0) {
    await db.execute(sql`UPDATE notifications SET isRead = 1 WHERE userId = ${userId} AND id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
  } else {
    await db.execute(sql`UPDATE notifications SET isRead = 1 WHERE userId = ${userId}`);
  }
}

export async function createNotification(data: { userId: number; repCode?: string; type: any; title: string; message?: string; clientCodeSAP?: string; clientName?: string }) {
  const db = await getDb(); if (!db) return;
  await db.insert(notifications).values(data as any);
}

export async function getAdminUserIds(): Promise<number[]> {
  const db = await getDb(); if (!db) return [];
  const result = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  return result.map(r => r.id);
}

export async function getUserIdByRepCode(repCode: string): Promise<number | null> {
  const db = await getDb(); if (!db) return null;
  const result = await db.select({ id: users.id }).from(users).where(eq(users.repCode, repCode)).limit(1);
  return result.length > 0 ? result[0].id : null;
}

const STATUS_LABELS: Record<string, string> = {
  em_acao: "Em Ação", pedido_na_tela: "Pedido na Tela", excluido: "Excluído", reset: "Reset",
  ativo: "Ativo", em_ciclo: "Em Ciclo", alerta: "Alerta", pre_inativacao: "Pré-Inativação", inativo: "Inativo",
};

export async function notifyStatusChange(params: {
  clientCodeSAP: string; clientName: string; repCode: string;
  actionType: string; previousStatus?: string | null; note?: string | null; actorUserId: number;
}) {
  const db = await getDb(); if (!db) return;
  const newLabel = STATUS_LABELS[params.actionType] || params.actionType;
  const prevLabel = params.previousStatus ? (STATUS_LABELS[params.previousStatus] || params.previousStatus) : "—";
  const title = `Status alterado: ${params.clientName}`;
  const message = `Cliente ${params.clientName} (SAP: ${params.clientCodeSAP}) mudou de "${prevLabel}" para "${newLabel}".${params.note ? ` Nota: ${params.note}` : ""}`;
  const adminIds = await getAdminUserIds();
  for (const adminId of adminIds) {
    if (adminId === params.actorUserId) continue;
    await createNotification({ userId: adminId, repCode: params.repCode, type: "status_change", title, message, clientCodeSAP: params.clientCodeSAP, clientName: params.clientName });
  }
}

// ---- Rep Aliases ----
export async function getRepAliases() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(repAliases).orderBy(repAliases.alias);
}

export async function upsertRepAlias(data: { repCode: string; repName: string; alias: string; parentRepCode?: string; neCode?: string }) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  await db.insert(repAliases).values(data as any).onDuplicateKeyUpdate({
    set: { repName: data.repName, alias: data.alias, parentRepCode: data.parentRepCode || undefined, neCode: data.neCode || undefined },
  });
}

// ---- Sales Goals ----
export async function getSalesGoals(yearMonth: string) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(salesGoals).where(eq(salesGoals.yearMonth, yearMonth));
}

export async function upsertSalesGoal(repCode: string, yearMonth: string, goalKg: string) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  await db.insert(salesGoals).values({ repCode, yearMonth, goalKg } as any).onDuplicateKeyUpdate({ set: { goalKg } });
}

export async function getMonthlyBilledByRep(yearMonth: string) {
  const db = await getDb(); if (!db) return [];
  const dotFormat = yearMonth.replace('-', '.');
  const dashFormat = yearMonth.replace('.', '-');
  const result = await db.execute(sql`
    SELECT i.repCode, COALESCE(ra.alias, MAX(i.repName)) as repAlias, ra.parentRepCode,
      SUM(CAST(i.kgInvoiced AS DECIMAL(14,2))) as billedKg,
      SUM(CAST(i.revenueWithTax AS DECIMAL(14,2))) as billedRevenue,
      COUNT(DISTINCT i.orderCode) as orderCount, COUNT(DISTINCT i.clientCodeSAP) as clientCount
    FROM invoices i LEFT JOIN rep_aliases ra ON i.repCode = ra.repCode
    WHERE i.yearMonth IN (${dotFormat}, ${dashFormat})
    GROUP BY i.repCode, ra.alias, ra.parentRepCode ORDER BY billedKg DESC
  `);
  return (result as any)[0] || [];
}

// ---- Invites ----
export async function createRcInvite(repCode: string) {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  const token = crypto.randomUUID().replace(/-/g, "");
  await db.insert(rcInvites).values({ repCode, token });
  return { token };
}

export async function listInvites() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(rcInvites).orderBy(desc(rcInvites.createdAt));
}

export async function deleteInvite(inviteId: number) {
  const db = await getDb(); if (!db) return;
  await db.delete(rcInvites).where(eq(rcInvites.id, inviteId));
}

export async function getInviteByToken(token: string) {
  const db = await getDb(); if (!db) return null;
  const result = await db.select().from(rcInvites).where(eq(rcInvites.token, token)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function acceptInvite(token: string, userId: number) {
  const db = await getDb(); if (!db) return null;
  const invite = await getInviteByToken(token);
  if (!invite || invite.usedAt) return null;
  const isGestor = invite.repCode === "__GESTOR__";
  await db.update(users).set({ repCode: isGestor ? null : invite.repCode, role: isGestor ? "admin" : "user" }).where(eq(users.id, userId));
  await db.update(rcInvites).set({ usedAt: new Date(), usedByUserId: userId }).where(eq(rcInvites.id, invite.id));
  return { repCode: invite.repCode };
}

// ---- User Management ----
export async function listAllUsers() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(users).orderBy(desc(users.lastSignedIn));
}

export async function updateUserRole(userId: number, role: "admin" | "user") {
  const db = await getDb(); if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function updateUserRepCode(userId: number, repCode: string | null) {
  const db = await getDb(); if (!db) return;
  await db.update(users).set({ repCode }).where(eq(users.id, userId));
}

// ---- Page View Tracking ----
export async function recordPageView(userId: number, page: string) {
  const db = await getDb(); if (!db) return;
  await db.insert(pageViews).values({ userId, page });
}

export async function getUserActivitySummary() {
  const db = await getDb(); if (!db) return [];
  const result = await db.execute(sql`
    SELECT u.id as userId, u.name, u.email, u.role, u.repCode, u.lastSignedIn,
      COUNT(pv.id) as totalViews, MAX(pv.createdAt) as lastActivity,
      DATEDIFF(NOW(), MAX(pv.createdAt)) as daysSinceLastActivity
    FROM users u LEFT JOIN page_views pv ON u.id = pv.userId
    GROUP BY u.id, u.name, u.email, u.role, u.repCode, u.lastSignedIn
    ORDER BY lastActivity DESC
  `);
  return (result as any)[0] || [];
}

export async function getUserPageBreakdown(userId: number) {
  const db = await getDb(); if (!db) return [];
  const result = await db.execute(sql`
    SELECT page, COUNT(*) as views, MAX(createdAt) as lastVisit
    FROM page_views WHERE userId = ${userId} GROUP BY page ORDER BY views DESC
  `);
  return (result as any)[0] || [];
}

export async function getUserRecentActivity(userId: number, limit = 20) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(pageViews).where(eq(pageViews.userId, userId)).orderBy(desc(pageViews.createdAt)).limit(limit);
}

export async function getUserDailyActivity(userId: number, days = 30) {
  const db = await getDb(); if (!db) return [];
  const result = await db.execute(sql`
    SELECT DATE(createdAt) as day, COUNT(*) as views
    FROM page_views WHERE userId = ${userId} AND createdAt >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
    GROUP BY DATE(createdAt) ORDER BY day ASC
  `);
  return (result as any)[0] || [];
}

// ---- Annotations Export ----
export async function getAnnotationsExport(repCode?: string) {
  const db = await getDb(); if (!db) return [];
  const filter = repCode ? sql`WHERE ca.repCode = ${repCode}` : sql``;
  const result = await db.execute(sql`
    SELECT ca.clientCodeSAP, ca.repCode, ca.actionType, ca.note, ca.createdAt, u.name as userName
    FROM client_actions ca LEFT JOIN users u ON ca.userId = u.id ${filter}
    ORDER BY ca.createdAt DESC LIMIT 500
  `);
  return (result as any)[0] || [];
}

// ---- Export ----
export async function getInvoicesForExport(params: { repCode?: string; startDate?: string; endDate?: string; clientCodeSAP?: string; productName?: string }) {
  const db = await getDb(); if (!db) return [];
  const conditions: any[] = [];
  if (params.repCode) conditions.push(sql`repCode = ${params.repCode}`);
  if (params.startDate) conditions.push(sql`invoiceDate >= ${params.startDate}`);
  if (params.endDate) conditions.push(sql`invoiceDate <= ${params.endDate}`);
  if (params.clientCodeSAP) conditions.push(sql`clientCodeSAP = ${params.clientCodeSAP}`);
  if (params.productName) conditions.push(sql`productName = ${params.productName}`);
  const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
  const result = await db.execute(sql`
    SELECT orderCode, orderItem, invoiceDate, yearMonth, repCode, repName, clientCodeSAP, clientName,
      salesChannel, productName, kgInvoiced, revenueNoTax, revenueWithTax
    FROM invoices ${whereClause} ORDER BY invoiceDate DESC LIMIT 5000
  `);
  return (result as any)[0] || [];
}

// ---- Manager/Gestor Invite Helpers ----
export async function createManagerInvite() {
  const db = await getDb(); if (!db) throw new Error("DB not available");
  const token = crypto.randomUUID().replace(/-/g, "");
  await db.insert(managerInvites).values({ token });
  return { token };
}

export async function listManagerInvites() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(managerInvites).orderBy(desc(managerInvites.createdAt));
}

export async function deleteManagerInvite(inviteId: number) {
  const db = await getDb(); if (!db) return;
  await db.delete(managerInvites).where(eq(managerInvites.id, inviteId));
}

export async function getManagerInviteByToken(token: string) {
  const db = await getDb(); if (!db) return null;
  const result = await db.select().from(managerInvites).where(eq(managerInvites.token, token)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function acceptManagerInvite(token: string, userId: number) {
  const db = await getDb(); if (!db) return null;
  const invite = await getManagerInviteByToken(token);
  if (!invite || invite.usedAt) return null;
  await db.update(users).set({ role: "admin" }).where(eq(users.id, userId));
  await db.update(managerInvites).set({ usedAt: new Date(), usedByUserId: userId }).where(eq(managerInvites.id, invite.id));
  return { success: true };
}
