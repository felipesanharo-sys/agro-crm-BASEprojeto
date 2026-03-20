import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Search, Users, ChevronRight, RotateCcw, Zap, ShoppingCart, XCircle, Package } from "lucide-react";

function getClientStatus(daysSince: number, avgCycle: number) {
  if (daysSince <= avgCycle * 0.8) return "ativo";
  if (daysSince <= avgCycle) return "em_ciclo";
  if (daysSince <= avgCycle * 1.3) return "alerta";
  if (daysSince <= avgCycle * 1.8) return "pre_inativacao";
  return "inativo";
}

const statusConfig: Record<string, { label: string; color: string; badge: string }> = {
  ativo: { label: "Ativo", color: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  em_ciclo: { label: "Em Ciclo", color: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  alerta: { label: "Alerta", color: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  pre_inativacao: { label: "Pré-Inativação", color: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  inativo: { label: "Inativo", color: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200" },
  em_acao: { label: "Em Ação", color: "bg-purple-500", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  pedido_na_tela: { label: "Pedido na Tela", color: "bg-teal-500", badge: "bg-teal-50 text-teal-700 border-teal-200" },
  excluido: { label: "Excluído", color: "bg-gray-500", badge: "bg-gray-50 text-gray-700 border-gray-200" },
};

function formatKg(val: number) { return val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val.toFixed(0); }

export default function ClientsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedRepCode, setSelectedRepCode] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<{ client: any; type: string } | null>(null);
  const [actionNote, setActionNote] = useState("");
  const utils = trpc.useUtils();

  const repsQuery = trpc.repAliases.list.useQuery();
  const clientsQuery = trpc.clients.list.useQuery(isAdmin ? { repCodeFilter: selectedRepCode } : undefined);
  const setActionMutation = trpc.clients.setAction.useMutation({
    onSuccess: () => { toast.success("Ação registrada"); setActionDialog(null); setActionNote(""); utils.clients.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const enrichedClients = useMemo(() => {
    if (!clientsQuery.data) return [];
    return clientsQuery.data.map((c: any) => {
      const lastDate = new Date(c.lastPurchaseDate);
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
      const orders = Number(c.orderCount) || 1;
      const firstDate = new Date(c.firstPurchaseDate);
      const totalDays = Math.max(1, Math.floor((lastDate.getTime() - firstDate.getTime()) / 86400000));
      const avgCycle = orders > 1 ? Math.round(totalDays / (orders - 1)) : 60;
      let effectiveStatus = getClientStatus(daysSince, avgCycle);
      if (c.manualAction?.actionType && c.manualAction.actionType !== "reset") {
        effectiveStatus = c.manualAction.actionType;
      }
      return { ...c, daysSince, avgCycle, effectiveStatus, totalKg: Number(c.totalKg), totalRevenue: Number(c.totalRevenue) };
    });
  }, [clientsQuery.data]);

  const filtered = useMemo(() => {
    let list = enrichedClients;
    if (statusFilter !== "all") list = list.filter((c: any) => c.effectiveStatus === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c: any) => c.clientName?.toLowerCase().includes(s) || c.clientCodeSAP?.includes(s) || c.clientCity?.toLowerCase().includes(s));
    }
    return list;
  }, [enrichedClients, statusFilter, search]);

  // Benchmarking
  const benchmarking = useMemo(() => {
    if (!isAdmin || !clientsQuery.data) return [];
    const byRep = new Map<string, { total: number; healthy: number; repName: string; pedidoNaTela: number }>();
    enrichedClients.forEach((c: any) => {
      const key = c.repCode;
      if (!byRep.has(key)) byRep.set(key, { total: 0, healthy: 0, repName: c.repName, pedidoNaTela: 0 });
      const entry = byRep.get(key)!;
      entry.total++;
      if (["ativo", "em_acao", "pedido_na_tela"].includes(c.effectiveStatus)) entry.healthy++;
      if (c.effectiveStatus === "pedido_na_tela") entry.pedidoNaTela++;
    });
    return Array.from(byRep.entries()).map(([code, v]) => ({
      repCode: code, repName: v.repName, total: v.total, healthy: v.healthy,
      healthRate: v.total > 0 ? (v.healthy / v.total * 100) : 0, pedidoNaTela: v.pedidoNaTela,
    })).sort((a: any, b: any) => b.healthRate - a.healthRate);
  }, [enrichedClients, isAdmin]);

  const handleAction = (client: any, type: string) => {
    setActionDialog({ client, type });
    setActionNote("");
  };

  const submitAction = () => {
    if (!actionDialog) return;
    setActionMutation.mutate({
      clientCodeSAP: actionDialog.client.clientCodeSAP,
      repCode: actionDialog.client.repCode,
      actionType: actionDialog.type as any,
      note: actionNote || undefined,
      previousStatus: actionDialog.client.effectiveStatus,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">Carteira de clientes por RC</p>
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, código SAP ou cidade..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients">Clientes ({filtered.length})</TabsTrigger>
          {isAdmin && <TabsTrigger value="benchmark">Benchmarking</TabsTrigger>}
        </TabsList>

        <TabsContent value="clients" className="mt-4">
          {clientsQuery.isLoading ? <Skeleton className="h-64" /> : (
            <div className="space-y-2">
              {filtered.map((c: any, i: number) => {
                const cfg = statusConfig[c.effectiveStatus] || statusConfig.ativo;
                return (
                  <Card key={`${c.clientCodeSAP}-${c.repCode}-${i}`} className="border hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => setSelectedClient(c)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm truncate">{c.clientName}</p>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${cfg.badge}`}>{cfg.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            SAP: {c.clientCodeSAP} | {c.clientCity}/{c.clientState} | Ciclo: {c.avgCycle}d | Última: {c.daysSince}d atrás
                          </p>
                          {c.manualAction?.actionType === "em_acao" && c.manualAction?.note && (
                            <p className="text-xs text-purple-600 mt-1 truncate">Em ação: {c.manualAction.note}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{formatKg(c.totalKg)} kg</p>
                          <p className="text-xs text-muted-foreground">{c.repName}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum cliente encontrado</p>}
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="benchmark" className="mt-4">
            <Card className="border">
              <CardHeader><CardTitle className="text-base">Saúde de Carteira por RC</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {benchmarking.map((b, i) => (
                    <div key={b.repCode} className="flex items-center gap-4 p-3 rounded-lg border">
                      <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.repName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${b.healthRate}%` }} />
                          </div>
                          <span className="text-xs font-medium w-12 text-right">{b.healthRate.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{b.healthy}/{b.total} saudáveis</p>
                        <p className="text-xs text-teal-600">{b.pedidoNaTela} pedidos na tela</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Client Detail Dialog */}
      <ClientDetailDialog client={selectedClient} onClose={() => setSelectedClient(null)} onAction={handleAction} />

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === "em_acao" ? "Marcar Em Ação" :
               actionDialog?.type === "pedido_na_tela" ? "Pedido na Tela" :
               actionDialog?.type === "excluido" ? "Excluir Cliente" : "Reset Status"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{actionDialog?.client?.clientName}</p>
            <Textarea placeholder="Observação (opcional)..." value={actionNote} onChange={e => setActionNote(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancelar</Button>
            <Button onClick={submitAction} disabled={setActionMutation.isPending}>
              {setActionMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientDetailDialog({ client, onClose, onAction }: { client: any; onClose: () => void; onAction: (c: any, t: string) => void }) {
  const lastOrdersQuery = trpc.clients.lastOrders.useQuery(
    { clientCodeSAP: client?.clientCodeSAP, repCode: client?.repCode },
    { enabled: !!client }
  );
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const orderProductsQuery = trpc.clients.orderProductDetails.useQuery(
    { clientCodeSAP: client?.clientCodeSAP, repCode: client?.repCode, orderCode: expandedOrder! },
    { enabled: !!expandedOrder && !!client }
  );

  if (!client) return null;

  return (
    <Dialog open={!!client} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-lg">{client.clientName}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">SAP:</span> <span className="font-medium">{client.clientCodeSAP}</span></div>
              <div><span className="text-muted-foreground">Cidade:</span> <span className="font-medium">{client.clientCity}/{client.clientState}</span></div>
              <div><span className="text-muted-foreground">Ciclo médio:</span> <span className="font-medium">{client.avgCycle} dias</span></div>
              <div><span className="text-muted-foreground">Última compra:</span> <span className="font-medium">{client.daysSince}d atrás</span></div>
              <div><span className="text-muted-foreground">Total KG:</span> <span className="font-medium">{formatKg(client.totalKg)}</span></div>
              <div><span className="text-muted-foreground">Canal:</span> <span className="font-medium">{client.salesChannelGroup || "-"}</span></div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onAction(client, "em_acao")} className="text-purple-600 border-purple-200 hover:bg-purple-50">
                <Zap className="h-3.5 w-3.5 mr-1" />Em Ação
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAction(client, "pedido_na_tela")} className="text-teal-600 border-teal-200 hover:bg-teal-50">
                <ShoppingCart className="h-3.5 w-3.5 mr-1" />Pedido na Tela
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAction(client, "excluido")} className="text-gray-600 border-gray-200 hover:bg-gray-50">
                <XCircle className="h-3.5 w-3.5 mr-1" />Excluir
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAction(client, "reset")} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                <RotateCcw className="h-3.5 w-3.5 mr-1" />Reset
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Últimos Pedidos</h3>
              {lastOrdersQuery.isLoading ? <Skeleton className="h-20" /> : (
                <div className="space-y-2">
                  {(lastOrdersQuery.data || []).map((o: any) => (
                    <div key={o.orderCode}>
                      <div className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedOrder(expandedOrder === o.orderCode ? null : o.orderCode)}>
                        <div>
                          <p className="text-xs font-medium">Pedido {o.orderCode}</p>
                          <p className="text-xs text-muted-foreground">{new Date(o.orderDate).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold">{formatKg(Number(o.kgTotal))} kg</p>
                          <p className="text-xs text-muted-foreground">R$ {Number(o.revenueTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                      {expandedOrder === o.orderCode && orderProductsQuery.data && (
                        <div className="ml-4 mt-1 space-y-1">
                          {orderProductsQuery.data.map((p: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs">
                              <div className="flex items-center gap-1.5">
                                <Package className="h-3 w-3 text-muted-foreground" />
                                <span>{p.productName}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-medium">{formatKg(Number(p.kgTotal))} kg</span>
                                <span className="text-muted-foreground ml-2">
                                  R$ {(Number(p.revenueTotal) / Math.max(1, Number(p.kgTotal))).toFixed(2)}/kg
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {(lastOrdersQuery.data || []).length === 0 && <p className="text-xs text-muted-foreground">Sem pedidos</p>}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
