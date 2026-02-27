import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Search, Phone, MapPin, Calendar, Package, TrendingUp, RotateCcw,
  MessageSquarePlus, Users, Trophy, ShoppingCart, DollarSign, Weight,
  Hash, ChevronDown, ChevronUp, FileText, Copy, Share2, Filter
} from "lucide-react";

const STATUS_TABS = [
  { value: "todos", label: "Todos" },
  { value: "em_ciclo", label: "Em Ciclo" },
  { value: "ativo", label: "Ativos" },
  { value: "alerta", label: "Alerta" },
  { value: "pre_inativacao", label: "Pré-Inativação" },
  { value: "inativo", label: "Inativos" },
  { value: "em_acao", label: "Em Ação" },
  { value: "pedido_na_tela", label: "Pedido na Tela" },
];

const formatDate = (ts: number | string | null) => {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};
const formatKg = (kg: number) => (!kg ? "0" : kg.toLocaleString("pt-BR", { maximumFractionDigits: 0 }));
const formatCurrency = (val: number) => (!val ? "R$ 0" : `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const formatPct = (val: number) => `${Math.round(val)}%`;

// ---- Sales Channel Badge ----
function SalesChannelBadge({ channel, size = "sm" }: { channel: string; size?: "sm" | "md" }) {
  const label = channel
    .replace(" Revenda", "")
    .replace(" Cooperativa", " Coop.")
    .replace(" Feedmills", " Feed.")
    .replace("Consumidor/Outros", "Consumidor");
  
  const colors: Record<string, string> = {
    "Master": "bg-[oklch(0.93_0.05_280)] text-[oklch(0.35_0.15_280)]",
    "Especial Plus": "bg-[oklch(0.92_0.04_230)] text-[oklch(0.35_0.12_230)]",
    "Especial": "bg-[oklch(0.93_0.04_160)] text-[oklch(0.35_0.12_160)]",
    "Essencial": "bg-[oklch(0.94_0.02_80)] text-[oklch(0.40_0.08_80)]",
    "Consumidor": "bg-[oklch(0.94_0.03_55)] text-[oklch(0.40_0.10_55)]",
  };
  const matchKey = Object.keys(colors).find(k => channel.includes(k)) || "";
  const colorClass = colors[matchKey] || "bg-muted text-muted-foreground";
  const sizeClass = size === "md" ? "text-[11px] px-2 py-0.5" : "text-[9px] px-1.5 py-0.5";
  
  return (
    <span className={`inline-flex items-center rounded-full font-medium mt-0.5 ${colorClass} ${sizeClass}`}>
      {label}
    </span>
  );
}

const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  em_ciclo: "Em Ciclo",
  alerta: "Alerta",
  pre_inativacao: "Pré-Inativação",
  inativo: "Inativo",
  em_acao: "Em Ação",
  pedido_na_tela: "Pedido na Tela",
};

// ---- Health Ranking Section (Admin only) — Compact Table ----
function HealthRankingSection({ onExtract }: { onExtract: (repCode: string, repName: string, status: string) => void }) {
  const { data: benchmarking, isLoading } = trpc.clients.benchmarking.useQuery(undefined, { staleTime: 120000 });
  const [expandedRc, setExpandedRc] = useState<string | null>(null);

  if (isLoading) {
    return <Card><CardContent className="p-4"><Skeleton className="h-40 w-full" /></CardContent></Card>;
  }

  if (!benchmarking || benchmarking.length === 0) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum dado disponível</CardContent></Card>;
  }

  const ranked = benchmarking.map((rc: any) => {
    const sc = rc.statusCounts || {};
    const total = Number(sc.total || rc.totalClients || 0);
    const healthy = Number(sc.ativo || 0) + Number(sc.em_acao || 0) + Number(sc.pedido_na_tela || 0);
    const healthPct = total > 0 ? (healthy / total) * 100 : 0;
    return { ...rc, total, healthy, healthPct, sc };
  }).sort((a: any, b: any) => b.healthPct - a.healthPct);

  const healthColor = (pct: number) => pct >= 60 ? "text-[oklch(0.45_0.2_155)]" : pct >= 40 ? "text-[oklch(0.6_0.18_55)]" : "text-destructive";
  const barColor = (pct: number) => pct >= 60 ? "bg-[oklch(0.65_0.2_155)]" : pct >= 40 ? "bg-[oklch(0.75_0.18_85)]" : "bg-destructive";
  const medalBg = (i: number) => i === 0 ? "bg-[oklch(0.85_0.12_85)] text-[oklch(0.3_0.1_85)]" : i === 1 ? "bg-[oklch(0.9_0.03_250)] text-[oklch(0.4_0.02_250)]" : i === 2 ? "bg-[oklch(0.85_0.08_55)] text-[oklch(0.35_0.08_55)]" : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-base">Ranking de Saúde de Carteira</h2>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-1">
        Saúde = (Ativos + Em Ação + Pedido na Tela) / Total &nbsp;·&nbsp; Toque na linha para extrair
      </p>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-2.5 px-3 font-semibold w-8">#</th>
                  <th className="text-left py-2.5 px-3 font-semibold">Representante</th>
                  <th className="text-center py-2.5 px-2 font-semibold w-16">Saúde</th>
                  <th className="text-left py-2.5 px-2 font-semibold w-32">Progresso</th>
                  <th className="text-center py-2.5 px-1.5 font-semibold w-12" title="Ativos">✅</th>
                  <th className="text-center py-2.5 px-1.5 font-semibold w-12" title="Em Ação">🎯</th>
                  <th className="text-center py-2.5 px-1.5 font-semibold w-12" title="Pedido na Tela">🛒</th>
                  <th className="text-center py-2.5 px-1.5 font-semibold w-12" title="Em Ciclo">🔄</th>
                  <th className="text-center py-2.5 px-1.5 font-semibold w-12" title="Alerta">⚠️</th>
                  <th className="text-center py-2.5 px-1.5 font-semibold w-12" title="Pré-Inativação">🟣</th>
                  <th className="text-center py-2.5 px-1.5 font-semibold w-12" title="Inativos">❌</th>
                  <th className="text-center py-2.5 px-2 font-semibold w-12">Total</th>
                  <th className="text-center py-2.5 px-2 font-semibold w-20">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((rc: any, idx: number) => {
                  const sc = rc.sc;
                  const isExpanded = expandedRc === rc.repCode;
                  const statusCells: { key: string; color: string; count: number }[] = [
                    { key: "ativo", color: "text-[oklch(0.45_0.2_155)]", count: Number(sc.ativo || 0) },
                    { key: "em_acao", color: "text-[oklch(0.4_0.15_260)]", count: Number(sc.em_acao || 0) },
                    { key: "pedido_na_tela", color: "text-[oklch(0.4_0.15_170)]", count: Number(sc.pedido_na_tela || 0) },
                    { key: "em_ciclo", color: "text-[oklch(0.5_0.15_250)]", count: Number(sc.em_ciclo || 0) },
                    { key: "alerta", color: "text-[oklch(0.6_0.18_55)]", count: Number(sc.alerta || 0) },
                    { key: "pre_inativacao", color: "text-[oklch(0.5_0.18_310)]", count: Number(sc.pre_inativacao || 0) },
                    { key: "inativo", color: "text-destructive", count: Number(sc.inativo || 0) },
                  ];
                  return (
                    <>
                    <tr key={rc.repCode} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold ${medalBg(idx)}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-semibold">{rc.repName}</span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`font-bold text-sm ${healthColor(rc.healthPct)}`}>{formatPct(rc.healthPct)}</span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor(rc.healthPct)}`} style={{ width: `${Math.min(rc.healthPct, 100)}%` }} />
                        </div>
                      </td>
                      {statusCells.map(({ key, color, count }) => (
                        <td key={key} className="py-2 px-1.5 text-center">
                          {count > 0 ? (
                            <button
                              className={`font-medium ${color} hover:underline cursor-pointer bg-transparent border-0 p-0`}
                              onClick={() => onExtract(rc.repCode, rc.repName, key)}
                              title={`Extrair ${STATUS_LABELS[key]} de ${rc.repName}`}
                            >
                              {count}
                            </button>
                          ) : (
                            <span className={`font-medium ${color}`}>{count}</span>
                          )}
                        </td>
                      ))}
                      <td className="py-2 px-2 text-center font-semibold">{rc.total}</td>
                      <td className="py-2 px-2 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-7 w-7 p-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          onClick={() => setExpandedRc(isExpanded ? null : rc.repCode)}
                          title="Ver opções de extração"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${rc.repCode}-expand`} className="bg-muted/20">
                        <td colSpan={13} className="py-2 px-4">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-[10px] text-muted-foreground mr-1">Extrair lista:</span>
                            {["alerta", "pre_inativacao", "inativo", "em_ciclo", "em_acao", "pedido_na_tela", "ativo"].map(status => {
                              const count = Number(sc[status] || 0);
                              if (count === 0) return null;
                              return (
                                <Button
                                  key={status}
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] px-2 gap-1"
                                  onClick={() => onExtract(rc.repCode, rc.repName, status)}
                                >
                                  <Share2 className="h-3 w-3" />
                                  {STATUS_LABELS[status]} ({count})
                                </Button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile compact list */}
          <div className="md:hidden divide-y">
            {ranked.map((rc: any, idx: number) => {
              const sc = rc.sc;
              const isExpanded = expandedRc === rc.repCode;
              return (
                <div key={rc.repCode} className="px-3 py-2.5">
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => setExpandedRc(isExpanded ? null : rc.repCode)}
                  >
                    <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold shrink-0 ${medalBg(idx)}`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs truncate">{rc.repName}</span>
                        <span className={`font-bold text-sm shrink-0 ml-2 ${healthColor(rc.healthPct)}`}>{formatPct(rc.healthPct)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                        <div className={`h-full rounded-full ${barColor(rc.healthPct)}`} style={{ width: `${Math.min(rc.healthPct, 100)}%` }} />
                      </div>
                      <div className="flex gap-2 mt-1 text-[10px]">
                        <span className="text-[oklch(0.45_0.2_155)]">✅{Number(sc.ativo||0)}</span>
                        <span className="text-[oklch(0.4_0.15_260)]">🎯{Number(sc.em_acao||0)}</span>
                        <span className="text-[oklch(0.4_0.15_170)]">🛒{Number(sc.pedido_na_tela||0)}</span>
                        <span className="text-muted-foreground">|</span>
                        <span className="text-[oklch(0.5_0.15_250)]">🔄{Number(sc.em_ciclo||0)}</span>
                        <span className="text-[oklch(0.6_0.18_55)]">⚠️{Number(sc.alerta||0)}</span>
                         <span className="text-[oklch(0.5_0.18_310)]">🟣{Number(sc.pre_inativacao||0)}</span>
                         <span className="text-destructive">❌{Number(sc.inativo||0)}</span>
                        <span className="text-muted-foreground ml-auto">{rc.total}</span>
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>

                  {/* Expanded extract buttons */}
                  {isExpanded && (
                    <div className="flex flex-wrap gap-1.5 mt-2 pl-8">
                      {["alerta", "pre_inativacao", "inativo", "em_ciclo", "em_acao", "pedido_na_tela", "ativo"].map(status => {
                         const count = Number(sc[status] || 0);
                         if (count === 0) return null;
                        return (
                          <Button
                            key={status}
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] px-2 gap-1"
                            onClick={(e) => { e.stopPropagation(); onExtract(rc.repCode, rc.repName, status); }}
                          >
                            <Share2 className="h-3 w-3" />
                            {STATUS_LABELS[status]} ({count})
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground px-1">
        <span>✅ Ativos</span>
        <span>🎯 Em Ação</span>
        <span>🛒 Pedido na Tela</span>
        <span>🔄 Em Ciclo</span>
        <span>⚠️ Alerta</span>
        <span>🟣 Pré-Inativação</span>
        <span>❌ Inativos</span>
      </div>
    </div>
  );
}

// ---- Extract Dialog ----
function ExtractDialog({ open, onClose, repCode, repName, status }: {
  open: boolean; onClose: () => void; repCode: string; repName: string; status: string;
}) {
  const { data: clients, isLoading } = trpc.clients.list.useQuery(
    { statusFilter: status, repCodeFilter: repCode },
    { enabled: open, staleTime: 30000 }
  );

  const formattedText = useMemo(() => {
    if (!clients || clients.length === 0) return "";
    const header = `📋 *${STATUS_LABELS[status] || status}* — ${repName}\n${clients.length} cliente(s)\n${"─".repeat(30)}\n`;
    const lines = clients.map((c: any, i: number) => {
      const parts = [
        `${i + 1}. *${c.clientName}*`,
        `   📍 ${c.clientCity || "—"}${c.clientState ? ` / ${c.clientState}` : ""}`,
        `   🏷️ SAP: ${c.clientCodeSAP}`,
        `   📅 Última compra: ${formatDate(c.lastPurchaseDate)}`,
        `   🔄 Ciclo: ${c.avgDaysBetweenPurchases}d | ${c.daysSinceLastPurchase}d sem compra`,
      ];
      if (c.manualStatus === "em_acao" && c.manualNote) {
        const dateStr = c.manualStatusDate ? new Date(c.manualStatusDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
        parts.push(`   💬 Ação${dateStr ? ` em ${dateStr}` : ""}: ${c.manualNote}`);
      } else if (c.manualStatus === "pedido_na_tela") {
        const dateStr = c.manualStatusDate ? ` em ${formatDate(c.manualStatusDate)}` : "";
        parts.push(`   🛒 Pedido na Tela${dateStr}${c.manualNote ? ` — ${c.manualNote}` : ""}`);
      }
      return parts.join("\n");
    });
    return header + lines.join("\n\n");
  }, [clients, repName, status]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedText);
      toast.success("Lista copiada! Cole no WhatsApp.");
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = formattedText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success("Lista copiada! Cole no WhatsApp.");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: formattedText });
      } catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            Extrair {STATUS_LABELS[status]} — {repName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : !clients || clients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente com este status</p>
        ) : (
          <>
            <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-[50vh] overflow-y-auto leading-relaxed">
              {formattedText}
            </div>
            <p className="text-[10px] text-muted-foreground">{clients.length} cliente(s) encontrado(s)</p>
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {clients && clients.length > 0 && (
            <>
              <Button variant="outline" onClick={handleCopy} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </Button>
              <Button onClick={handleShare} className="gap-1.5">
                <Share2 className="h-3.5 w-3.5" />
                Compartilhar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Order Product Detail (expandable within each order) ----
function OrderProductDetail({ orderCode, clientCodeSAP, repCode }: { orderCode: string; clientCodeSAP: string; repCode: string }) {
  const { data: products, isLoading } = trpc.clients.orderProductDetails.useQuery(
    { orderCode, clientCodeSAP, repCode },
    { staleTime: 60000 }
  );

  if (isLoading) return <Skeleton className="h-12 w-full rounded" />;
  if (!products || products.length === 0) return <p className="text-[10px] text-muted-foreground py-1">Sem detalhes</p>;

  return (
    <div className="mt-2 border-t pt-2">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left py-1 font-medium">Produto</th>
            <th className="text-right py-1 font-medium">KG</th>
            <th className="text-right py-1 font-medium">R$</th>
            <th className="text-right py-1 font-medium">R$/KG</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p: any, idx: number) => (
            <tr key={idx} className="border-b last:border-0">
              <td className="py-1 truncate max-w-[120px]">{p.productName}</td>
              <td className="py-1 text-right font-medium">{formatKg(Number(p.kg))}</td>
              <td className="py-1 text-right">{formatCurrency(Number(p.revenue))}</td>
              <td className="py-1 text-right font-medium text-primary">{formatCurrency(Number(p.pricePerKg))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Client Detail Drawer (Last Orders + Product Breakdown) ----
function ClientDetailPanel({ client, onClose }: { client: any; onClose: () => void }) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const { data: lastOrders, isLoading: loadingOrders } = trpc.clients.lastOrders.useQuery(
    { clientCodeSAP: client.clientCodeSAP, repCode: client.repCode, limit: 6 },
    { staleTime: 60000 }
  );
  const { data: products, isLoading: loadingProducts } = trpc.clients.productBreakdown.useQuery(
    { clientCodeSAP: client.clientCodeSAP, repCode: client.repCode },
    { staleTime: 60000 }
  );

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <span className="truncate">{client.clientName}</span>
            <StatusBadge status={client.status} manualStatus={client.manualStatus} />
          </DialogTitle>
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {client.clientCity}{client.clientState ? ` / ${client.clientState}` : ""}
              {client.repName && <span className="ml-2">| RC: {client.repName}</span>}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              <span>SAP: <span className="font-medium text-foreground">{client.clientCodeSAP}</span></span>
            </div>
            {client.salesChannel && (
              <SalesChannelBadge channel={client.salesChannel} size="md" />
            )}
          </div>
        </DialogHeader>

        {/* Summary metrics */}
        <div className="grid grid-cols-3 gap-2 my-2">
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-medium">Ciclo Médio</p>
            <p className="text-sm font-bold mt-0.5">{client.avgDaysBetweenPurchases}d</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-medium">Vol. Médio</p>
            <p className="text-sm font-bold mt-0.5">{formatKg(client.avgKgPerOrder)} kg</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-medium">Dias s/ Compra</p>
            <p className={`text-sm font-bold mt-0.5 ${client.daysSinceLastPurchase > 150 ? "text-destructive" : ""}`}>
              {client.daysSinceLastPurchase}d
            </p>
          </div>
        </div>

        <Tabs defaultValue="orders" className="mt-1">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="orders" className="text-xs">
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              Últimos Pedidos
            </TabsTrigger>
            <TabsTrigger value="products" className="text-xs">
              <Package className="h-3.5 w-3.5 mr-1.5" />
              Produtos
            </TabsTrigger>
          </TabsList>

          {/* Last Orders Tab */}
          <TabsContent value="orders" className="mt-3 space-y-2">
            {loadingOrders ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
            ) : !lastOrders || lastOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido encontrado</p>
            ) : (
              lastOrders.map((order: any, idx: number) => {
                const isExpanded = expandedOrder === order.orderCode;
                return (
                  <Card key={idx} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="cursor-pointer" onClick={() => setExpandedOrder(isExpanded ? null : order.orderCode)}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{idx + 1}</span>
                            <span className="text-xs font-medium">Pedido #{order.orderCode}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{formatDate(order.orderDate)}</span>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div className="flex items-center gap-1.5">
                            <Weight className="h-3 w-3 text-muted-foreground" />
                            <div>
                              <p className="text-[10px] text-muted-foreground">Volume</p>
                              <p className="text-xs font-semibold">{formatKg(Number(order.totalKg))} kg</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <div>
                              <p className="text-[10px] text-muted-foreground">Receita</p>
                              <p className="text-xs font-semibold">{formatCurrency(Number(order.totalRevenue))}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Hash className="h-3 w-3 text-muted-foreground" />
                            <div>
                              <p className="text-[10px] text-muted-foreground">Itens</p>
                              <p className="text-xs font-semibold">{Number(order.itemCount)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <OrderProductDetail orderCode={order.orderCode} clientCodeSAP={client.clientCodeSAP} repCode={client.repCode} />
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-3">
            {loadingProducts ? (
              <Skeleton className="h-32 w-full rounded-lg" />
            ) : !products || products.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Produto</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">KG</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">R$</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">R$/KG</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground hidden sm:table-cell">Pedidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((prod: any, idx: number) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-2 px-2">
                          <div className="font-medium truncate max-w-[140px]">{prod.productName}</div>
                          {prod.productCategory && <div className="text-[10px] text-muted-foreground">{prod.productCategory}</div>}
                        </td>
                        <td className="py-2 px-2 text-right font-semibold">{formatKg(Number(prod.totalKg))}</td>
                        <td className="py-2 px-2 text-right">{formatCurrency(Number(prod.totalRevenue))}</td>
                        <td className="py-2 px-2 text-right font-medium text-primary">{formatCurrency(Number(prod.pricePerKg))}</td>
                        <td className="py-2 px-2 text-right hidden sm:table-cell">{Number(prod.orderCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30 font-semibold">
                      <td className="py-2 px-2">Total</td>
                      <td className="py-2 px-2 text-right">{formatKg(products.reduce((s: number, p: any) => s + Number(p.totalKg || 0), 0))}</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(products.reduce((s: number, p: any) => s + Number(p.totalRevenue || 0), 0))}</td>
                      <td className="py-2 px-2 text-right text-primary">
                        {(() => {
                          const totalKg = products.reduce((s: number, p: any) => s + Number(p.totalKg || 0), 0);
                          const totalRev = products.reduce((s: number, p: any) => s + Number(p.totalRevenue || 0), 0);
                          return totalKg > 0 ? formatCurrency(totalRev / totalKg) : "—";
                        })()}
                      </td>
                      <td className="py-2 px-2 text-right hidden sm:table-cell">{products.reduce((s: number, p: any) => s + Number(p.orderCount || 0), 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---- Main Page ----
export default function ClientsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState<string>(isAdmin ? "ranking" : "lista");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [repCodeFilter, setRepCodeFilter] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [detailClient, setDetailClient] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState(false);
  const [actionType, setActionType] = useState<string>("");
  const [actionNote, setActionNote] = useState("");

  // Extract dialog state
  const [extractOpen, setExtractOpen] = useState(false);
  const [extractRepCode, setExtractRepCode] = useState("");
  const [extractRepName, setExtractRepName] = useState("");
  const [extractStatus, setExtractStatus] = useState("");

  const { data: repOptions } = trpc.profile.getRepOptions.useQuery(undefined, {
    enabled: isAdmin,
    staleTime: 300000,
  });

  const { data: filters } = trpc.products.filters.useQuery(undefined, { staleTime: 300000 });

  const { data: clients, isLoading, refetch } = trpc.clients.list.useQuery(
    { statusFilter, repCodeFilter: repCodeFilter || undefined, channelFilter: channelFilter || undefined },
    { staleTime: 60000 }
  );

  // Fetch all clients (unfiltered by status) to compute status counts for badges
  const { data: allClients } = trpc.clients.list.useQuery(
    { statusFilter: "todos", repCodeFilter: repCodeFilter || undefined, channelFilter: channelFilter || undefined },
    { staleTime: 120000 }
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: 0, em_ciclo: 0, ativo: 0, alerta: 0, pre_inativacao: 0, inativo: 0, em_acao: 0, pedido_na_tela: 0 };
    if (!allClients) return counts;
    for (const c of allClients) {
      counts.todos++;
      if (c.manualStatus === "em_acao") counts.em_acao++;
      else if (c.manualStatus === "pedido_na_tela") counts.pedido_na_tela++;
      if (c.status) counts[c.status] = (counts[c.status] || 0) + 1;
    }
    return counts;
  }, [allClients]);

  const setActionMutation = trpc.clients.setAction.useMutation({
    onSuccess: () => {
      toast.success("Ação registrada com sucesso");
      setActionDialog(false);
      setActionNote("");
      setActionType("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!searchQuery) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c =>
      c.clientName.toLowerCase().includes(q) ||
      c.clientCity?.toLowerCase().includes(q) ||
      c.clientCodeSAP?.toLowerCase().includes(q) ||
      c.repName?.toLowerCase().includes(q)
    );
  }, [clients, searchQuery]);

  const handleAction = (client: any, type: string) => {
    setSelectedClient(client);
    setActionType(type);
    setActionNote("");
    setActionDialog(true);
  };

  const submitAction = () => {
    if (!selectedClient || !actionType) return;
    setActionMutation.mutate({
      clientCodeSAP: selectedClient.clientCodeSAP,
      clientName: selectedClient.clientName,
      repCode: selectedClient.repCode,
      actionType: actionType as any,
      note: actionNote || undefined,
      previousStatus: selectedClient.manualStatus || selectedClient.status,
    });
  };

  const handleExtract = (repCode: string, repName: string, status: string) => {
    setExtractRepCode(repCode);
    setExtractRepName(repName);
    setExtractStatus(status);
    setExtractOpen(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Clientes</h1>
        <p className="text-sm text-muted-foreground">Gestão de carteira por representante</p>
      </div>

      {isAdmin && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="ranking" className="text-xs">
              <Trophy className="h-3.5 w-3.5 mr-1.5" />
              Ranking Saúde
            </TabsTrigger>
            <TabsTrigger value="lista" className="text-xs">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Lista de Clientes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ranking" className="mt-4">
            <HealthRankingSection onExtract={handleExtract} />
          </TabsContent>

          <TabsContent value="lista" className="mt-4">
            <ClientListSection
              isAdmin={isAdmin}
              repOptions={repOptions}
              repCodeFilter={repCodeFilter}
              setRepCodeFilter={setRepCodeFilter}
              channelFilter={channelFilter}
              setChannelFilter={setChannelFilter}
              channelOptions={filters?.channels || []}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              clients={filteredClients}
              isLoading={isLoading}
              onAction={handleAction}
              onOpenDetail={setDetailClient}
              onExtract={handleExtract}
              statusCounts={statusCounts}
            />
          </TabsContent>
        </Tabs>
      )}

      {!isAdmin && (
        <ClientListSection
          isAdmin={false}
          repOptions={undefined}
          repCodeFilter={repCodeFilter}
          setRepCodeFilter={setRepCodeFilter}
          channelFilter={channelFilter}
          setChannelFilter={setChannelFilter}
          channelOptions={filters?.channels || []}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          clients={filteredClients}
          isLoading={isLoading}
          onAction={handleAction}
          onOpenDetail={setDetailClient}
          statusCounts={statusCounts}
        />
      )}

      {detailClient && (
        <ClientDetailPanel client={detailClient} onClose={() => setDetailClient(null)} />
      )}

      {/* Extract Dialog for WhatsApp */}
      <ExtractDialog
        open={extractOpen}
        onClose={() => setExtractOpen(false)}
        repCode={extractRepCode}
        repName={extractRepName}
        status={extractStatus}
      />

      {/* Action Dialog */}
      <Dialog open={actionDialog} onOpenChange={setActionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {actionType === "em_acao" ? "Marcar como Em Ação" :
               actionType === "pedido_na_tela" ? "Registrar Pedido na Tela" :
               actionType === "reset" ? "Resetar Status" :
               actionType === "excluido" ? "Excluir do Acompanhamento" : "Ação"}
            </DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-medium">{selectedClient.clientName}</span>
                <span className="text-muted-foreground ml-2">{selectedClient.clientCity}</span>
                <span className="text-[10px] text-muted-foreground ml-2">SAP: {selectedClient.clientCodeSAP}</span>
              </div>
              <Textarea
                placeholder={actionType === "em_acao" ? "Descreva a ação (ex: agendado visita para 25/02)..." : "Observação (opcional)..."}
                value={actionNote}
                onChange={e => setActionNote(e.target.value)}
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(false)}>Cancelar</Button>
            <Button onClick={submitAction} disabled={setActionMutation.isPending}>
              {setActionMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Client List Section ----
function ClientListSection({
  isAdmin, repOptions, repCodeFilter, setRepCodeFilter,
  channelFilter, setChannelFilter, channelOptions,
  statusFilter, setStatusFilter, searchQuery, setSearchQuery,
  clients, isLoading, onAction, onOpenDetail, onExtract, statusCounts,
}: {
  isAdmin: boolean;
  repOptions: any;
  repCodeFilter: string;
  setRepCodeFilter: (v: string) => void;
  channelFilter: string;
  setChannelFilter: (v: string) => void;
  channelOptions: string[];
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  searchQuery: string;
  statusCounts: Record<string, number>;
  setSearchQuery: (v: string) => void;
  clients: any[];
  isLoading: boolean;
  onAction: (client: any, type: string) => void;
  onOpenDetail: (client: any) => void;
  onExtract?: (repCode: string, repName: string, status: string) => void;
}) {
  return (
    <div className="space-y-4">
      {isAdmin && repOptions && repOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={repCodeFilter || "all"} onValueChange={(v) => setRepCodeFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 text-xs w-full max-w-xs">
              <SelectValue placeholder="Filtrar por Representante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Representantes</SelectItem>
              {repOptions.map((rep: any) => (
                <SelectItem key={rep.repCode} value={rep.repCode}>
                  {rep.repName} ({rep.repCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Channel Filter */}
      {channelOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={channelFilter || "all"} onValueChange={(v) => setChannelFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 text-xs w-full max-w-xs">
              <SelectValue placeholder="Filtrar por Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Canais</SelectItem>
              {channelOptions.map((ch: string) => (
                <SelectItem key={ch} value={ch}>{ch}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {STATUS_TABS.map(tab => {
          const count = statusCounts[tab.value] || 0;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                statusFilter === tab.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none ${
                  statusFilter === tab.value
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-primary/10 text-primary"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, cidade, SAP ou RC..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        {/* Extract button in list view — only if a specific RC and status is selected */}
        {isAdmin && onExtract && repCodeFilter && statusFilter !== "todos" && (
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-1.5 shrink-0"
            onClick={() => {
              const rep = repOptions?.find((r: any) => r.repCode === repCodeFilter);
              onExtract(repCodeFilter, rep?.repName || repCodeFilter, statusFilter);
            }}
          >
            <Share2 className="h-3.5 w-3.5" />
            Extrair
          </Button>
        )}
      </div>

      {!isLoading && (
        <p className="text-xs text-muted-foreground">
          {clients.length} cliente{clients.length !== 1 ? "s" : ""} encontrado{clients.length !== 1 ? "s" : ""}
        </p>
      )}

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <div className="flex gap-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-24" /></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : clients.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Nenhum cliente encontrado</p>
            </CardContent>
          </Card>
        ) : (
          clients.map(client => (
            <Card
              key={`${client.clientCodeSAP}-${client.repCode}`}
              className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onOpenDetail(client)}
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm leading-tight truncate">{client.clientName}</h3>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{client.clientCity || "—"}{client.clientState ? ` / ${client.clientState}` : ""}</span>
                        {isAdmin && client.repName && (
                          <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{client.repName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                        <FileText className="h-2.5 w-2.5 shrink-0" />
                        SAP: {client.clientCodeSAP}
                      </div>
                      {client.salesChannel && (
                        <SalesChannelBadge channel={client.salesChannel} />
                      )}
                    </div>
                    <StatusBadge status={client.status} manualStatus={client.manualStatus} />
                  </div>

                  {/* Manual action note visible on card */}
                  {client.manualStatus === "em_acao" && client.manualNote && (
                    <div className="text-xs bg-[oklch(0.95_0.03_260)] text-[oklch(0.35_0.1_260)] rounded-md px-2.5 py-1.5 leading-relaxed">
                      Em ação: {client.manualNote}
                    </div>
                  )}

                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Última:</span>
                      <span className="font-medium">{formatDate(client.lastPurchaseDate)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Ciclo:</span>
                      <span className="font-medium">{client.avgDaysBetweenPurchases}d</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Vol. médio:</span>
                      <span className="font-medium">{formatKg(client.avgKgPerOrder)} kg</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-medium ml-[18px] ${client.daysSinceLastPurchase > 150 ? "text-destructive" : client.daysSinceLastPurchase > 120 ? "text-[oklch(0.7_0.18_55)]" : "text-muted-foreground"}`}>
                        {client.daysSinceLastPurchase}d sem compra
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                    {(!client.manualStatus || client.manualStatus === "reset") && (
                      <>
                        <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={() => onAction(client, "em_acao")}>
                          <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />
                          Em Ação
                        </Button>
                        <Button size="sm" className="h-8 text-xs flex-1 bg-[oklch(0.55_0.15_170)] hover:bg-[oklch(0.5_0.15_170)]" onClick={() => onAction(client, "pedido_na_tela")}>
                          <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                          Pedido na Tela
                        </Button>
                      </>
                    )}
                    {client.manualStatus === "em_acao" && (
                      <Button size="sm" className="h-8 text-xs flex-1 bg-[oklch(0.55_0.15_170)] hover:bg-[oklch(0.5_0.15_170)]" onClick={() => onAction(client, "pedido_na_tela")}>
                        <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                        Pedido na Tela
                      </Button>
                    )}
                    {client.manualStatus && client.manualStatus !== "reset" && (
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onAction(client, "reset")}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Reset
                      </Button>
                    )}
                    {client.clientPhone && (
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => window.open(`tel:${client.clientPhone}`, "_self")}>
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
