import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo, useState } from "react";
import { Package, Search, ChevronRight } from "lucide-react";

function formatKg(val: number) { return val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val.toFixed(0); }

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedRepCode, setSelectedRepCode] = useState<string | undefined>(undefined);
  const [channelFilter, setChannelFilter] = useState<string | undefined>(undefined);
  const [cityFilter, setCityFilter] = useState<string | undefined>(undefined);
  const [microRegionFilter, setMicroRegionFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const repsQuery = trpc.repAliases.list.useQuery();
  const repCode = isAdmin ? selectedRepCode : undefined;
  const filtersQuery = trpc.products.filters.useQuery();
  const analysisQuery = trpc.products.list.useQuery({
    channel: channelFilter, city: cityFilter, microRegion: microRegionFilter,
  });
  const clientsQuery = trpc.products.clientsByProduct.useQuery(
    { productName: selectedProduct! },
    { enabled: !!selectedProduct }
  );

  const filtered = useMemo(() => {
    if (!analysisQuery.data) return [];
    let list = analysisQuery.data as any[];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((p: any) => p.productName?.toLowerCase().includes(s));
    }
    return list.sort((a: any, b: any) => Number(b.totalKg) - Number(a.totalKg));
  }, [analysisQuery.data, search]);

  const filters = filtersQuery.data || { channels: [], cities: [], microRegions: [] };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />Produtos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Análise de volume, preço médio e clientes por produto</p>
        </div>
        {isAdmin && repsQuery.data && (
          <Select value={selectedRepCode || "all"} onValueChange={(v) => setSelectedRepCode(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos os RCs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os RCs</SelectItem>
              {repsQuery.data.map((r: any) => <SelectItem key={r.repCode} value={r.repCode}>{r.alias || r.repName}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={channelFilter || "all"} onValueChange={(v) => setChannelFilter(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Canal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Canais</SelectItem>
            {(filters.channels || []).map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cityFilter || "all"} onValueChange={(v) => setCityFilter(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Cidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Cidades</SelectItem>
            {(filters.cities || []).map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={microRegionFilter || "all"} onValueChange={(v) => setMicroRegionFilter(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Microrregião" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Microrregiões</SelectItem>
            {(filters.microRegions || []).map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card className="border shadow-sm">
        <CardHeader><CardTitle className="text-base">Produtos ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {analysisQuery.isLoading ? <Skeleton className="h-48" /> : (
            <div className="space-y-2">
              {filtered.map((p: any, i: number) => {
                const pricePerKg = Number(p.totalKg) > 0 ? Number(p.totalRevenue) / Number(p.totalKg) : 0;
                return (
                  <div key={`${p.productName}-${i}`}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedProduct(p.productName)}>
                    <span className="text-sm font-bold text-muted-foreground w-8">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.productName}</p>
                      <p className="text-xs text-muted-foreground">{p.clientCount} clientes | R$ {pricePerKg.toFixed(2)}/kg</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatKg(Number(p.totalKg))} kg</p>
                      <p className="text-xs text-muted-foreground">R$ {Number(p.totalRevenue).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum produto encontrado</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Clients Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader><DialogTitle>Clientes - {selectedProduct}</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {clientsQuery.isLoading ? <Skeleton className="h-32" /> : (
              <div className="space-y-2">
                {(clientsQuery.data || []).map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{c.clientName}</p>
                      <p className="text-xs text-muted-foreground">{c.clientCity}/{c.clientState} - {c.repName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatKg(Number(c.totalKg))} kg</p>
                      <p className="text-xs text-muted-foreground">R$ {Number(c.totalRevenue).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                ))}
                {(clientsQuery.data || []).length === 0 && <p className="text-center text-muted-foreground py-4">Sem clientes</p>}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
