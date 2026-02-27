import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Test helpers ──────────────────────────────────────────────────────
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

function createRcContext(repCode: string): TrpcContext {
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

// ── Tests ─────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user data for authenticated user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Admin User");
    expect(result?.role).toBe("admin");
  });
});

describe("upload.process - access control", () => {
  it("rejects non-admin users", async () => {
    const ctx = createRcContext("RC001");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.upload.process({
        fileBase64: "dGVzdA==",
        fileName: "test.csv",
      })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.upload.process({
        fileBase64: "dGVzdA==",
        fileName: "test.csv",
      })
    ).rejects.toThrow();
  });
});

describe("manager.repSummary - access control", () => {
  it("rejects non-admin users", async () => {
    const ctx = createRcContext("RC001");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.manager.repSummary()).rejects.toThrow();
  });
});

describe("invites.getByToken", () => {
  it("returns null for invalid token", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.invites.getByToken({ token: "nonexistent-token" });
    expect(result).toBeNull();
  });
});

describe("invites.accept - access control", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.invites.accept({ token: "some-token" })
    ).rejects.toThrow();
  });
});

describe("dashboard.rcRanking - access control", () => {
  it("rejects non-admin users", async () => {
    const ctx = createRcContext("RC001");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.dashboard.rcRanking()).rejects.toThrow();
  });
});

describe("history.rcRanking - access control", () => {
  it("rejects non-admin users", async () => {
    const ctx = createRcContext("RC001");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.history.rcRanking()).rejects.toThrow();
  });
});

// ── Helper function tests ─────────────────────────────────────────────
describe("calculateCycleStatus logic", () => {
  it("should classify correctly based on days since last purchase", () => {
    function calculateCycleStatus(daysSinceLastPurchase: number, avgCycleDays: number) {
      if (daysSinceLastPurchase >= 180) return "inativo";
      if (daysSinceLastPurchase >= 150) return "pre_inativacao";
      if (avgCycleDays > 0 && daysSinceLastPurchase >= avgCycleDays) return "alerta";
      if (avgCycleDays > 0 && daysSinceLastPurchase >= avgCycleDays * 0.8) return "em_ciclo";
      return "ativo";
    }

    expect(calculateCycleStatus(10, 30)).toBe("ativo");
    expect(calculateCycleStatus(25, 30)).toBe("em_ciclo");
    expect(calculateCycleStatus(35, 30)).toBe("alerta");
    expect(calculateCycleStatus(155, 30)).toBe("pre_inativacao");
    expect(calculateCycleStatus(200, 30)).toBe("inativo");
    
    // Without cycle data
    expect(calculateCycleStatus(10, 0)).toBe("ativo");
    expect(calculateCycleStatus(100, 0)).toBe("ativo");
    expect(calculateCycleStatus(155, 0)).toBe("pre_inativacao");
    expect(calculateCycleStatus(200, 0)).toBe("inativo");
  });
});

describe("parseDate logic", () => {
  it("should parse Brazilian date format", () => {
    function parseDate(value: string): Date | null {
      if (!value) return null;
      const brMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (brMatch) {
        return new Date(parseInt(brMatch[3]), parseInt(brMatch[2]) - 1, parseInt(brMatch[1]));
      }
      const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (isoMatch) {
        return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
      }
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }

    const br = parseDate("15/03/2025");
    expect(br).not.toBeNull();
    expect(br!.getDate()).toBe(15);
    expect(br!.getMonth()).toBe(2); // March = 2
    expect(br!.getFullYear()).toBe(2025);

    const iso = parseDate("2025-03-15");
    expect(iso).not.toBeNull();
    expect(iso!.getDate()).toBe(15);

    expect(parseDate("")).toBeNull();
    expect(parseDate("invalid")).toBeNull();
  });
});

describe("parseKg logic", () => {
  it("should parse Brazilian number format", () => {
    function parseKg(value: string): number {
      if (!value || value.trim() === "" || value === "-") return 0;
      return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
    }

    expect(parseKg("1.234,56")).toBe(1234.56);
    expect(parseKg("100")).toBe(100);
    expect(parseKg("1.000")).toBe(1000);
    expect(parseKg("")).toBe(0);
    expect(parseKg("-")).toBe(0);
    expect(parseKg("abc")).toBe(0);
  });
});

describe("formatYearMonth logic", () => {
  it("should format date as YYYY.MM", () => {
    function formatYearMonth(date: Date): string {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      return `${y}.${m}`;
    }

    expect(formatYearMonth(new Date(2025, 0, 15))).toBe("2025.01");
    expect(formatYearMonth(new Date(2025, 11, 1))).toBe("2025.12");
    expect(formatYearMonth(new Date(2024, 5, 30))).toBe("2024.06");
  });
});
