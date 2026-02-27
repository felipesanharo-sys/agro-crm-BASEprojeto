import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Settings, Download, FileSpreadsheet, User, Calendar } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [repCode, setRepCode] = useState("");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exportProduct, setExportProduct] = useState("");
  const [exportClient, setExportClient] = useState("");

  const { data: repOptions } = trpc.profile.getRepOptions.useQuery();
  const setRepMutation = trpc.profile.setRepCode.useMutation({
    onSuccess: () => {
      toast.success("Código do representante atualizado");
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: exportData, refetch: fetchExport, isFetching: exporting } = trpc.export.invoices.useQuery(
    {
      startDate: exportStartDate || undefined,
      endDate: exportEndDate || undefined,
      productName: exportProduct || undefined,
      clientCodeSAP: exportClient || undefined,
    },
    { enabled: false }
  );

  const handleExport = async () => {
    const result = await fetchExport();
    if (result.data && result.data.length > 0) {
      // Generate CSV
      const headers = Object.keys(result.data[0]);
      const csvRows = [
        headers.join(";"),
        ...result.data.map((row: any) =>
          headers.map(h => {
            let val = row[h];
            if (val instanceof Date) val = val.toISOString().split("T")[0];
            if (val === null || val === undefined) val = "";
            return `"${String(val).replace(/"/g, '""')}"`;
          }).join(";")
        ),
      ];
      const csvContent = "\uFEFF" + csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${result.data.length} registros exportados`);
    } else {
      toast.info("Nenhum dado encontrado com os filtros aplicados");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Perfil e exportação de dados</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <User className="h-4 w-4" />
            Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <p className="text-sm font-medium">{user?.name || "—"}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm font-medium">{user?.email || "—"}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Perfil</Label>
            <p className="text-sm font-medium">{user?.role === "admin" ? "Gestor" : "Representante Comercial"}</p>
          </div>
          {user?.role !== "admin" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Código do Representante</Label>
              <div className="flex gap-2">
                <Select value={repCode} onValueChange={setRepCode}>
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue placeholder="Selecione seu código" />
                  </SelectTrigger>
                  <SelectContent>
                    {repOptions?.map((r: any) => (
                      <SelectItem key={r.repCode} value={r.repCode}>
                        {r.repCode} — {r.repName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-9"
                  disabled={!repCode || setRepMutation.isPending}
                  onClick={() => setRepMutation.mutate({ repCode })}
                >
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar Relatório
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Data Início</Label>
              <Input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Data Fim</Label>
              <Input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="h-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Produto (opcional)</Label>
            <Input placeholder="Nome do produto..." value={exportProduct} onChange={e => setExportProduct(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Código SAP do Cliente (opcional)</Label>
            <Input placeholder="Código SAP..." value={exportClient} onChange={e => setExportClient(e.target.value)} className="h-9" />
          </div>
          <Button onClick={handleExport} disabled={exporting} className="w-full">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {exporting ? "Exportando..." : "Exportar CSV"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
