import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StatusBadge from "@/components/StatusBadge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Package, Clock, MapPin, Calendar } from "lucide-react";
import { usePageTracker } from "@/hooks/usePageTracker";

const STATUS_COLORS: Record<string, string> = {
  ativo: "#4ade80",
  em_ciclo: "#facc15",
  alerta: "#fb923c",
  inativo: "#f87171",
};

const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativos",
  em_ciclo: "Em Ciclo",
  alerta: "Alerta",
  inativo: "Inativos",
};

const formatKg = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${v}kg`;
const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const formatDate = (ts: number | string | null) => {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};
const formatKgFull = (kg: number) => (!kg ? "0" : kg.toLocaleString("pt-BR", { maximumFractionDigits: 0 }));

// ---- Clients by Status Dialog ----
function ClientsByStatusDialog({ statusFilter, onClose }: { statusFilter: string; onClose: () => void }) {
  const { data: clients, isLoading } = trpc.clients.list.useQuery(
    { statusFilter },
    { staleTime: 60000 }
  );

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: STATUS_COLORS[statusFilter] || "#888" }}
            />
            Clientes {STATUS_LABELS[statusFilter] || statusFilter}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : !clients || clients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente encontrado</p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground mb-2">{clients.length} cliente{clients.length !== 1 ? "s" : ""}</p>
            {clients.map((client: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3 py-2 px-2 border-b last:border-0 hover:bg-muted/20 rounded-lg transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{client.clientName}</p>
                    <StatusBadge status={client.status} manualStatus={client.manualStatus} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" />
                      {client.clientCity || "—"}
                    </span>
                    {client.repName && (
                      <span>RC: {client.repName}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold">{formatKgFull(client.avgKgPerOrder)} kg/ped</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                    <Calendar className="h-2.5 w-2.5" />
                    {formatDate(client.lastPurchaseDate)}
                  </p>
                  <p className={`text-[10px] font-medium ${client.daysSinceLastPurchase > 150 ? "text-destructive" : "text-muted-foreground"}`}>
                    {client.daysSinceLastPurchase}d sem compra
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- Main Dashboard Page ----
export default function DashboardPage() {
  usePageTracker("dashboard");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const { data: metrics, isLoading: metricsLoading } = trpc.dashboard.metrics.useQuery(undefined, { staleTime: 60000 });
  const { data: evolution } = trpc.dashboard.monthlyEvolution.useQuery(undefined, { staleTime: 120000 });
  const { data: topClients } = trpc.dashboard.topClients.useQuery(undefined, { staleTime: 120000 });
  const { data: pricePerKg } = trpc.dashboard.pricePerKg.useQuery(undefined, { staleTime: 120000 });

  const pieData = metrics ? [
    { name: "Ativos", value: metrics.activeClients, color: "#4ade80", key: "ativo" },
    { name: "Em Ciclo", value: metrics.cycleClients, color: "#facc15", key: "em_ciclo" },
    { name: "Alerta", value: metrics.alertClients, color: "#fb923c", key: "alerta" },
    { name: "Pré-Inativação", value: metrics.preInactiveClients || 0, color: "#c084fc", key: "pre_inativacao" },
    { name: "Inativos", value: metrics.inactiveClients, color: "#f87171", key: "inativo" },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral de performance e indicadores</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="KG 30 dias" value={metricsLoading ? null : formatKg(metrics?.kg30d || 0)} icon={<Package className="h-4 w-4" />} />
        <MetricCard title="KG 60 dias" value={metricsLoading ? null : formatKg(metrics?.kg60d || 0)} icon={<Package className="h-4 w-4" />} />
        <MetricCard title="KG 90 dias" value={metricsLoading ? null : formatKg(metrics?.kg90d || 0)} icon={<Package className="h-4 w-4" />} />
        <MetricCard title="Dias úteis restantes" value={metricsLoading ? null : String(metrics?.businessDaysRemaining || 0)} icon={<Clock className="h-4 w-4" />} accent />
      </div>

      {/* Client status cards — CLICKABLE */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <MetricCard title="Total Clientes" value={metricsLoading ? null : String(metrics?.totalClients || 0)} icon={<Users className="h-4 w-4" />} />
        <MetricCard
          title="Ativos"
          value={metricsLoading ? null : String(metrics?.activeClients || 0)}
          className="border-l-2 border-l-green-400 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelectedStatus("ativo")}
        />
        <MetricCard
          title="Em Ciclo"
          value={metricsLoading ? null : String(metrics?.cycleClients || 0)}
          className="border-l-2 border-l-yellow-400 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelectedStatus("em_ciclo")}
        />
        <MetricCard
          title="Alerta"
          value={metricsLoading ? null : String(metrics?.alertClients || 0)}
          className="border-l-2 border-l-orange-400 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelectedStatus("alerta")}
        />
        <MetricCard
          title="Pré-Inativação"
          value={metricsLoading ? null : String(metrics?.preInactiveClients || 0)}
          className="border-l-2 border-l-purple-400 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelectedStatus("pre_inativacao")}
        />
        <MetricCard
          title="Inativos"
          value={metricsLoading ? null : String(metrics?.inactiveClients || 0)}
          className="border-l-2 border-l-red-400 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelectedStatus("inativo")}
        />
      </div>

      <MetricCard title="Ticket Médio/Cliente" value={metricsLoading ? null : formatCurrency(metrics?.avgTicketPerClient || 0)} icon={<TrendingUp className="h-4 w-4" />} />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Evolução Mensal (KG)</CardTitle>
          </CardHeader>
          <CardContent>
            {evolution ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={evolution.map((e: any) => ({ ...e, totalKg: Number(e.totalKg) }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="yearMonth" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => formatKg(v)} />
                  <Tooltip formatter={(v: number) => [formatKg(v), "KG"]} labelFormatter={(l: string) => `Período: ${l}`} />
                  <Bar dataKey="totalKg" fill="oklch(0.55 0.17 152)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Skeleton className="h-[250px]" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribuição de Clientes</CardTitle>
            <p className="text-[10px] text-muted-foreground">Clique no gráfico para ver a lista</p>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="flex items-center justify-center gap-6">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      stroke="none"
                      onClick={(_, idx) => {
                        const item = pieData[idx];
                        if (item) setSelectedStatus(item.key);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {pieData.map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 px-2 py-1 rounded transition-colors"
                      onClick={() => setSelectedStatus(d.key)}
                    >
                      <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: d.color }} />
                      <span>{d.name}: <strong>{d.value}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <Skeleton className="h-[180px]" />}
          </CardContent>
        </Card>
      </div>

      {/* Top clients ranking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Ranking de Clientes por Volume (12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {topClients ? (
            <div className="space-y-1.5">
              {(topClients as any[]).slice(0, 10).map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.clientName}</p>
                    <p className="text-[10px] text-muted-foreground">{c.clientCity}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary">{formatKg(Number(c.totalKg))}</p>
                    <p className="text-[10px] text-muted-foreground">{c.orderCount} pedidos</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <Skeleton className="h-[300px]" />}
        </CardContent>
      </Card>

      {/* Price per KG by product */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Preço Médio/KG por Produto</CardTitle>
        </CardHeader>
        <CardContent>
          {pricePerKg ? (
            <ResponsiveContainer width="100%" height={Math.max(200, (pricePerKg as any[]).slice(0, 15).length * 32)}>
              <BarChart data={(pricePerKg as any[]).slice(0, 15).map((p: any) => ({ ...p, pricePerKg: Number(Number(p.pricePerKg).toFixed(2)) }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `R$${v}`} />
                <YAxis type="category" dataKey="productName" tick={{ fontSize: 9 }} width={140} />
                <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "R$/KG"]} />
                <Bar dataKey="pricePerKg" fill="oklch(0.6 0.15 200)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Skeleton className="h-[300px]" />}
        </CardContent>
      </Card>

      {/* Clients by Status Dialog */}
      {selectedStatus && (
        <ClientsByStatusDialog statusFilter={selectedStatus} onClose={() => setSelectedStatus(null)} />
      )}
    </div>
  );
}

function MetricCard({ title, value, icon, accent, className, onClick }: {
  title: string;
  value: string | null;
  icon?: React.ReactNode;
  accent?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Card className={className} onClick={onClick}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{title}</span>
          {icon && <span className={accent ? "text-primary" : "text-muted-foreground"}>{icon}</span>}
        </div>
        {value !== null ? (
          <p className={`text-xl sm:text-2xl font-bold tracking-tight ${accent ? "text-primary" : ""}`}>{value}</p>
        ) : (
          <Skeleton className="h-8 w-20" />
        )}
      </CardContent>
    </Card>
  );
}
