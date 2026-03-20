import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo, useState } from "react";
import { TrendingUp, Users, Package } from "lucide-react";

function formatKg(val: number) { return val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val.toFixed(0); }

export default function HistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedRepCode, setSelectedRepCode] = useState<string | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [productDetail, setProductDetail] = useState<string | null>(null);

  const repsQuery = trpc.repAliases.list.useQuery();
  const monthsQuery = trpc.history.months.useQuery();
  const repCode = isAdmin ? selectedRepCode : undefined;
  const salesQuery = trpc.history.sales.useQuery({ repCodeFilter: repCode, months: 12 });
  const topClientsQuery = trpc.history.topClients.useQuery(
    { yearMonth: selectedMonth, repCodeFilter: repCode },
    { enabled: !!selectedMonth }
  );
  const topProductsQuery = trpc.history.topProducts.useQuery(
    { yearMonth: selectedMonth, repCodeFilter: repCode },
    { enabled: !!selectedMonth }
  );
  const rcRankingQuery = trpc.history.rcRanking.useQuery(
    { yearMonth: selectedMonth },
    { enabled: !!selectedMonth && isAdmin }
  );
  const productClientsQuery = trpc.history.productClients.useQuery(
    { yearMonth: selectedMonth, productName: productDetail!, repCodeFilter: repCode },
    { enabled: !!productDetail && !!selectedMonth }
  );

  const months = monthsQuery.data || [];
  const currentMonth = months[0] || "";

  if (!selectedMonth && currentMonth) {
    setTimeout(() => setSelectedMonth(currentMonth), 0);
  }

  const chartData = useMemo(() => {
    if (!salesQuery.data) return [];
    return salesQuery.data.map((d: any) => ({
      ...d, totalKg: Number(d.totalKg), totalRevenue: Number(d.totalRevenue),
      label: d.yearMonth?.replace(".", "/"),
    }));
  }, [salesQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico</h1>
          <p className="text-muted-foreground text-sm mt-1">Evolução de vendas e rankings mensais</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && repsQuery.data && (
            <Select value={selectedRepCode || "all"} onValueChange={(v) => setSelectedRepCode(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos os RCs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os RCs</SelectItem>
                {repsQuery.data.map((r: any) => <SelectItem key={r.repCode} value={r.repCode}>{r.alias || r.repName}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={selectedMonth || "none"} onValueChange={(v) => v !== "none" && setSelectedMonth(v)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              {months.map((m: string) => <SelectItem key={m} value={m}>{m.replace(".", "/")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Evolution Chart */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Evolução Mensal (KG)</CardTitle></CardHeader>
        <CardContent>
          {salesQuery.isLoading ? <Skeleton className="h-64" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatKg} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${formatKg(v)} kg`, "Volume"]} />
                <Bar dataKey="totalKg" fill="oklch(0.55 0.14 155)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients"><Users className="h-3.5 w-3.5 mr-1.5" />Top Clientes</TabsTrigger>
          <TabsTrigger value="products"><Package className="h-3.5 w-3.5 mr-1.5" />Top Produtos</TabsTrigger>
          {isAdmin && <TabsTrigger value="rcs">Ranking RCs</TabsTrigger>}
        </TabsList>

        <TabsContent value="clients" className="mt-4">
          <Card className="border">
            <CardHeader><CardTitle className="text-base">Top Clientes - {selectedMonth?.replace(".", "/")}</CardTitle></CardHeader>
            <CardContent>
              {topClientsQuery.isLoading ? <Skeleton className="h-48" /> : (
                <div className="space-y-2">
                  {(topClientsQuery.data || []).slice(0, 20).map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                      <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.clientName}</p>
                        <p className="text-xs text-muted-foreground">{c.clientCity}/{c.clientState} - {c.repName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatKg(Number(c.totalKg))} kg</p>
                        <p className="text-xs text-muted-foreground">R$ {Number(c.totalRevenue).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
                      </div>
                    </div>
                  ))}
                  {(topClientsQuery.data || []).length === 0 && <p className="text-center text-muted-foreground py-4">Sem dados para o mês selecionado</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card className="border">
            <CardHeader><CardTitle className="text-base">Top Produtos - {selectedMonth?.replace(".", "/")}</CardTitle></CardHeader>
            <CardContent>
              {topProductsQuery.isLoading ? <Skeleton className="h-48" /> : (
                <div className="space-y-2">
                  {(topProductsQuery.data || []).slice(0, 20).map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
                      onClick={() => setProductDetail(p.productName)}>
                      <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.productName}</p>
                        <p className="text-xs text-muted-foreground">{p.clientCount} clientes</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatKg(Number(p.totalKg))} kg</p>
                        <p className="text-xs text-muted-foreground">R$ {(Number(p.totalRevenue) / Math.max(1, Number(p.totalKg))).toFixed(2)}/kg</p>
                      </div>
                    </div>
                  ))}
                  {(topProductsQuery.data || []).length === 0 && <p className="text-center text-muted-foreground py-4">Sem dados</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="rcs" className="mt-4">
            <Card className="border">
              <CardHeader><CardTitle className="text-base">Ranking RCs - {selectedMonth?.replace(".", "/")}</CardTitle></CardHeader>
              <CardContent>
                {rcRankingQuery.isLoading ? <Skeleton className="h-48" /> : (
                  <div className="space-y-2">
                    {(rcRankingQuery.data || []).map((r: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                        <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.repName}</p>
                          <p className="text-xs text-muted-foreground">{r.clientCount} clientes</p>
                        </div>
                        <p className="text-sm font-semibold">{formatKg(Number(r.totalKg))} kg</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Product Clients Dialog */}
      <Dialog open={!!productDetail} onOpenChange={() => setProductDetail(null)}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader><DialogTitle>Clientes - {productDetail}</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2">
              {(productClientsQuery.data || []).map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{c.clientName}</p>
                    <p className="text-xs text-muted-foreground">{c.repName}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatKg(Number(c.totalKg))} kg</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
