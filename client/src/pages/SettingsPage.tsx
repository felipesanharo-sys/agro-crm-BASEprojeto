import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useState } from "react";
import { Settings, Users, Target } from "lucide-react";

export default function ConfigPage() {
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return <div className="flex items-center justify-center h-[60vh]"><p className="text-muted-foreground">Acesso restrito a gestores.</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />Configurações
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Prepostos, metas e extração de anotações</p>
      </div>

      <Tabs defaultValue="prepostos">
        <TabsList>
          <TabsTrigger value="prepostos"><Users className="h-3.5 w-3.5 mr-1.5" />Prepostos</TabsTrigger>
          <TabsTrigger value="metas"><Target className="h-3.5 w-3.5 mr-1.5" />Metas</TabsTrigger>
          <TabsTrigger value="anotacoes">Anotações</TabsTrigger>
        </TabsList>

        <TabsContent value="prepostos" className="mt-4"><PrepostosTab /></TabsContent>
        <TabsContent value="metas" className="mt-4"><MetasTab /></TabsContent>
        <TabsContent value="anotacoes" className="mt-4"><AnotacoesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function PrepostosTab() {
  const [repCode, setRepCode] = useState("");
  const [repName, setRepName] = useState("");
  const [alias, setAlias] = useState("");
  const [parentRepCode, setParentRepCode] = useState("");
  const utils = trpc.useUtils();

  const aliasesQuery = trpc.admin.repAliases.useQuery();
  const upsertMutation = trpc.admin.upsertRepAlias.useMutation({
    onSuccess: () => { toast.success("Preposto salvo"); utils.admin.repAliases.invalidate(); setRepCode(""); setRepName(""); setAlias(""); setParentRepCode(""); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="border shadow-sm">
      <CardHeader><CardTitle className="text-base">Grupos de Representantes (Prepostos)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><Label className="text-xs">Código RC</Label><Input value={repCode} onChange={e => setRepCode(e.target.value)} placeholder="Ex: 12345" className="mt-1" /></div>
          <div><Label className="text-xs">Nome RC</Label><Input value={repName} onChange={e => setRepName(e.target.value)} placeholder="Nome" className="mt-1" /></div>
          <div><Label className="text-xs">Apelido</Label><Input value={alias} onChange={e => setAlias(e.target.value)} placeholder="Apelido" className="mt-1" /></div>
          <div><Label className="text-xs">RC Pai (grupo)</Label><Input value={parentRepCode} onChange={e => setParentRepCode(e.target.value)} placeholder="Código pai" className="mt-1" /></div>
        </div>
        <Button onClick={() => upsertMutation.mutate({ repCode, repName, alias, parentRepCode: parentRepCode || undefined })} disabled={!repCode || !repName || !alias}>
          Salvar Preposto
        </Button>

        {aliasesQuery.isLoading ? <Skeleton className="h-32" /> : (
          <div className="space-y-2 mt-4">
            {(aliasesQuery.data || []).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">{a.alias} ({a.repCode})</p>
                  <p className="text-xs text-muted-foreground">{a.repName} {a.parentRepCode ? `| Pai: ${a.parentRepCode}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetasTab() {
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [repCode, setRepCode] = useState("");
  const [goalKg, setGoalKg] = useState("");
  const utils = trpc.useUtils();

  const goalsQuery = trpc.admin.salesGoals.useQuery({ yearMonth });
  const upsertMutation = trpc.admin.upsertSalesGoal.useMutation({
    onSuccess: () => { toast.success("Meta salva"); utils.admin.salesGoals.invalidate(); setRepCode(""); setGoalKg(""); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="border shadow-sm">
      <CardHeader><CardTitle className="text-base">Metas de Vendas (KG)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end flex-wrap">
          <div><Label className="text-xs">Mês</Label><Input value={yearMonth} onChange={e => setYearMonth(e.target.value)} placeholder="2025.03" className="mt-1 w-32" /></div>
          <div><Label className="text-xs">Código RC</Label><Input value={repCode} onChange={e => setRepCode(e.target.value)} placeholder="RC" className="mt-1 w-32" /></div>
          <div><Label className="text-xs">Meta KG</Label><Input value={goalKg} onChange={e => setGoalKg(e.target.value)} placeholder="KG" className="mt-1 w-32" /></div>
          <Button onClick={() => upsertMutation.mutate({ repCode, yearMonth, goalKg })} disabled={!repCode || !goalKg}>Salvar</Button>
        </div>

        {goalsQuery.isLoading ? <Skeleton className="h-32" /> : (
          <div className="space-y-2">
            {(goalsQuery.data || []).map((g: any) => (
              <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border">
                <p className="text-sm font-medium">RC: {g.repCode}</p>
                <p className="text-sm font-semibold">{Number(g.goalKg).toLocaleString("pt-BR")} kg</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AnotacoesTab() {
  const [repCode, setRepCode] = useState("");
  const annotationsQuery = trpc.admin.annotationsExport.useQuery({ repCode: repCode || undefined });

  const exportCsv = () => {
    if (!annotationsQuery.data) return;
    const rows = annotationsQuery.data as any[];
    if (rows.length === 0) { toast.info("Sem anotações"); return; }
    const headers = ["Cliente", "SAP", "RC", "Tipo", "Nota", "Data"];
    const csv = [headers.join(","), ...rows.map((r: any) =>
      [r.clientCodeSAP, r.clientCodeSAP, r.repCode, r.actionType, `"${(r.note || "").replace(/"/g, '""')}"`, new Date(r.createdAt).toLocaleDateString("pt-BR")].join(",")
    )].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `anotacoes_${repCode || "todos"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader><CardTitle className="text-base">Extração de Anotações</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div><Label className="text-xs">Filtrar por RC (opcional)</Label><Input value={repCode} onChange={e => setRepCode(e.target.value)} placeholder="Código RC" className="mt-1 w-40" /></div>
          <Button onClick={exportCsv} disabled={annotationsQuery.isLoading}>Exportar CSV</Button>
        </div>
        {annotationsQuery.isLoading ? <Skeleton className="h-20" /> : (
          <p className="text-sm text-muted-foreground">{(annotationsQuery.data || []).length} anotações encontradas</p>
        )}
      </CardContent>
    </Card>
  );
}
