import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, Line, ComposedChart } from "recharts";
import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Users, Package, DollarSign, Scale, Filter, Zap } from "lucide-react";
import AceleracaoTab from "./AceleracaoTab";

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}t` : `${Math.round(n)}`;
const fmtFull = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));
const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
const fmtBRL2 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// ---- My History Sub-tab (RC view) ----
function MyHistorySection({ selectedMonth, setSelectedMonth, availableMonths, repCodeFilter }: {
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  availableMonths: string[];
  repCodeFilter?: string;
}) {
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"clientes" | "produtos">("clientes");

  const { data: monthlyData } = trpc.history.monthly.useQuery({ months: 12, repCodeFilter });
  const { data: topClients } = trpc.history.topClients.useQuery({ yearMonth: selectedMonth, repCodeFilter });
  const { data: topProducts } = trpc.history.topProducts.useQuery({ yearMonth: selectedMonth, repCodeFilter });

  // Chart data
  const chartData = useMemo(() => {
    if (!monthlyData) return [];
    return (monthlyData as any[]).map((m: any) => ({
      month: m.yearMonth?.replace(/^\d{4}\./, "") || "",
      yearMonth: m.yearMonth,
      kg: Number(m.totalKg) || 0,
      revenue: Number(m.totalRevenue) || 0,
      clients: Number(m.uniqueClients) || 0,
    }));
  }, [monthlyData]);

  // Summary cards for selected month
  const selectedData = useMemo(() => {
    if (!chartData.length) return { kg: 0, revenue: 0, clients: 0, products: 0 };
    const m = chartData.find(d => d.yearMonth === selectedMonth);
    return {
      kg: m?.kg || 0,
      revenue: m?.revenue || 0,
      clients: m?.clients || 0,
      products: (topProducts as any[])?.length || 0,
    };
  }, [chartData, selectedMonth, topProducts]);

  // Previous month comparison
  const prevData = useMemo(() => {
    if (!chartData.length) return null;
    const idx = chartData.findIndex(d => d.yearMonth === selectedMonth);
    if (idx <= 0) return null;
    return chartData[idx - 1];
  }, [chartData, selectedMonth]);

  const variation = prevData && prevData.kg > 0
    ? ((selectedData.kg - prevData.kg) / prevData.kg) * 100
    : null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Scale className="h-3.5 w-3.5" /> Volume (KG)
            </div>
            <div className="text-xl font-bold">{fmtFull(selectedData.kg)}</div>
            {variation !== null && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${variation >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {variation >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {variation >= 0 ? "+" : ""}{variation.toFixed(1)}% vs mês anterior
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3.5 w-3.5" /> Receita Líquida
            </div>
            <div className="text-xl font-bold">{fmtBRL(selectedData.revenue)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {selectedData.kg > 0 ? fmtBRL(selectedData.revenue / selectedData.kg) + "/kg" : "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3.5 w-3.5" /> Clientes Atendidos
            </div>
            <div className="text-xl font-bold">{selectedData.clients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Package className="h-3.5 w-3.5" /> Produtos Vendidos
            </div>
            <div className="text-xl font-bold">{selectedData.products}</div>
          </CardContent>
        </Card>
      </div>

      {/* Evolution Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Evolução Mensal (KG)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="kg" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmt(v)} />
                <YAxis yAxisId="rev" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$${fmt(v)}`} hide />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "KG") return [fmtFull(value) + " kg", name];
                    return [fmtBRL(value), "Receita"];
                  }}
                  labelFormatter={(label: string) => `Mês: ${label}`}
                />
                <Legend />
                <Bar yAxisId="kg" dataKey="kg" name="KG" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.yearMonth === selectedMonth ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"}
                      cursor="pointer"
                      onClick={() => setSelectedMonth(entry.yearMonth)}
                    />
                  ))}
                </Bar>
                <Line yAxisId="kg" type="monotone" dataKey="revenue" name="Receita" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} hide />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">Clique em uma barra para selecionar o mês</p>
        </CardContent>
      </Card>

      {/* Sub-tabs: Clientes / Produtos */}
      <div className="flex gap-2 mb-2">
        <Button
          variant={activeSubTab === "clientes" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSubTab("clientes")}
        >
          <Users className="h-3.5 w-3.5 mr-1" /> Para quem vendeu
        </Button>
        <Button
          variant={activeSubTab === "produtos" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSubTab("produtos")}
        >
          <Package className="h-3.5 w-3.5 mr-1" /> O que vendeu
        </Button>
      </div>

      {activeSubTab === "clientes" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Clientes — {selectedMonth.replace(".", "/")}
              <Badge variant="secondary" className="ml-2">{(topClients as any[])?.length || 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 pl-3 font-medium">Cliente</th>
                    <th className="text-left p-2 font-medium hidden md:table-cell">Cidade</th>
                    <th className="text-left p-2 font-medium hidden md:table-cell">Canal</th>
                    <th className="text-right p-2 font-medium">KG</th>
                    <th className="text-right p-2 font-medium hidden md:table-cell">Receita</th>
                    <th className="text-right p-2 font-medium hidden md:table-cell">R$/kg</th>
                    <th className="text-right p-2 pr-3 font-medium">Prod.</th>
                  </tr>
                </thead>
                <tbody>
                  {(topClients as any[])?.map((c: any) => (
                    <ClientRow
                      key={c.clientCodeSAP}
                      client={c}
                      yearMonth={selectedMonth}
                      isExpanded={expandedClient === c.clientCodeSAP}
                      onToggle={() => setExpandedClient(expandedClient === c.clientCodeSAP ? null : c.clientCodeSAP)}
                      repCodeFilter={repCodeFilter}
                    />
                  ))}
                  {(!topClients || (topClients as any[]).length === 0) && (
                    <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">Sem dados para este mês</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeSubTab === "produtos" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Produtos — {selectedMonth.replace(".", "/")}
              <Badge variant="secondary" className="ml-2">{(topProducts as any[])?.length || 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 pl-3 font-medium">Produto</th>
                    <th className="text-right p-2 font-medium">KG</th>
                    <th className="text-right p-2 font-medium hidden md:table-cell">Receita</th>
                    <th className="text-right p-2 font-medium hidden md:table-cell">R$/kg</th>
                    <th className="text-right p-2 pr-3 font-medium">Clientes</th>
                  </tr>
                </thead>
                <tbody>
                  {(topProducts as any[])?.map((p: any) => (
                    <ProductRow
                      key={p.productName}
                      product={p}
                      yearMonth={selectedMonth}
                      isExpanded={expandedProduct === p.productName}
                      onToggle={() => setExpandedProduct(expandedProduct === p.productName ? null : p.productName)}
                      repCodeFilter={repCodeFilter}
                    />
                  ))}
                  {(!topProducts || (topProducts as any[]).length === 0) && (
                    <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">Sem dados para este mês</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Expandable client row with product breakdown
function ClientRow({ client, yearMonth, isExpanded, onToggle, repCodeFilter }: {
  client: any;
  yearMonth: string;
  isExpanded: boolean;
  onToggle: () => void;
  repCodeFilter?: string;
}) {
  const { data: products } = trpc.history.clientProducts.useQuery(
    { yearMonth, clientCodeSAP: client.clientCodeSAP, repCodeFilter },
    { enabled: isExpanded }
  );

  return (
    <>
      <tr
        className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="p-2 pl-3">
          <div className="flex items-center gap-1.5">
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <div>
              <div className="font-medium text-xs truncate max-w-[200px]">{client.clientName}</div>
              <div className="text-[10px] text-muted-foreground">{client.clientCodeSAP}</div>
            </div>
          </div>
        </td>
        <td className="p-2 text-xs hidden md:table-cell">{client.clientCity}</td>
        <td className="p-2 hidden md:table-cell">
          <Badge variant="outline" className="text-[10px]">{client.channel}</Badge>
        </td>
        <td className="p-2 text-right font-medium text-xs">{fmtFull(Number(client.totalKg))}</td>
        <td className="p-2 text-right text-xs hidden md:table-cell">{fmtBRL(Number(client.totalRevenue))}</td>
        <td className="p-2 text-right text-xs hidden md:table-cell">{fmtBRL2(Number(client.pricePerKg))}</td>
        <td className="p-2 pr-3 text-right text-xs">{client.productCount}</td>
      </tr>
      {isExpanded && products && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="bg-muted/20 border-b px-6 py-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left py-1 font-medium">Produto</th>
                    <th className="text-right py-1 font-medium">KG</th>
                    <th className="text-right py-1 font-medium">Receita</th>
                    <th className="text-right py-1 font-medium">R$/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {(products as any[]).map((p: any) => (
                    <tr key={p.productName} className="border-t border-muted/30">
                      <td className="py-1">{p.productName}</td>
                      <td className="py-1 text-right">{fmtFull(Number(p.totalKg))}</td>
                      <td className="py-1 text-right">{fmtBRL(Number(p.totalRevenue))}</td>
                      <td className="py-1 text-right">{fmtBRL2(Number(p.pricePerKg))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Expandable product row with client breakdown
function ProductRow({ product, yearMonth, isExpanded, onToggle, repCodeFilter }: {
  product: any;
  yearMonth: string;
  isExpanded: boolean;
  onToggle: () => void;
  repCodeFilter?: string;
}) {
  const { data: clients } = trpc.history.productClients.useQuery(
    { yearMonth, productName: product.productName, repCodeFilter },
    { enabled: isExpanded }
  );

  return (
    <>
      <tr
        className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="p-2 pl-3">
          <div className="flex items-center gap-1.5">
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <span className="font-medium text-xs">{product.productName}</span>
          </div>
        </td>
        <td className="p-2 text-right font-medium text-xs">{fmtFull(Number(product.totalKg))}</td>
        <td className="p-2 text-right text-xs hidden md:table-cell">{fmtBRL(Number(product.totalRevenue))}</td>
        <td className="p-2 text-right text-xs hidden md:table-cell">{fmtBRL2(Number(product.pricePerKg))}</td>
        <td className="p-2 pr-3 text-right text-xs">{product.clientCount}</td>
      </tr>
      {isExpanded && clients && (
        <tr>
          <td colSpan={5} className="p-0">
            <div className="bg-muted/20 border-b px-6 py-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left py-1 font-medium">Cliente</th>
                    <th className="text-left py-1 font-medium hidden md:table-cell">Cidade</th>
                    <th className="text-left py-1 font-medium hidden md:table-cell">Canal</th>
                    <th className="text-right py-1 font-medium">KG</th>
                    <th className="text-right py-1 font-medium">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {(clients as any[]).map((c: any) => (
                    <tr key={c.clientCodeSAP} className="border-t border-muted/30">
                      <td className="py-1">{c.clientName}</td>
                      <td className="py-1 hidden md:table-cell">{c.clientCity}</td>
                      <td className="py-1 hidden md:table-cell">
                        <Badge variant="outline" className="text-[10px]">{c.channel}</Badge>
                      </td>
                      <td className="py-1 text-right">{fmtFull(Number(c.totalKg))}</td>
                      <td className="py-1 text-right">{fmtBRL(Number(c.totalRevenue))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---- Consolidated Sub-tab (Gestor view) ----
function ConsolidatedSection({ selectedMonth }: { selectedMonth: string }) {
  const { data: ranking, isLoading } = trpc.history.rcRanking.useQuery({ yearMonth: selectedMonth });
  const { data: monthlyData } = trpc.history.monthly.useQuery({ months: 12 });

  // Chart data for consolidated view
  const chartData = useMemo(() => {
    if (!monthlyData) return [];
    return (monthlyData as any[]).map((m: any) => ({
      month: m.yearMonth?.replace(/^\d{4}\./, "") || "",
      yearMonth: m.yearMonth,
      kg: Number(m.totalKg) || 0,
      clients: Number(m.uniqueClients) || 0,
    }));
  }, [monthlyData]);

  const rows = (ranking as any[])?.filter(r => r.repCode !== "TOTAL") || [];
  const totalRow = (ranking as any[])?.find(r => r.repCode === "TOTAL");

  // Colors for the chart bars
  const barColors = [
    "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
    "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(142 71% 45%)",
    "hsl(280 65% 60%)", "hsl(30 80% 55%)",
  ];

  return (
    <div className="space-y-6">
      {/* Summary */}
      {totalRow && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Scale className="h-3.5 w-3.5" /> Volume Total
              </div>
              <div className="text-xl font-bold">{fmtFull(totalRow.totalKg)} kg</div>
              <div className={`flex items-center gap-1 text-xs mt-1 ${totalRow.varVsPrev >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {totalRow.varVsPrev >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {totalRow.varVsPrev >= 0 ? "+" : ""}{Number(totalRow.varVsPrev).toFixed(1)}% vs mês anterior
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <DollarSign className="h-3.5 w-3.5" /> Receita Total
              </div>
              <div className="text-xl font-bold">{fmtBRL(totalRow.totalRevenue)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {totalRow.totalKg > 0 ? fmtBRL(totalRow.totalRevenue / totalRow.totalKg) + "/kg" : "-"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Users className="h-3.5 w-3.5" /> Clientes Atendidos
              </div>
              <div className="text-xl font-bold">{totalRow.uniqueClients}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <DollarSign className="h-3.5 w-3.5" /> Ticket Médio
              </div>
              <div className="text-xl font-bold">{fmtBRL2(totalRow.ticketMedio)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Consolidated Evolution Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Evolução Consolidada (KG) — 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmt(v)} />
                <Tooltip
                  formatter={(value: number) => [fmtFull(value) + " kg", "Volume"]}
                  labelFormatter={(label: string) => `Mês: ${label}`}
                />
                <Bar dataKey="kg" name="Volume (KG)" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.yearMonth === selectedMonth ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* RC Ranking Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Ranking RCs — {selectedMonth.replace(".", "/")}
            <Badge variant="secondary" className="ml-2">{rows.length} RCs</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 pl-3 font-medium">#</th>
                  <th className="text-left p-2 font-medium">RC</th>
                  <th className="text-right p-2 font-medium">Volume (KG)</th>
                  <th className="text-right p-2 font-medium hidden md:table-cell">Receita</th>
                  <th className="text-right p-2 font-medium hidden md:table-cell">Clientes</th>
                  <th className="text-right p-2 font-medium hidden md:table-cell">Ticket Médio</th>
                  <th className="text-right p-2 font-medium">% Total</th>
                  <th className="text-right p-2 pr-3 font-medium">Var.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any, i: number) => (
                  <tr key={r.repCode} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-2 pl-3 text-muted-foreground font-medium">{i + 1}</td>
                    <td className="p-2">
                      <div className="font-medium text-xs">{r.repAlias}</div>
                      {r.childAliases?.length > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          incl. {r.childAliases.join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-right font-medium text-xs">{fmtFull(Number(r.totalKg))}</td>
                    <td className="p-2 text-right text-xs hidden md:table-cell">{fmtBRL(Number(r.totalRevenue))}</td>
                    <td className="p-2 text-right text-xs hidden md:table-cell">{r.uniqueClients}</td>
                    <td className="p-2 text-right text-xs hidden md:table-cell">{fmtBRL2(Number(r.ticketMedio))}</td>
                    <td className="p-2 text-right text-xs">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden hidden md:block">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(Number(r.pctOfTotal), 100)}%`,
                              backgroundColor: barColors[i % barColors.length],
                            }}
                          />
                        </div>
                        <span>{Number(r.pctOfTotal).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className={`p-2 pr-3 text-right text-xs font-medium ${Number(r.varVsPrev) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {Number(r.varVsPrev) >= 0 ? "+" : ""}{Number(r.varVsPrev).toFixed(0)}%
                    </td>
                  </tr>
                ))}
                {/* TOTAL row */}
                {totalRow && (
                  <tr className="border-t-2 bg-muted/30 font-bold">
                    <td className="p-2 pl-3"></td>
                    <td className="p-2 text-xs">TOTAL</td>
                    <td className="p-2 text-right text-xs">{fmtFull(Number(totalRow.totalKg))}</td>
                    <td className="p-2 text-right text-xs hidden md:table-cell">{fmtBRL(Number(totalRow.totalRevenue))}</td>
                    <td className="p-2 text-right text-xs hidden md:table-cell">{totalRow.uniqueClients}</td>
                    <td className="p-2 text-right text-xs hidden md:table-cell">{fmtBRL2(Number(totalRow.ticketMedio))}</td>
                    <td className="p-2 text-right text-xs">100%</td>
                    <td className={`p-2 pr-3 text-right text-xs ${Number(totalRow.varVsPrev) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {Number(totalRow.varVsPrev) >= 0 ? "+" : ""}{Number(totalRow.varVsPrev).toFixed(0)}%
                    </td>
                  </tr>
                )}
                {isLoading && (
                  <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">Carregando...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Main Page ----
export default function HistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: availableMonths } = trpc.history.availableMonths.useQuery();
  const { data: aliases } = trpc.repAliases.list.useQuery(undefined, { staleTime: 300000 });
  const [selectedMonth, setSelectedMonth] = useState("2026.01");
  const [selectedRc, setSelectedRc] = useState<string>("all");

  const months = (availableMonths as string[]) || [];

  // Build RC options from aliases, excluding child prepostos (those with parentRepCode)
  const rcOptions = useMemo(() => {
    if (!aliases) return [];
    const parentCodes = new Set((aliases as any[]).filter((a: any) => a.parentRepCode).map((a: any) => a.parentRepCode));
    return (aliases as any[])
      .filter((a: any) => !a.parentRepCode || parentCodes.has(a.repCode))
      .map((a: any) => ({ value: a.repCode, label: a.alias || a.repCode }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [aliases]);

  const repCodeFilter = selectedRc === "all" ? undefined : selectedRc;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Histórico de Vendas</h1>
          <p className="text-sm text-muted-foreground">Acompanhe o desempenho mensal por volume, clientes e produtos</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Select value={selectedRc} onValueChange={setSelectedRc}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Filtrar RC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os RCs</SelectItem>
                {rcOptions.map(rc => (
                  <SelectItem key={rc.value} value={rc.value}>
                    {rc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m} value={m}>
                  {m.replace(".", "/")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="meu" className="space-y-4">
        <TabsList>
          <TabsTrigger value="meu">Meu Histórico</TabsTrigger>
          {isAdmin && <TabsTrigger value="consolidado">Consolidado</TabsTrigger>}
          <TabsTrigger value="aceleracao" className="gap-1">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            Aceleração
          </TabsTrigger>
        </TabsList>
        <TabsContent value="meu">
          <MyHistorySection
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            availableMonths={months}
            repCodeFilter={repCodeFilter}
          />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="consolidado">
            <ConsolidatedSection selectedMonth={selectedMonth} />
          </TabsContent>
        )}
        <TabsContent value="aceleracao">
          <AceleracaoTab repCodeFilter={repCodeFilter} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
