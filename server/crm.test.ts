import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    repCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createRcContext(repCode: string = "RC001"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "rc-user",
    email: "rc@example.com",
    name: "RC User",
    loginMethod: "manus",
    role: "user",
    repCode,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// Mock the db module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getRepAliases: vi.fn().mockResolvedValue([]),
  getDashboardKgByPeriod: vi.fn().mockResolvedValue({ totalKg: "1000.00", totalRevenue: "5000.00", clientCount: 10 }),
  getMonthlyEvolution: vi.fn().mockResolvedValue([
    { yearMonth: "2025.01", totalKg: "1000.00", totalRevenue: "5000.00" },
    { yearMonth: "2025.02", totalKg: "1200.00", totalRevenue: "6000.00" },
  ]),
  getClientPurchaseHistory: vi.fn().mockResolvedValue([
    { clientCodeSAP: "SAP001", clientName: "Client A", repCode: "RC001", repName: "Rep 1", lastPurchaseDate: new Date(), purchaseCount: 5, avgCycleDays: 30, clientCity: "SP", clientState: "SP", clientChannel: "Revenda", clientMicroRegion: "Centro" },
  ]),
  getAllClientActions: vi.fn().mockResolvedValue([]),
  getAvailableMonths: vi.fn().mockResolvedValue(["2025.02", "2025.01"]),
  getSalesHistory: vi.fn().mockResolvedValue([
    { yearMonth: "2025.01", totalKg: "1000.00", totalRevenue: "5000.00" },
  ]),
  getTopClientsForMonth: vi.fn().mockResolvedValue([
    { clientName: "Client A", clientCodeSAP: "SAP001", totalKg: "500.00", totalRevenue: "2500.00", clientCity: "SP", clientState: "SP", repName: "Rep 1" },
  ]),
  getTopProductsForMonth: vi.fn().mockResolvedValue([
    { productName: "Product A", totalKg: "300.00", totalRevenue: "1500.00", clientCount: 5 },
  ]),
  getProductClientsForMonth: vi.fn().mockResolvedValue([]),
  getRcRankingForMonth: vi.fn().mockResolvedValue([
    { repCode: "RC001", repName: "Rep 1", totalKg: "1000.00", clientCount: 10 },
  ]),
  getAceleracaoData: vi.fn().mockResolvedValue([
    { clientGroupCodeSAP: "GRP001", clientParentName: "Group A", totalKg: "5000.00", totalRevenue: "25000.00", repName: "Rep 1" },
  ]),
  getAceleracaoMonthly: vi.fn().mockResolvedValue([]),
  getProductAnalysis: vi.fn().mockResolvedValue([
    { productName: "Product A", totalKg: "300.00", totalRevenue: "1500.00", clientCount: 5 },
  ]),
  getProductFilters: vi.fn().mockResolvedValue({ channels: ["Revenda"], cities: ["SP"], microRegions: ["Centro"] }),
  getClientsByProduct: vi.fn().mockResolvedValue([]),
  getUserNotifications: vi.fn().mockResolvedValue([]),
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  markNotificationsRead: vi.fn().mockResolvedValue(undefined),
  getRepSummary: vi.fn().mockResolvedValue([
    { repCode: "RC001", repName: "Rep 1" },
  ]),
  listAllUsers: vi.fn().mockResolvedValue([]),
  getSalesGoals: vi.fn().mockResolvedValue([]),
  getAnnotationsExport: vi.fn().mockResolvedValue([]),
  getUserActivitySummary: vi.fn().mockResolvedValue([]),
  getUserPageBreakdown: vi.fn().mockResolvedValue([]),
  recordPageView: vi.fn().mockResolvedValue(undefined),
  getInviteByToken: vi.fn().mockResolvedValue(null),
  listInvites: vi.fn().mockResolvedValue([]),
  createRcInvite: vi.fn().mockResolvedValue({ id: 1, token: "abc123", repCode: "RC001" }),
  deleteInvite: vi.fn().mockResolvedValue(undefined),
  acceptInvite: vi.fn().mockResolvedValue({ success: true }),
  getClientOrderDates: vi.fn().mockResolvedValue([]),
  getClientLastOrders: vi.fn().mockResolvedValue([]),
  getClientOrderProducts: vi.fn().mockResolvedValue([]),
  getClientActionHistory: vi.fn().mockResolvedValue([]),
  insertClientAction: vi.fn().mockResolvedValue(undefined),
  getClientProductsForMonth: vi.fn().mockResolvedValue([]),
  updateUserRole: vi.fn().mockResolvedValue(undefined),
  updateUserRepCode: vi.fn().mockResolvedValue(undefined),
  unlinkUserRep: vi.fn().mockResolvedValue(undefined),
  upsertRepAlias: vi.fn().mockResolvedValue(undefined),
  upsertSalesGoal: vi.fn().mockResolvedValue(undefined),
  getMonthlyBilledByRep: vi.fn().mockResolvedValue([]),
  createUploadLog: vi.fn().mockResolvedValue(1),
  updateUploadLog: vi.fn().mockResolvedValue(undefined),
  getUploadLogs: vi.fn().mockResolvedValue([]),
  bulkInsertInvoices: vi.fn().mockResolvedValue({ inserted: 10, duplicates: 0 }),
  deleteInvoicesByYearMonths: vi.fn().mockResolvedValue(undefined),
  getRepBenchmarking: vi.fn().mockResolvedValue([]),
  getClientProductBreakdown: vi.fn().mockResolvedValue([]),
  getOrderProductDetails: vi.fn().mockResolvedValue([]),
  notifyStatusChange: vi.fn().mockResolvedValue(undefined),
  getAdminUserIds: vi.fn().mockResolvedValue([1]),
  getRepClientsForManager: vi.fn().mockResolvedValue([]),
  getTopClients: vi.fn().mockResolvedValue([]),
  getPricePerKgByProduct: vi.fn().mockResolvedValue([]),
  getPageViewsByUser: vi.fn().mockResolvedValue([]),
  getRecentPageViews: vi.fn().mockResolvedValue([]),
  getDailyPageViews: vi.fn().mockResolvedValue([]),
}));

