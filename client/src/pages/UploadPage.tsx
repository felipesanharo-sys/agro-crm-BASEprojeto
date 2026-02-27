import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Shield, Clock } from "lucide-react";

export default function UploadPage() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = trpc.upload.logs.useQuery(undefined, { staleTime: 30000 });
  const uploadMutation = trpc.upload.process.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setUploading(false);
      setProgress(100);
      const resetMsg = data.pedidoResetCount ? ` | ${data.pedidoResetCount} clientes saíram de "Pedido na Tela"` : "";
      toast.success(`Upload concluído: ${data.rowsInserted} registros inseridos${resetMsg}`);
      refetchLogs();
    },
    onError: (err) => {
      setUploading(false);
      setProgress(0);
      toast.error(err.message);
    },
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Acesso restrito a gestores</p>
        </div>
      </div>
    );
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Formato inválido. Use arquivos .xlsx, .xls ou .csv");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Limite de 50MB.");
      return;
    }

    setUploading(true);
    setProgress(10);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      setProgress(40);
      uploadMutation.mutate({ fileBase64: base64, fileName: file.name });
    } catch (err: any) {
      setUploading(false);
      setProgress(0);
      toast.error("Erro ao ler arquivo: " + err.message);
    }

    if (fileRef.current) fileRef.current.value = "";
  };

  const formatDate = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Upload de Dados</h1>
        <p className="text-sm text-muted-foreground">Importar planilha de faturamento mensal</p>
      </div>

      {/* Upload area */}
      <Card>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              uploading ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-accent/30"
            }`}
            onClick={() => !uploading && fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" />
            {uploading ? (
              <div className="space-y-4">
                <FileSpreadsheet className="h-12 w-12 text-primary mx-auto animate-pulse" />
                <p className="text-sm font-medium">Processando arquivo...</p>
                <Progress value={progress} className="max-w-xs mx-auto" />
              </div>
            ) : result ? (
              <div className="space-y-3">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                <p className="text-sm font-medium text-green-700">Upload concluído com sucesso!</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Linhas processadas: <strong>{result.rowsProcessed}</strong></p>
                  <p>Registros inseridos: <strong className="text-green-600">{result.rowsInserted}</strong></p>
                  <p>Duplicados ignorados: <strong className="text-orange-500">{result.rowsDuplicate}</strong></p>
                  {(result as any).pedidoResetCount > 0 && (
                    <p>Pedido na Tela → Ativo: <strong className="text-blue-600">{(result as any).pedidoResetCount} clientes</strong></p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setResult(null); }}>
                  Enviar outro arquivo
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                <div>
                  <p className="text-sm font-medium">Clique para selecionar arquivo</p>
                  <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: .xlsx, .xls, .csv (até 50MB)</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Histórico de Uploads
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !logs?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum upload realizado</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  {log.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : log.status === "error" ? (
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{log.fileName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(log.createdAt)}
                      {log.rowsInserted != null && ` — ${log.rowsInserted} inseridos, ${log.rowsDuplicate || 0} duplicados`}
                    </p>
                    {log.errorMessage && <p className="text-[10px] text-destructive">{log.errorMessage}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
