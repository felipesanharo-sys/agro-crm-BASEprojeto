import { COOKIE_NAME } from "@shared/const";
import { COLUMN_MAP, REQUIRED_COLUMNS } from "@shared/types";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";
import * as XLSX from "xlsx";

// ── Helpers ────────────────────────────────────────────────────────────

let _repCodeCache: Map<string, string | null> | null = null;
async function resolveParentRepCode(repCode: string): Promise<string> {
  const d = await db.getDb();
  if (!d) return repCode;
  if (!_repCodeCache) {
    const { repAliases } = await import("../drizzle/schema");
    const aliases = await d.select().from(repAliases);
    _repCodeCache = new Map(aliases.map(a => [a.repCode, a.parentRepCode]));
  }
  return _repCodeCache.get(repCode) || repCode;
}

async function getUserRepCode(user: { role: string; repCode?: string | null }): Promise<string | undefined> {
  if (user.role === "admin") return undefined;
  const raw = user.repCode || "__UNLINKED__";
  if (raw === "__UNLINKED__") return raw;
  return resolveParentRepCode(raw);
}

function getUserRawRepCode(user: { role: string; repCode?: string | null }) {
  if (user.role === "admin") return undefined;
  return user.repCode || "__UNLINKED__";
}

const MIN_CYCLE_DAYS = 30;

function calculateCycleFromOrders(orderDates: { orderDate: string | Date; kgTotal?: number }[]) {
  let avgDays = 90;
  let stdDev = 30;
  if (orderDates.length >= 2) {
    const dates = orderDates.map((d: any) => new Date(d.orderDate).getTime());
    const rawIntervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      rawIntervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const intervals = rawIntervals.filter(d => d >= MIN_CYCLE_DAYS);
    if (intervals.length > 0) {
      avgDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (intervals.length > 1) {
        const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgDays, 2), 0) / (intervals.length - 1);
        stdDev = Math.sqrt(variance);
      }
    }
    avgDays = Math.max(avgDays, MIN_CYCLE_DAYS);
  }
  return { avgDays, stdDev };
}

const INACTIVE_THRESHOLD_DAYS = 180;
const PRE_INACTIVE_THRESHOLD_DAYS = 150;

function calculateCycleStatus(daysSinceLastPurchase: number, avgDays: number) {
  if (daysSinceLastPurchase >= INACTIVE_THRESHOLD_DAYS) return "inativo" as const;
  if (daysSinceLastPurchase >= PRE_INACTIVE_THRESHOLD_DAYS) return "pre_inativacao" as const;
  if (daysSinceLastPurchase > avgDays) return "alerta" as const;
  if (daysSinceLastPurchase >= avgDays * 0.8) return "em_ciclo" as const;
  return "ativo" as const;
}