describe("auth.me", () => {
  it("returns user for authenticated context", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeTruthy();
    expect(result?.name).toBe("Admin User");
    expect(result?.role).toBe("admin");
  });

  it("returns null for unauthenticated context", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("dashboard.metrics", () => {
  it("returns KG metrics for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.metrics();
    expect(result).toHaveProperty("kg30d");
    expect(result).toHaveProperty("kg60d");
    expect(result).toHaveProperty("kg90d");
    expect(result).toHaveProperty("totalClients");
    expect(result).toHaveProperty("businessDaysRemaining");
  });

  it("returns KG metrics for RC user", async () => {
    const ctx = createRcContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.metrics();
    expect(result).toHaveProperty("kg30d");
  });

  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.metrics()).rejects.toThrow();
  });
});

describe("dashboard.monthlyEvolution", () => {
  it("returns monthly evolution data", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.monthlyEvolution();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("yearMonth");
    expect(result[0]).toHaveProperty("totalKg");
  });
});

describe("clients.list", () => {
  it("returns client list for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns client list for RC", async () => {
    const ctx = createRcContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("clients.setAction", () => {
  it("allows setting action on a client", async () => {
    const ctx = createRcContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.setAction({
      clientCodeSAP: "SAP001",
      repCode: "RC001",
      actionType: "em_acao",
      note: "Visita agendada",
    });
    expect(result).toEqual({ success: true });
  });

  it("supports pedido_na_tela action", async () => {
    const ctx = createRcContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.setAction({
      clientCodeSAP: "SAP001",
      repCode: "RC001",
      actionType: "pedido_na_tela",
      note: "Pedido confirmado",
    });
    expect(result).toEqual({ success: true });
  });

  it("supports reset action", async () => {
    const ctx = createRcContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.setAction({
      clientCodeSAP: "SAP001",
      repCode: "RC001",
      actionType: "reset",
      previousStatus: "em_acao",
    });
    expect(result).toEqual({ success: true });
  });
});

describe("history", () => {
  it("returns available months", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.history.months();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain("2025.02");
  });

  it("returns sales history", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.history.sales();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("totalKg");
  });

  it("returns top clients for a month", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.history.topClients({ yearMonth: "2025.02" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns top products for a month", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.history.topProducts({ yearMonth: "2025.02" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns RC ranking for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.history.rcRanking({ yearMonth: "2025.02" });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("repCode");
  });

  it("rejects RC ranking for non-admin", async () => {
    const ctx = createRcContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.history.rcRanking({ yearMonth: "2025.02" })).rejects.toThrow();
  });
});

describe("aceleracao", () => {
  it("returns aceleracao summary", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.aceleracao.summary();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("clientGroupCodeSAP");
    expect(result[0]).toHaveProperty("totalKg");
  });
});

describe("products", () => {
  it("returns product list", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.products.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("productName");
    expect(result[0]).toHaveProperty("totalKg");
  });

  it("returns product filters", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.products.filters();
    expect(result).toHaveProperty("channels");
    expect(result).toHaveProperty("cities");
    expect(result).toHaveProperty("microRegions");
  });
});

describe("invites", () => {
  it("creates invite as admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.invites.create({ repCode: "RC001" });
    expect(result).toHaveProperty("token");
  });

  it("lists invites as admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.invites.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects invite creation for non-admin", async () => {
    const ctx = createRcContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.invites.create({ repCode: "RC001" })).rejects.toThrow();
  });

  it("returns invite by token (not found)", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.invites.getByToken({ token: "nonexistent" });
    expect(result).toBeNull();
  });
});

describe("notifications", () => {
  it("returns notifications for authenticated user", async () => {
    const ctx = createRcContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns unread count", async () => {
    const ctx = createRcContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.unreadCount();
    expect(typeof result).toBe("number");
  });

  it("marks notifications as read", async () => {
    const ctx = createRcContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.markRead();
    expect(result).toEqual({ success: true });
  });
});

describe("repAliases", () => {
  it("lists rep aliases", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.repAliases.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("users", () => {
  it("lists users as admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects user listing for non-admin", async () => {
    const ctx = createRcContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).rejects.toThrow();
  });

  it("updates user role as admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.updateRole({ userId: 2, role: "admin" });
    expect(result).toEqual({ success: true });
  });
});

describe("admin", () => {
  it("lists rep aliases", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.repAliases();
    expect(Array.isArray(result)).toBe(true);
  });

  it("lists sales goals", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.salesGoals({ yearMonth: "2025.02" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns user activity summary", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.userActivity();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("activity", () => {
  it("tracks page view", async () => {
    const ctx = createRcContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.activity.track({ page: "/dashboard" });
    expect(result).toEqual({ success: true });
  });
});

describe("upload", () => {
  it("rejects upload from non-admin", async () => {
    const ctx = createRcContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.upload.process({ fileName: "test.csv", fileBase64: "" })
    ).rejects.toThrow();
  });
});
