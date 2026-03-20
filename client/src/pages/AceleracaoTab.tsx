import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo, useState } from "react";
import { Rocket, Search, ChevronRight } from "lucide-react";

function formatKg(val: number) { return val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val.toFixed(0); }

export default function AceleracaoPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedRepCode, setSelectedRepCode] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [detailGroup, setDetailGroup] = useState<string | null>(null);

  const repsQuery = trpc.repAliases.list.useQuery();
  const repCode = isAdmin ? selectedRepCode : undefined;
  const dataQuery = trpc.aceleracao.summary.useQuery({ repCodeFilter: repCode });
  const monthlyQuery = trpc.aceleracao.monthly.useQuery(
    { groupCode: detailGroup!, repCodeFilter: repCode },
    { enabled: !!detailGroup }
  );

  const filtered = useMemo(() => {
    if (!dataQuery.data) return [];
    let list = dataQuery.data as any[];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((d: any) => d.clientParentName?.toLowerCase().includes(s) || d.clientGroupCodeSAP?.includes(s));
    }
    return list.sort((a: any, b: any) => Number(b.totalKg) - Number(a.totalKg));
  }, [dataQuery.data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />Aceleração
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Volume acumulado por revenda no ciclo</p>
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por revenda ou código..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card className="border shadow-sm">
        <CardHeader><CardTitle className="text-base">Revendas ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {dataQuery.isLoading ? <Skeleton className="h-48" /> : (
            <div className="space-y-2">
              {filtered.map((d: any, i: number) => (
                <div key={`${d.clientGroupCodeSAP}-${i}`}
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setDetailGroup(d.clientGroupCodeSAP)}>
                  <span className="text-sm font-bold text-muted-foreground w-8">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.clientParentName || d.clientName}</p>
                    <p className="text-xs text-muted-foreground">Grupo: {d.clientGroupCodeSAP} | {d.repName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatKg(Number(d.totalKg))} kg</p>
                    <p className="text-xs text-muted-foreground">R$ {Number(d.totalRevenue).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              ))}
              {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma revenda encontrada</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Detail Dialog */}
      <Dialog open={!!detailGroup} onOpenChange={() => setDetailGroup(null)}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader><DialogTitle>Detalhamento Mensal - Grupo {detailGroup}</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {monthlyQuery.isLoading ? <Skeleton className="h-32" /> : (
              <div className="space-y-2">
                {(monthlyQuery.data || []).map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{m.yearMonth?.replace(".", "/")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatKg(Number(m.totalKg))} kg</p>
                      <p className="text-xs text-muted-foreground">R$ {Number(m.totalRevenue).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                ))}
                {(monthlyQuery.data || []).length === 0 && <p className="text-center text-muted-foreground py-4">Sem dados</p>}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
