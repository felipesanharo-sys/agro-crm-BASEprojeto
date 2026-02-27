import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Trophy, Search, Zap, Award, Star, Shield, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const fmtKg = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));
const fmtTon = (n: number) => (n / 1000).toFixed(1);

// Category definitions (in KG) — thresholds in tons converted to kg
// Master: 600t+, Esp. Plus: 300-599t, Especial: 60-299t, Essencial: 0-59t
const CATEGORIES = [
  { name: "Master", shortName: "Master", min: 600000, max: Infinity, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30", icon: Trophy, desconto: "13%", sellOut: "1,5%", rank: 4 },
  { name: "Especial Plus", shortName: "Esp. Plus", min: 300000, max: 599999, color: "text-cyan-500", bg: "bg-cyan-500/10 border-cyan-500/30", icon: Star, desconto: "12%", sellOut: "1,5%", rank: 3 },
  { name: "Especial", shortName: "Especial", min: 60000, max: 299999, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/30", icon: Award, desconto: "12%", sellOut: "1,0%", rank: 2 },
  { name: "Essencial", shortName: "Essencial", min: 0, max: 59999, color: "text-slate-500", bg: "bg-slate-500/10 border-slate-500/30", icon: Shield, desconto: "10%", sellOut: "Ações nacionais", rank: 1 },
];

function getCategoryByVolume(kg: number) {
  return CATEGORIES.find(c => kg >= c.min && kg <= c.max) || CATEGORIES[3];
}

function getCategoryByName(name: string | null | undefined) {
  if (!name) return CATEGORIES[3]; // default Essencial
  const n = name.toLowerCase().trim();
  if (n.includes("master")) return CATEGORIES[0];
  if (n.includes("especial plus") || n.includes("esp. plus")) return CATEGORIES[1];
  if (n.includes("especial")) return CATEGORIES[2];
  return CATEGORIES[3]; // Essencial
}

function getNextCategoryUp(cat: typeof CATEGORIES[0]) {
  const idx = CATEGORIES.indexOf(cat);
  if (idx <= 0) return null; // already Master
  return CATEGORIES[idx - 1];
}

// Cycle definitions
const CYCLES = [
  { id: "2025-2026", label: "2025/2026", startYm: "2025.03", endYm: "2026.02", startLabel: "Mar/2025", endLabel: "Fev/2026", year: 2026 },
  { id: "2026-2027", label: "2026/2027", startYm: "2026.03", endYm: "2027.02", startLabel: "Mar/2026", endLabel: "Fev/2027", year: 2027 },
];

function getMonthsForCycle(startYm: string, endYm: string): string[] {
  const months: string[] = [];
  const [sy, sm] = startYm.split(".").map(Number);
  const [ey, em] = endYm.split(".").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}.${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

const SHORT_MONTH_NAMES: Record<number, string> = {
  1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr", 5: "Mai", 6: "Jun",
  7: "Jul", 8: "Ago", 9: "Set", 10: "Out", 11: "Nov", 12: "Dez",
};

function getMonthLabel(ym: string): string {
  const m = parseInt(ym.split(".")[1], 10);
  return SHORT_MONTH_NAMES[m] || ym;
}

interface AceleracaoTabProps {
  repCodeFilter?: string;
}

function MonthlyBreakdown({ groupCode, repCodeFilter, totalKg, currentCat, newCat, startYm, endYm }: {
  groupCode: string; repCodeFilter?: string; totalKg: number;
  currentCat: typeof CATEGORIES[0]; newCat: typeof CATEGORIES[0];
  startYm: string; endYm: string;
}) {
  const { data: monthly } = trpc.aceleracao.monthly.useQuery({ groupCode, repCodeFilter, startYm, endYm });

  const programMonths = useMemo(() => getMonthsForCycle(startYm, endYm), [startYm, endYm]);
  const monthCount = programMonths.length;

  const chartData = useMemo(() => {
    if (!monthly) return [];
    const monthMap = new Map((monthly as any[]).map(m => [m.yearMonth, Number(m.kg) || 0]));
    return programMonths.map(ym => ({
      month: getMonthLabel(ym),
      kg: monthMap.get(ym) || 0,
    }));
  }, [monthly, programMonths]);

  const nextUp = getNextCategoryUp(currentCat);
  const gapToNextUp = nextUp ? Math.max(0, nextUp.min - totalKg) : 0;

  return (
    <div className="p-3 bg-muted/30 border-t">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Volume Mensal ({getMonthLabel(startYm)}/{startYm.split(".")[0]} - {getMonthLabel(endYm)}/{endYm.split(".")[0]})</p>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}t`} />
                <Tooltip
                  formatter={(value: number) => [`${fmtKg(value)} kg`, "Volume"]}
                  labelFormatter={(label: string) => `Mês: ${label}`}
                />
                <Bar dataKey="kg" radius={[3, 3, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill="hsl(var(--primary) / 0.7)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Resumo do Programa</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border p-2.5 bg-background">
              <p className="text-[10px] text-muted-foreground">Acumulado ({monthCount} meses)</p>
              <p className="text-sm font-bold">{fmtKg(totalKg)} kg</p>
              <p className="text-[10px] text-muted-foreground">{fmtTon(totalKg)} toneladas</p>
            </div>
            <div className="rounded-lg border p-2.5 bg-background">
              <p className="text-[10px] text-muted-foreground">Média Mensal</p>
              <p className="text-sm font-bold">{fmtKg(totalKg / monthCount)} kg</p>
              <p className="text-[10px] text-muted-foreground">{fmtTon(totalKg / monthCount)} ton/mês</p>
            </div>
            <div className="rounded-lg border p-2.5 bg-background">
              <p className="text-[10px] text-muted-foreground">Categoria Atual</p>
              <p className={`text-sm font-bold ${currentCat.color}`}>{currentCat.shortName}</p>
            </div>
            <div className={`rounded-lg border p-2.5 ${newCat.rank > currentCat.rank ? "bg-emerald-500/10 border-emerald-500/30" : newCat.rank < currentCat.rank ? "bg-red-500/10 border-red-500/30" : "bg-background"}`}>
              <p className="text-[10px] text-muted-foreground">Nova Categoria (Mar)</p>
              <p className={`text-sm font-bold ${newCat.rank > currentCat.rank ? "text-emerald-600" : newCat.rank < currentCat.rank ? "text-red-600" : newCat.color}`}>{newCat.shortName}</p>
            </div>
            {gapToNextUp > 0 && (
              <div className={`rounded-lg border p-2.5 col-span-2 ${nextUp!.bg}`}>
                <p className="text-[10px] text-muted-foreground">Falta p/ {nextUp!.shortName}</p>
                <p className={`text-sm font-bold ${nextUp!.color}`}>{fmtKg(gapToNextUp)} kg ({fmtTon(gapToNextUp)} ton)</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AceleracaoTab({ repCodeFilter }: AceleracaoTabProps) {
  const [cycleId, setCycleId] = useState("2025-2026");
  const cycle = CYCLES.find(c => c.id === cycleId) || CYCLES[0];

  const { data: rawData, isLoading } = trpc.aceleracao.summary.useQuery({
    repCodeFilter,
    startYm: cycle.startYm,
    endYm: cycle.endYm,
  });
  const [search, setSearch] = useState("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [changeFilter, setChangeFilter] = useState<string>("all"); // all, up, down, same

  const rows = (rawData as any)?.rows || rawData || [];
  const lastInvoiceDate = (rawData as any)?.lastInvoiceDate || null;

  const lastDateFormatted = useMemo(() => {
    if (!lastInvoiceDate) return null;
    const d = new Date(lastInvoiceDate);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }, [lastInvoiceDate]);

  const programMonths = useMemo(() => getMonthsForCycle(cycle.startYm, cycle.endYm), [cycle]);

  const data = useMemo(() => {
    if (!rows || !Array.isArray(rows)) return [];
    return (rows as any[]).map(r => {
      const totalKg = Number(r.totalKg) || 0;
      // Current category from salesChannel in DB
      const currentCat = getCategoryByName(r.currentCategory);
      // New category determined by accumulated volume in the cycle
      const newCat = getCategoryByVolume(totalKg);
      // Next category up from current
      const nextUp = getNextCategoryUp(currentCat);
      const gapToNextUp = nextUp ? Math.max(0, nextUp.min - totalKg) : 0;

      // Change direction
      let change: "up" | "down" | "same" = "same";
      if (newCat.rank > currentCat.rank) change = "up";
      else if (newCat.rank < currentCat.rank) change = "down";

      // Progress towards next category up from current
      const progressPct = nextUp
        ? Math.min(100, Math.max(0, ((totalKg - currentCat.min) / (nextUp.min - currentCat.min)) * 100))
        : 100;

      return {
        ...r,
        totalKg,
        currentCat,
        newCat,
        nextUp,
        gapToNextUp,
        change,
        progressPct,
      };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    let result = data;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r =>
        r.clientName?.toLowerCase().includes(s) ||
        r.groupCode?.toLowerCase().includes(s) ||
        r.city?.toLowerCase().includes(s)
      );
    }
    if (categoryFilter !== "all") {
      result = result.filter(r => r.currentCat.name === categoryFilter);
    }
    if (changeFilter === "up") result = result.filter(r => r.change === "up");
    else if (changeFilter === "down") result = result.filter(r => r.change === "down");
    else if (changeFilter === "same") result = result.filter(r => r.change === "same");
    return result;
  }, [data, search, categoryFilter, changeFilter]);

  // Summary stats — group by CURRENT category
  const stats = useMemo(() => {
    const counts = { Master: 0, "Especial Plus": 0, Especial: 0, Essencial: 0 };
    const kgs = { Master: 0, "Especial Plus": 0, Especial: 0, Essencial: 0 };
    let upCount = 0, downCount = 0, sameCount = 0;
    data.forEach(r => {
      const name = r.currentCat.name as keyof typeof counts;
      counts[name]++;
      kgs[name] += r.totalKg;
      if (r.change === "up") upCount++;
      else if (r.change === "down") downCount++;
      else sameCount++;
    });
    return { counts, kgs, total: data.length, upCount, downCount, sameCount };
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          <div>
            <h2 className="text-base font-semibold">Programa Aceleração {cycle.year}</h2>
            <p className="text-xs text-muted-foreground">
              Período: {cycle.startLabel} — {cycle.endLabel} · Canal Revenda
              {lastDateFormatted ? ` · Dados até ${lastDateFormatted}` : ""}
            </p>
          </div>
        </div>
        <Select value={cycleId} onValueChange={setCycleId}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CYCLES.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category Summary Cards — showing CURRENT category distribution */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const count = stats.counts[cat.name as keyof typeof stats.counts];
          const kg = stats.kgs[cat.name as keyof typeof stats.kgs];
          const isActive = categoryFilter === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => setCategoryFilter(isActive ? "all" : cat.name)}
              className={`rounded-lg border p-3 text-left transition-all hover:shadow-sm ${cat.bg} ${isActive ? "ring-2 ring-primary/40" : ""}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`h-4 w-4 ${cat.color}`} />
                <span className="text-xs font-semibold">{cat.shortName}</span>
              </div>
              <p className={`text-lg font-bold ${cat.color}`}>{count}</p>
              <p className="text-[10px] text-muted-foreground">
                {count === 1 ? "revenda" : "revendas"} · {fmtKg(kg)} kg
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Desc: {cat.desconto} · Sell Out: {cat.sellOut}
              </p>
            </button>
          );
        })}
      </div>

      {/* Change summary banners */}
      <div className="flex flex-wrap gap-2">
        {stats.upCount > 0 && (
          <button
            onClick={() => setChangeFilter(changeFilter === "up" ? "all" : "up")}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all ${changeFilter === "up" ? "ring-2 ring-emerald-500/40 bg-emerald-500/10 border-emerald-500/30" : "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"}`}
          >
            <ArrowUp className="h-4 w-4 text-emerald-500" />
            <span className="font-semibold text-emerald-700">{stats.upCount}</span>
            <span className="text-muted-foreground">sobem de categoria</span>
          </button>
        )}
        {stats.downCount > 0 && (
          <button
            onClick={() => setChangeFilter(changeFilter === "down" ? "all" : "down")}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all ${changeFilter === "down" ? "ring-2 ring-red-500/40 bg-red-500/10 border-red-500/30" : "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"}`}
          >
            <ArrowDown className="h-4 w-4 text-red-500" />
            <span className="font-semibold text-red-700">{stats.downCount}</span>
            <span className="text-muted-foreground">descem de categoria</span>
          </button>
        )}
        {stats.sameCount > 0 && (
          <button
            onClick={() => setChangeFilter(changeFilter === "same" ? "all" : "same")}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all ${changeFilter === "same" ? "ring-2 ring-slate-500/40 bg-slate-500/10 border-slate-500/30" : "border-slate-500/20 bg-muted/30 hover:bg-muted/50"}`}
          >
            <Minus className="h-4 w-4 text-slate-500" />
            <span className="font-semibold text-slate-700">{stats.sameCount}</span>
            <span className="text-muted-foreground">mantêm categoria</span>
          </button>
        )}
        {changeFilter !== "all" && (
          <button
            onClick={() => setChangeFilter("all")}
            className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50"
          >
            Limpar filtro
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar revenda por nome, código ou cidade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} revenda{filtered.length !== 1 ? "s" : ""}
        {categoryFilter !== "all" && ` na categoria ${categoryFilter}`}
        {changeFilter !== "all" && ` (${changeFilter === "up" ? "sobem" : changeFilter === "down" ? "descem" : "mantêm"})`}
        {search && ` com "${search}"`}
      </p>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 pl-3 font-medium w-8"></th>
                  <th className="text-left p-2 font-medium">Revenda</th>
                  <th className="text-left p-2 font-medium hidden md:table-cell">Cidade</th>
                  <th className="text-right p-2 font-medium">Acumulado</th>
                  <th className="text-center p-2 font-medium">Atual</th>
                  <th className="text-center p-2 font-medium hidden lg:table-cell">Falta p/ Subir</th>
                  <th className="text-center p-2 pr-3 font-medium">Nova Cat.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isExpanded = expandedGroup === r.groupCode;
                  const CurrentIcon = r.currentCat.icon;
                  const NewIcon = r.newCat.icon;
                  return (
                    <tr key={r.groupCode} className="group">
                      <td colSpan={7} className="p-0">
                        <button
                          onClick={() => setExpandedGroup(isExpanded ? null : r.groupCode)}
                          className={`w-full text-left hover:bg-muted/30 transition-colors ${
                            r.change === "up" ? "bg-emerald-500/[0.04]" : r.change === "down" ? "bg-red-500/[0.03]" : ""
                          }`}
                        >
                          <div className="flex items-center">
                            <div className="p-2 pl-3 w-8 shrink-0">
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                            </div>
                            <div className="p-2 flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                {r.change === "up" && <ArrowUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                                {r.change === "down" && <ArrowDown className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                                <p className="font-medium text-xs truncate">{r.clientName}</p>
                              </div>
                              <p className="text-[10px] text-muted-foreground">{r.repCodes} · {r.monthsActive} meses ativos</p>
                            </div>
                            <div className="p-2 hidden md:block text-xs text-muted-foreground whitespace-nowrap">
                              {r.city}{r.state ? ` / ${r.state}` : ""}
                            </div>
                            <div className="p-2 text-right shrink-0">
                              <p className="font-bold text-xs tabular-nums">{fmtKg(r.totalKg)}</p>
                              <p className="text-[10px] text-muted-foreground">{fmtTon(r.totalKg)}t</p>
                            </div>
                            <div className="p-2 text-center shrink-0">
                              <Badge variant="outline" className={`text-[10px] ${r.currentCat.bg} ${r.currentCat.color} border-current/20`}>
                                <CurrentIcon className="h-3 w-3 mr-0.5" />
                                {r.currentCat.shortName}
                              </Badge>
                            </div>
                            <div className="p-2 text-right hidden lg:block shrink-0">
                              {r.gapToNextUp > 0 ? (
                                <div>
                                  <p className="text-xs font-semibold text-orange-500 tabular-nums">{fmtKg(r.gapToNextUp)} kg</p>
                                  <p className="text-[10px] text-muted-foreground">p/ {r.nextUp?.shortName}</p>
                                </div>
                              ) : (
                                <span className="text-[10px] text-emerald-500">Máxima</span>
                              )}
                            </div>
                            <div className="p-2 pr-3 text-center shrink-0">
                              {r.change === "up" ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-600">
                                  <NewIcon className="h-3 w-3 mr-0.5" />
                                  {r.newCat.shortName}
                                </Badge>
                              ) : r.change === "down" ? (
                                <Badge variant="outline" className="text-[10px] bg-red-500/10 border-red-500/30 text-red-600">
                                  <NewIcon className="h-3 w-3 mr-0.5" />
                                  {r.newCat.shortName}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className={`text-[10px] ${r.newCat.bg} ${r.newCat.color} border-current/20`}>
                                  <NewIcon className="h-3 w-3 mr-0.5" />
                                  {r.newCat.shortName}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {/* Progress bar towards next category up */}
                          {r.nextUp && (
                            <div className="px-3 pb-2">
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    r.progressPct >= 100 ? "bg-emerald-500" : r.progressPct >= 80 ? "bg-amber-500" : "bg-blue-500"
                                  }`}
                                  style={{ width: `${Math.min(100, r.progressPct)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </button>
                        {isExpanded && (
                          <MonthlyBreakdown
                            groupCode={r.groupCode}
                            repCodeFilter={repCodeFilter}
                            totalKg={r.totalKg}
                            currentCat={r.currentCat}
                            newCat={r.newCat}
                            startYm={cycle.startYm}
                            endYm={cycle.endYm}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-muted-foreground">
                      Nenhuma revenda encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
