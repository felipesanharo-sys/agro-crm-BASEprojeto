import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, MapPin, Package, Calendar, Users, ArrowLeft, DollarSign, Weight, ChevronRight } from "lucide-react";

const formatKg = (kg: number) => Number(kg).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const formatCurrency = (v: number) => (!v ? "R$ 0" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const formatDate = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

// ---- Product aggregation: group by product name ----
function aggregateProducts(items: any[]) {
  const map = new Map<string, { productName: string; productCategory: string; totalKg: number; totalRevenue: number; orderCount: number; lastSale: string | null; clientCount: number; clients: Set<string> }>();
  for (const item of items) {
    const key = item.productName;
    const existing = map.get(key);
    if (existing) {
      existing.totalKg += Number(item.totalKg) || 0;
      existing.totalRevenue += Number(item.totalRevenue) || 0;
      existing.orderCount += Number(item.orderCount) || 0;
      if (item.lastSale && (!existing.lastSale || new Date(item.lastSale) > new Date(existing.lastSale))) {
        existing.lastSale = item.lastSale;
      }
      existing.clients.add(item.clientCodeSAP);
      existing.clientCount = existing.clients.size;
    } else {
      const clients = new Set<string>();
      clients.add(item.clientCodeSAP);
      map.set(key, {
        productName: item.productName,
        productCategory: item.productCategory || "",
        totalKg: Number(item.totalKg) || 0,
        totalRevenue: Number(item.totalRevenue) || 0,
        orderCount: Number(item.orderCount) || 0,
        lastSale: item.lastSale,
        clientCount: 1,
        clients,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalKg - a.totalKg);
}

// ---- Clients by Product Dialog ----
function ClientsByProductDialog({ productName, onClose }: { productName: string; onClose: () => void }) {
  const { data: clients, isLoading } = trpc.products.clientsByProduct.useQuery(
    { productName },
    { staleTime: 60000 }
  );

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="truncate">{productName}</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Clientes que compraram este produto</p>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : !clients || clients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente encontrado</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">{clients.length} cliente{clients.length !== 1 ? "s" : ""}</p>
            {/* Summary header */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Clientes</p>
                <p className="text-sm font-bold mt-0.5">{clients.length}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Total KG</p>
                <p className="text-sm font-bold mt-0.5 text-primary">{formatKg(clients.reduce((s: number, c: any) => s + Number(c.totalKg || 0), 0))}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Total R$</p>
                <p className="text-sm font-bold mt-0.5">{formatCurrency(clients.reduce((s: number, c: any) => s + Number(c.totalRevenue || 0), 0))}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-[10px] uppercase text-muted-foreground font-medium">R$/KG</p>
                <p className="text-sm font-bold mt-0.5">{(() => {
                  const totalKg = clients.reduce((s: number, c: any) => s + Number(c.totalKg || 0), 0);
                  const totalRev = clients.reduce((s: number, c: any) => s + Number(c.totalRevenue || 0), 0);
                  return totalKg > 0 ? formatCurrency(totalRev / totalKg) : "—";
                })()}</p>
              </div>
            </div>

            {/* Client list table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">KG</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">R$</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">R$/KG</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground hidden sm:table-cell">Pedidos</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground hidden sm:table-cell">Última</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c: any, idx: number) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 px-2">
                        <div className="font-medium truncate max-w-[160px]">{c.clientName}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5" />
                          {c.clientCity}{c.clientState ? ` / ${c.clientState}` : ""}
                        </div>
                        {c.repName && (
                          <div className="text-[10px] text-muted-foreground">RC: {c.repName}</div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold">{formatKg(Number(c.totalKg))}</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(Number(c.totalRevenue))}</td>
                      <td className="py-2 px-2 text-right font-medium text-primary">{formatCurrency(Number(c.pricePerKg))}</td>
                      <td className="py-2 px-2 text-right hidden sm:table-cell">{Number(c.orderCount)}</td>
                      <td className="py-2 px-2 text-right hidden sm:table-cell">{formatDate(c.lastPurchaseDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- Main Page ----
export default function ProductsPage() {
  const [productFilter, setProductFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("");
  const [microRegionFilter, setMicroRegionFilter] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const { data: filters } = trpc.products.filters.useQuery();
  const { data: products, isLoading } = trpc.products.list.useQuery({
    product: productFilter || undefined,
    channel: channelFilter !== "all" ? channelFilter : undefined,
    city: cityFilter || undefined,
    microRegion: microRegionFilter !== "all" ? microRegionFilter : undefined,
  }, { staleTime: 60000 });

  const aggregated = useMemo(() => {
    if (!products) return [];
    return aggregateProducts(products as any[]);
  }, [products]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Produtos</h1>
        <p className="text-sm text-muted-foreground">Análise de vendas por produto — clique para ver os clientes</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={productFilter} onChange={e => setProductFilter(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Canal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            {filters?.channels?.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cidade..." value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={microRegionFilter} onValueChange={setMicroRegionFilter}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Microrregião" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas microrregiões</SelectItem>
            {filters?.microRegions?.map((m: string) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && (
        <p className="text-xs text-muted-foreground">{aggregated.length} produto{aggregated.length !== 1 ? "s" : ""}</p>
      )}

      {/* Product results */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : !aggregated.length ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum resultado encontrado</CardContent></Card>
        ) : (
          aggregated.map((item, i) => {
            const pricePerKg = item.totalKg > 0 ? item.totalRevenue / item.totalKg : 0;
            return (
              <Card
                key={i}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedProduct(item.productName)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{item.productName}</span>
                        {item.productCategory && (
                          <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">{item.productCategory}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {item.clientCount} cliente{item.clientCount !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {item.orderCount} pedido{item.orderCount > 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(item.lastSale)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1">
                          <Weight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-semibold text-primary">{formatKg(item.totalKg)} kg</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{formatCurrency(item.totalRevenue)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          R$/KG: <span className="font-medium text-foreground">{formatCurrency(pricePerKg)}</span>
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Client by product dialog */}
      {selectedProduct && (
        <ClientsByProductDialog productName={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}