function businessDaysRemaining(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = now.getDate() + 1; d <= lastDay; d++) {
    const day = new Date(year, month, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

async function buildClientWithCycle(client: any, now: number, actionMap?: Map<string, any>) {
  const orderDates = await db.getClientOrderDates(client.clientCodeSAP, client.repCode);
  const { avgDays, stdDev } = calculateCycleFromOrders(orderDates);
  const lastPurchaseTs = new Date(client.lastPurchaseDate).getTime();
  const daysSinceLastPurchase = Math.floor((now - lastPurchaseTs) / (1000 * 60 * 60 * 24));
  const status = calculateCycleStatus(daysSinceLastPurchase, avgDays);
  const expectedNext = lastPurchaseTs + avgDays * 24 * 60 * 60 * 1000;
  const totalKg = Number(client.totalKg) || 0;
  const totalRevenue = Number(client.totalRevenue) || 0;
  const orderCount = Number(client.orderCount) || 1;
  const action = actionMap?.get(`${client.clientCodeSAP}-${client.repCode}`);
  return {
    clientCodeSAP: client.clientCodeSAP,
    clientName: client.clientName,
    clientCity: client.clientCity,
    clientState: client.clientState,
    clientPhone: client.clientPhone,
    clientDocument: client.clientDocument,
    salesChannel: client.salesChannel,
    salesChannelGroup: client.salesChannelGroup,
    repCode: client.repCode,
    repName: client.repName,
    lastPurchaseDate: lastPurchaseTs,
    avgDaysBetweenPurchases: Math.round(avgDays),
    stdDevDays: Math.round(stdDev),
    totalKg,
    avgKgPerOrder: Math.round(totalKg / orderCount),
    orderCount,
    avgPricePerKg: totalKg > 0 ? Math.round((totalRevenue / totalKg) * 100) / 100 : 0,
    status,
    daysSinceLastPurchase,
    expectedNextPurchase: expectedNext,
    manualStatus: action?.actionType || null,
    manualNote: action?.note || null,
    manualStatusDate: action?.createdAt ? new Date(action.createdAt).getTime() : null,
  };
}

// ── Router ─────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // User profile management
  profile: router({
    setRepCode: protectedProcedure
      .input(z.object({ repCode: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const d = await db.getDb();
        if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await d.update(users).set({ repCode: input.repCode }).where(eq(users.id, ctx.user.id));
        return { success: true };
      }),
    getRepOptions: protectedProcedure.query(async () => {
      const d = await db.getDb();
      if (!d) return [];
      const { sql } = await import("drizzle-orm");
      const rows = await d.execute(sql`SELECT repCode, alias, parentRepCode FROM rep_aliases ORDER BY alias`);
      const aliases = ((rows as any)[0] || []);
      if (aliases.length > 0) {
        return aliases.map((r: any) => ({
          repCode: r.repCode,
          alias: r.alias,
          repName: r.alias,
          parentRepCode: r.parentRepCode || null,
        }));
      }
      // Fallback: get reps from invoices when rep_aliases is empty
      const reps = await db.getDistinctRepCodesFromInvoices();
      return reps.map((r: any) => ({
        repCode: r.repCode,
        alias: r.repName,
        repName: r.repName,
        parentRepCode: null,
      }));
    }),
  }),

  // Upload & processing
  upload: router({
    process: protectedProcedure
      .input(z.object({
        fileBase64: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas gestores podem fazer upload" });
        }

        const logId = await db.createUploadLog({
          userId: ctx.user.id,
          fileName: input.fileName,
          status: "processing",
        });

        try {
          const buffer = Buffer.from(input.fileBase64, "base64");
          const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
          const sheetName = workbook.SheetNames.includes("dados") ? "dados" : workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

          if (rawData.length === 0) throw new Error("Planilha vazia");

          const headers = Object.keys(rawData[0]);
          const missingCols = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
          if (missingCols.length > 0) {
            throw new Error(`Colunas obrigatórias não encontradas: ${missingCols.join(", ")}`);
          }

          const invoiceRows = rawData.map(row => {
            const mapped: any = {};
            for (const [excelCol, dbCol] of Object.entries(COLUMN_MAP)) {
              let val = row[excelCol];
              if (val === undefined || val === null || val === "") {
                mapped[dbCol] = null;
              } else if (dbCol === "invoiceDate" || dbCol === "implantationDate" || dbCol === "priceFixDate") {
                mapped[dbCol] = val instanceof Date ? val : new Date(val);
              } else if (dbCol === "kgInvoiced" || dbCol === "revenueNoTax" || dbCol === "revenueWithTax") {
                mapped[dbCol] = String(Number(val) || 0);
              } else if (dbCol === "orderCode" || dbCol === "orderItem") {
                mapped[dbCol] = String(val);
              } else {
                mapped[dbCol] = String(val);
              }
            }
            mapped.uploadId = logId;
            return mapped;
          }).filter(r => r.orderCode && r.orderItem && r.invoiceDate && r.repName && r.clientName && r.productName);

          // Delete existing data for uploaded months to prevent duplicates
          const yearMonthsInUpload = Array.from(new Set(invoiceRows.map((r: any) => r.yearMonth).filter(Boolean)));
          let deletedRows = 0;
          if (yearMonthsInUpload.length > 0) {
            const d = await db.getDb();
            if (d) {
              const { sql: sqlHelper } = await import("drizzle-orm");
              for (const ym of yearMonthsInUpload) {
                const delResult = await d.execute(sqlHelper`DELETE FROM invoices WHERE yearMonth = ${ym}`);
                deletedRows += (delResult as any)[0]?.affectedRows ?? 0;
              }
            }
          }

          const { inserted, duplicates } = await db.bulkInsertInvoices(invoiceRows);

          // Auto-reset "Pedido na Tela" for clients that now have invoices
          let pedidoResetCount = 0;
          if (yearMonthsInUpload.length > 0) {
            pedidoResetCount = await db.resetPedidoNaTelaForInvoicedClients(yearMonthsInUpload as string[]);
            if (pedidoResetCount > 0) {
              console.log(`[Upload] Auto-reset ${pedidoResetCount} clients from 'Pedido na Tela' to normal`);
            }
          }

          await db.updateUploadLog(logId, {
            rowsProcessed: rawData.length,
            rowsInserted: inserted,
            rowsDuplicate: duplicates,
            status: "completed",
          });

          try {
            const ts = Date.now();
            await storagePut(`uploads/${ts}-${input.fileName}`, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          } catch (e) {
            console.warn("[Upload] S3 backup failed:", e);
          }

          // Invalidate repCode cache after upload
          _repCodeCache = null;

          return {
            success: true,
            rowsProcessed: rawData.length,
            rowsInserted: inserted,
            rowsDuplicate: duplicates,
            pedidoResetCount,
          };
        } catch (error: any) {
          await db.updateUploadLog(logId, {
            status: "error",
            errorMessage: error.message,
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message || "Erro ao processar arquivo",
          });
        }
      }),
    logs: adminProcedure.query(async () => {
      return db.getUploadLogs();
    }),
  }),

  // Client cycle data
  clients: router({
    list: protectedProcedure
      .input(z.object({ statusFilter: z.string().optional(), repCodeFilter: z.string().optional(), channelFilter: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        let repCode = await getUserRepCode(ctx.user);
        if (!repCode && input?.repCodeFilter) repCode = input.repCodeFilter;
        const purchaseHistory = await db.getClientPurchaseHistory(repCode, input?.channelFilter);
        const actions = await db.getAllClientActions(repCode);
        const actionMap = new Map<string, any>(actions.map((a: any) => [`${a.clientCodeSAP}-${a.repCode}`, a]));

        const now = Date.now();
        const clients = await Promise.all(purchaseHistory.map(async (client: any) => {
          return buildClientWithCycle(client, now, actionMap);
        }));

        if (input?.statusFilter && input.statusFilter !== "todos") {
          if (input.statusFilter === "em_acao" || input.statusFilter === "pedido_na_tela") {
            return clients.filter(c => c.manualStatus === input.statusFilter);
          }
          return clients.filter(c => c.status === input.statusFilter);
        }

        return clients;
      }),

    setAction: protectedProcedure
      .input(z.object({
        clientCodeSAP: z.string(),
        clientName: z.string().optional(),
        repCode: z.string(),
        actionType: z.enum(["em_acao", "pedido_na_tela", "excluido", "reset"]),
        note: z.string().optional(),
        previousStatus: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.insertClientAction({
          clientCodeSAP: input.clientCodeSAP,
          repCode: input.repCode,
          userId: ctx.user.id,
          actionType: input.actionType,
          note: input.note || null,
          previousStatus: input.previousStatus || null,
        });

        try {
          await db.notifyStatusChange({
            clientCodeSAP: input.clientCodeSAP,
            clientName: input.clientName || input.clientCodeSAP,
            repCode: input.repCode,
            actionType: input.actionType,
            previousStatus: input.previousStatus,
            note: input.note,
            actorUserId: ctx.user.id,
          });
        } catch (e) {
          console.warn("[Notification] Failed to send status change notification:", e);
        }

        return { success: true };
      }),

    actionHistory: protectedProcedure
      .input(z.object({ clientCodeSAP: z.string(), repCode: z.string() }))
      .query(async ({ input }) => {
        return db.getClientActionHistory(input.clientCodeSAP, input.repCode);
      }),

    lastOrders: protectedProcedure
      .input(z.object({ clientCodeSAP: z.string(), repCode: z.string(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getClientLastOrders(input.clientCodeSAP, input.repCode, input.limit ?? 3);
      }),

    productBreakdown: protectedProcedure
      .input(z.object({ clientCodeSAP: z.string(), repCode: z.string() }))
      .query(async ({ input }) => {
        return db.getClientProductBreakdown(input.clientCodeSAP, input.repCode);
      }),

    orderProductDetails: protectedProcedure
      .input(z.object({ orderCode: z.string(), clientCodeSAP: z.string(), repCode: z.string() }))
      .query(async ({ input }) => {
        return db.getOrderProductDetails(input.orderCode, input.clientCodeSAP, input.repCode);
      }),

    benchmarking: adminProcedure
      .input(z.object({ statusFilter: z.string().optional(), channelFilter: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const benchData = await db.getRepBenchmarking();
        const purchaseHistory = await db.getClientPurchaseHistory(undefined, input?.channelFilter);
        const allActions = await db.getAllClientActions();
        const actionMap = new Map<string, any>(allActions.map((a: any) => [`${a.clientCodeSAP}-${a.repCode}`, a]));
        const now = Date.now();

        const rcStatusCounts: Record<string, { ativo: number; em_ciclo: number; alerta: number; pre_inativacao: number; inativo: number; em_acao: number; pedido_na_tela: number; total: number }> = {};

        for (const client of purchaseHistory as any[]) {
          if (!rcStatusCounts[client.repCode]) {
            rcStatusCounts[client.repCode] = { ativo: 0, em_ciclo: 0, alerta: 0, pre_inativacao: 0, inativo: 0, em_acao: 0, pedido_na_tela: 0, total: 0 };
          }
          rcStatusCounts[client.repCode].total++;

          const action = actionMap.get(`${client.clientCodeSAP}-${client.repCode}`);
          if (action?.actionType === "em_acao") {
            rcStatusCounts[client.repCode].em_acao++;
          } else if (action?.actionType === "pedido_na_tela") {
            rcStatusCounts[client.repCode].pedido_na_tela++;
          }

          const orderDates = await db.getClientOrderDates(client.clientCodeSAP, client.repCode);
          const { avgDays } = calculateCycleFromOrders(orderDates);
          const daysSince = Math.floor((now - new Date(client.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24));
          const status = calculateCycleStatus(daysSince, avgDays);
          rcStatusCounts[client.repCode][status]++;
        }

        const enriched = (benchData as any[]).map((rc: any) => ({
          ...rc,
          statusCounts: rcStatusCounts[rc.repCode] || { ativo: 0, em_ciclo: 0, alerta: 0, pre_inativacao: 0, inativo: 0, em_acao: 0, pedido_na_tela: 0, total: 0 },
        }));

        const allAliases = await db.getRepAliases();
        const parentChildMap = new Map<string, string[]>();
        for (const a of allAliases) {
          if (a.parentRepCode) {
            if (!parentChildMap.has(a.parentRepCode)) parentChildMap.set(a.parentRepCode, []);
            parentChildMap.get(a.parentRepCode)!.push(a.repCode);
          }
        }

        for (const [parentCode, childCodes] of Array.from(parentChildMap.entries())) {
          const parentRow = enriched.find((r: any) => r.repCode === parentCode);
          if (!parentRow) continue;
          for (const childCode of childCodes) {
            const childRow = enriched.find((r: any) => r.repCode === childCode);
            if (!childRow) continue;
            const psc = parentRow.statusCounts;
            const csc = childRow.statusCounts;
            psc.ativo += csc.ativo; psc.em_ciclo += csc.em_ciclo; psc.alerta += csc.alerta;
            psc.pre_inativacao += csc.pre_inativacao; psc.inativo += csc.inativo;
            psc.em_acao += csc.em_acao; psc.pedido_na_tela += csc.pedido_na_tela; psc.total += csc.total;
            parentRow.totalClients = (Number(parentRow.totalClients) || 0) + (Number(childRow.totalClients) || 0);
            parentRow.totalKg = (Number(parentRow.totalKg) || 0) + (Number(childRow.totalKg) || 0);
            parentRow.totalRevenue = (Number(parentRow.totalRevenue) || 0) + (Number(childRow.totalRevenue) || 0);
          }
        }

        const childCodes = new Set<string>();
        for (const children of Array.from(parentChildMap.values())) {
          for (const c of children) childCodes.add(c);
        }
        return enriched.filter((r: any) => !childCodes.has(r.repCode));
      }),
  }),

  // Products
  products: router({
    list: protectedProcedure
      .input(z.object({
        product: z.string().optional(),
        channel: z.string().optional(),
        city: z.string().optional(),
        microRegion: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const repCode = await getUserRepCode(ctx.user);
        return db.getProductAnalysis(repCode, input);
      }),
    filters: protectedProcedure.query(async ({ ctx }) => {
      const repCode = await getUserRepCode(ctx.user);
      return db.getFilterOptions(repCode);
    }),
    clientsByProduct: protectedProcedure
      .input(z.object({ productName: z.string() }))
      .query(async ({ ctx, input }) => {
        const repCode = await getUserRepCode(ctx.user);
        return db.getClientsByProduct(input.productName, repCode);
      }),
  }),

  // Dashboard
  dashboard: router({
    metrics: protectedProcedure.query(async ({ ctx }) => {
      const repCode = await getUserRepCode(ctx.user);
      const [kg30d, kg60d, kg90d] = await Promise.all([
        db.getDashboardKgByPeriod(repCode, 30),
        db.getDashboardKgByPeriod(repCode, 60),
        db.getDashboardKgByPeriod(repCode, 90),
      ]);

      const purchaseHistory = await db.getClientPurchaseHistory(repCode);
      const now = Date.now();
      let activeClients = 0, cycleClients = 0, alertClients = 0, preInactiveClients = 0, inactiveClients = 0;

      for (const client of purchaseHistory as any[]) {
        const orderDates = await db.getClientOrderDates(client.clientCodeSAP, client.repCode);
        const { avgDays } = calculateCycleFromOrders(orderDates);
        const daysSince = Math.floor((now - new Date(client.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24));
        const status = calculateCycleStatus(daysSince, avgDays);
        if (status === "ativo") activeClients++;
        else if (status === "em_ciclo") cycleClients++;
        else if (status === "alerta") alertClients++;
        else if (status === "pre_inativacao") preInactiveClients++;
        else inactiveClients++;
      }

      const totalRevenue = (purchaseHistory as any[]).reduce((sum, c) => sum + Number(c.totalRevenue || 0), 0);
      const totalClients = purchaseHistory.length;

      return {
        kg30d, kg60d, kg90d,
        totalClients,
        activeClients,
        cycleClients,
        alertClients,
        preInactiveClients,
        inactiveClients,
        avgTicketPerClient: totalClients > 0 ? Math.round(totalRevenue / totalClients) : 0,
        businessDaysRemaining: businessDaysRemaining(),
      };
    }),
    monthlyEvolution: protectedProcedure.query(async ({ ctx }) => {
      const repCode = await getUserRepCode(ctx.user);
      return db.getMonthlyEvolution(repCode);
    }),
    topClients: protectedProcedure.query(async ({ ctx }) => {
      const repCode = await getUserRepCode(ctx.user);
      return db.getTopClientsByVolume(repCode);
    }),
    pricePerKg: protectedProcedure.query(async ({ ctx }) => {
      const repCode = await getUserRepCode(ctx.user);
      return db.getPricePerKgByProduct(repCode);
    }),
  }),

  // Manager view
  manager: router({
    repSummary: adminProcedure.query(async () => {
      return db.getRepSummary();
    }),
    repClients: adminProcedure
      .input(z.object({ repCode: z.string() }))
      .query(async ({ input }) => {
        const purchaseHistory = await db.getClientPurchaseHistory(input.repCode);
        const now = Date.now();
        let active = 0, cycle = 0, alert = 0, preInactive = 0, inactive = 0;
        for (const client of purchaseHistory as any[]) {
          const orderDates = await db.getClientOrderDates(client.clientCodeSAP, client.repCode);
          const { avgDays } = calculateCycleFromOrders(orderDates);
          const daysSince = Math.floor((now - new Date(client.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24));
          const status = calculateCycleStatus(daysSince, avgDays);
          if (status === "ativo") active++;
          else if (status === "em_ciclo") cycle++;
          else if (status === "alerta") alert++;
          else if (status === "pre_inativacao") preInactive++;
          else inactive++;
        }
        return { total: purchaseHistory.length, active, cycle, alert, preInactive, inactive };
      }),
    conversionReport: adminProcedure.query(async () => {
      const d = await db.getDb();
      if (!d) return [];
      const { sql } = await import("drizzle-orm");
      const result = await d.execute(sql`
        SELECT
          ca.repCode,
          COUNT(CASE WHEN ca.actionType = 'em_acao' THEN 1 END) as totalEmAcao,
          COUNT(CASE WHEN ca.actionType = 'pedido_na_tela' THEN 1 END) as totalPedidoNaTela,
          AVG(CASE WHEN ca.actionType = 'pedido_na_tela' THEN TIMESTAMPDIFF(DAY, prev.createdAt, ca.createdAt) END) as avgResolutionDays
        FROM client_actions ca
        LEFT JOIN client_actions prev ON ca.clientCodeSAP = prev.clientCodeSAP AND ca.repCode = prev.repCode
          AND prev.actionType = 'em_acao' AND prev.createdAt < ca.createdAt
        GROUP BY ca.repCode
      `);
      return (result as any)[0] || [];
    }),
    annotations: adminProcedure
      .input(z.object({ repCode: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAnnotationsExport(input?.repCode);
      }),
  }),

  // Notifications
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserNotifications(ctx.user.id);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return db.getUnreadNotificationCount(ctx.user.id);
    }),
    markRead: protectedProcedure
      .input(z.object({ ids: z.array(z.number()).optional() }).optional())
      .mutation(async ({ ctx, input }) => {
        await db.markNotificationsRead(ctx.user.id, input?.ids);
        return { success: true };
      }),
  }),

  // Rep Aliases
  repAliases: router({
    list: protectedProcedure.query(async () => {
      return db.getRepAliases();
    }),
    upsert: adminProcedure
      .input(z.object({
        repCode: z.string(),
        repName: z.string(),
        alias: z.string(),
        parentRepCode: z.string().optional(),
        neCode: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertRepAlias(input);
        _repCodeCache = null;
        return { success: true };
      }),
  }),

  // Sales Goals
  goals: router({
    list: protectedProcedure
      .input(z.object({ yearMonth: z.string() }))
      .query(async ({ input }) => {
        return db.getSalesGoals(input.yearMonth);
      }),
    upsert: adminProcedure
      .input(z.object({
        repCode: z.string(),
        yearMonth: z.string(),
        goalKg: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertSalesGoal(input.repCode, input.yearMonth, String(input.goalKg));
        return { success: true };
      }),
    progress: protectedProcedure
      .input(z.object({ yearMonth: z.string() }))
      .query(async ({ input }) => {
        const [goals, billed, aliases] = await Promise.all([
          db.getSalesGoals(input.yearMonth),
          db.getMonthlyBilledByRep(input.yearMonth),
          db.getRepAliases(),
        ]);

        const goalMap = new Map(goals.map(g => [g.repCode, Number(g.goalKg)]));
        const billedMap = new Map((billed as any[]).map(b => [b.repCode, b]));
        const aliasMap = new Map(aliases.map(a => [a.repCode, a]));

        const progress: any[] = [];
        const allRepCodes = Array.from(new Set([...Array.from(goalMap.keys()), ...(billed as any[]).map(b => b.repCode)]));

        for (const repCode of allRepCodes) {
          const alias = aliasMap.get(repCode);
          const goal = goalMap.get(repCode) || 0;
          const billedData = billedMap.get(repCode) as any;
          const billedKg = billedData ? Number(billedData.billedKg) : 0;
          const billedRevenue = billedData ? Number(billedData.billedRevenue) : 0;
          const orderCount = billedData ? Number(billedData.orderCount) : 0;
          const clientCount = billedData ? Number(billedData.clientCount) : 0;
          const gap = goal - billedKg;
          const progressPct = goal > 0 ? Math.round((billedKg / goal) * 100) : 0;
          const bDays = businessDaysRemaining();
          const kgPerDayNeeded = bDays > 0 && gap > 0 ? Math.round(gap / bDays) : 0;

          progress.push({
            repCode,
            repAlias: alias?.alias || billedData?.repAlias || repCode,
            parentRepCode: alias?.parentRepCode || billedData?.parentRepCode || null,
            neCode: alias?.neCode || null,
            goalKg: goal,
            billedKg,
            billedRevenue,
            gap,
            progressPct,
            kgPerDayNeeded,
            businessDaysRemaining: bDays,
            orderCount,
            clientCount,
          });
        }

        progress.sort((a, b) => b.progressPct - a.progressPct);
        return progress;
      }),
  }),

  // Export
  export: router({
    invoices: protectedProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        clientCodeSAP: z.string().optional(),
        productName: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const repCode = await getUserRepCode(ctx.user);
        return db.getInvoicesForExport({ repCode, ...input });
      }),
  }),

  // Sales History
  history: router({
    availableMonths: protectedProcedure.query(async () => {
      return db.getAvailableMonths();
    }),
    monthly: protectedProcedure
      .input(z.object({ months: z.number().optional(), repCodeFilter: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        let repCode = await getUserRepCode(ctx.user);
        if (!repCode && input?.repCodeFilter) repCode = input.repCodeFilter;
        return db.getSalesHistory(repCode, input?.months || 12);
      }),
    topClients: protectedProcedure
      .input(z.object({
        yearMonth: z.string(),
        channelFilter: z.string().optional(),
        repCodeFilter: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        let repCode = await getUserRepCode(ctx.user);
        if (!repCode && input?.repCodeFilter) repCode = input.repCodeFilter;
        return db.getTopClientsForMonth(input.yearMonth, repCode, input.channelFilter);
      }),
    clientProducts: protectedProcedure
      .input(z.object({
        yearMonth: z.string(),
        clientCodeSAP: z.string(),
        repCodeFilter: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        let repCode = await getUserRepCode(ctx.user);
        if (!repCode && input?.repCodeFilter) repCode = input.repCodeFilter;
        return db.getClientProductsForMonth(input.yearMonth, input.clientCodeSAP, repCode);
      }),
    topProducts: protectedProcedure
      .input(z.object({
        yearMonth: z.string(),
        repCodeFilter: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        let repCode = await getUserRepCode(ctx.user);
        if (!repCode && input?.repCodeFilter) repCode = input.repCodeFilter;
        return db.getTopProductsForMonth(input.yearMonth, repCode);
      }),
    productClients: protectedProcedure
      .input(z.object({
        yearMonth: z.string(),
        productName: z.string(),
        repCodeFilter: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        let repCode = await getUserRepCode(ctx.user);
        if (!repCode && input?.repCodeFilter) repCode = input.repCodeFilter;
        return db.getProductClientsForMonth(input.yearMonth, input.productName, repCode);
      }),
    rcRanking: adminProcedure
      .input(z.object({ yearMonth: z.string() }))
      .query(async ({ input }) => {
        return db.getRcRankingForMonth(input.yearMonth);
      }),
  }),

  // Programa Aceleração
  aceleracao: router({
    summary: protectedProcedure
      .input(z.object({
        repCodeFilter: z.string().optional(),
        startYm: z.string().optional(),
        endYm: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        let repCode = await getUserRepCode(ctx.user);
        if (!repCode && input?.repCodeFilter) repCode = input.repCodeFilter;
        return db.getAceleracaoData(repCode, input?.startYm, input?.endYm);
      }),
    monthly: protectedProcedure
      .input(z.object({
        groupCode: z.string(),
        repCodeFilter: z.string().optional(),
        startYm: z.string().optional(),
        endYm: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        let repCode = await getUserRepCode(ctx.user);
        if (!repCode && input?.repCodeFilter) repCode = input.repCodeFilter;
        return db.getAceleracaoMonthly(input.groupCode, repCode, input.startYm, input.endYm);
      }),
    list: protectedProcedure.query(async () => {
      return [
        { id: "2025-2026", label: "2025/2026", startYm: "2025.03", endYm: "2026.02", startLabel: "Mar/2025", endLabel: "Fev/2026" },
        { id: "2026-2027", label: "2026/2027", startYm: "2026.03", endYm: "2027.02", startLabel: "Mar/2026", endLabel: "Fev/2027" },
      ];
    }),
  }),

  // Invite & User Management
  invites: router({
    availableReps: adminProcedure.query(async () => {
      // Busca RCs diretamente dos dados de faturamento (invoices)
      return db.getDistinctRepCodesFromInvoices();
    }),
    create: adminProcedure
      .input(z.object({ repCode: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const { token } = await db.createRcInvite(input.repCode);
        return { token };
      }),
    list: adminProcedure.query(async () => {
      return db.listInvites();
    }),
    delete: adminProcedure
      .input(z.object({ inviteId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteInvite(input.inviteId);
        return { success: true };
      }),
    accept: protectedProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.acceptInvite(input.token, ctx.user.id);
        if (!result) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Convite inválido ou já utilizado" });
        }
        return { success: true, repCode: result.repCode };
      }),
    getByToken: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .query(async ({ input }) => {
        const invite = await db.getInviteByToken(input.token);
        if (!invite) return null;
        if (invite.repCode === '__GESTOR__') {
          return { repCode: '__GESTOR__', alias: 'Gestor (visão completa)', used: !!invite.usedAt, isGestor: true };
        }
        const d = await db.getDb();
        if (!d) return null;
        const { repAliases } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const aliases = await d.select().from(repAliases).where(eq(repAliases.repCode, invite.repCode)).limit(1);
        return { repCode: invite.repCode, alias: aliases[0]?.alias || invite.repCode, used: !!invite.usedAt, isGestor: false };
      }),
  }),

  // User Management
  users: router({
    list: adminProcedure.query(async () => {
      const userList = await db.listAllUsers();
      const d = await db.getDb();
      if (!d) return userList.map(u => ({ ...u, repAlias: null }));
      const { repAliases } = await import("../drizzle/schema");
      const aliases = await d.select().from(repAliases);
      const aliasMap = new Map(aliases.map(a => [a.repCode, a.alias]));
      return userList.map(u => ({
        ...u,
        repAlias: u.repCode ? aliasMap.get(u.repCode) || null : null,
      }));
    }),
    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["admin", "user"]) }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),
    updateRepCode: adminProcedure
      .input(z.object({ userId: z.number(), repCode: z.string().nullable() }))
      .mutation(async ({ input }) => {
        await db.updateUserRepCode(input.userId, input.repCode);
        return { success: true };
      }),
    unlinkRep: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateUserRepCode(input.userId, null);
        return { success: true };
      }),
  }),

  // Page View Tracking
  activity: router({
    track: protectedProcedure
      .input(z.object({ page: z.string().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        await db.recordPageView(ctx.user.id, input.page);
        return { success: true };
      }),
    summary: adminProcedure.query(async () => {
      return db.getUserActivitySummary();
    }),
    userPages: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserPageBreakdown(input.userId);
      }),
    userRecent: adminProcedure
      .input(z.object({ userId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getUserRecentActivity(input.userId, input.limit || 20);
      }),
    userDaily: adminProcedure
      .input(z.object({ userId: z.number(), days: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getUserDailyActivity(input.userId, input.days || 30);
      }),
  }),
});

export type AppRouter = typeof appRouter;
