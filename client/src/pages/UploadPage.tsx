import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, Trash2 } from "lucide-react";
import { REQUIRED_COLUMNS } from "@shared/types";

export default function UploadPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [replaceMonths, setReplaceMonths] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const uploadMutation = trpc.upload.process.useMutation({
    onSuccess: (data) => {
      toast.success(`Upload concluído: ${data.rowsInserted} linhas inseridas, ${data.rowsDuplicate} duplicatas`);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      utils.upload.logs.invalidate();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
    onSettled: () => setUploading(false),
  });

  const logsQuery = trpc.upload.logs.useQuery(undefined, { enabled: user?.role === "admin" });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const months = replaceMonths.split(",").map(m => m.trim()).filter(Boolean);
      uploadMutation.mutate({ fileName: file.name, fileBase64: base64 });
    } catch (err: any) {
      toast.error(`Erro ao ler arquivo: ${err.message}`);
      setUploading(false);
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Acesso restrito a gestores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload de Faturamento</h1>
        <p className="text-muted-foreground text-sm mt-1">Importe planilhas CSV/XLSX de faturamento</p>
      </div>

      <Card className="border shadow-sm">
        <CardHeader><CardTitle className="text-base">Importar Arquivo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">Selecione o arquivo de faturamento</p>
            <p className="text-xs text-muted-foreground mb-4">Formatos aceitos: .csv, .xlsx, .xls</p>
            <Input ref={fileRef} type="file" accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)} className="max-w-xs mx-auto" />
          </div>
          {file && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div>
            <Label className="text-sm">Substituir meses (opcional)</Label>
            <Input placeholder="Ex: 2025.01, 2025.02" value={replaceMonths}
              onChange={(e) => setReplaceMonths(e.target.value)} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">Dados desses meses serão deletados antes da importação</p>
          </div>
          <Button onClick={handleUpload} disabled={!file || uploading} className="w-full sm:w-auto">
            {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</> : "Importar Dados"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader><CardTitle className="text-base">Colunas Obrigatórias</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {REQUIRED_COLUMNS.map(col => <Badge key={col} variant="outline" className="text-xs">{col}</Badge>)}
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader><CardTitle className="text-base">Histórico de Uploads</CardTitle></CardHeader>
        <CardContent>
          {logsQuery.isLoading ? <Skeleton className="h-32" /> : (
            <div className="space-y-2">
              {(logsQuery.data || []).map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {log.status === "completed" ? <CheckCircle className="h-4 w-4 text-emerald-500" /> :
                     log.status === "error" ? <XCircle className="h-4 w-4 text-red-500" /> :
                     <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                    <div>
                      <p className="text-sm font-medium">{log.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString("pt-BR")} - {log.rowsProcessed} linhas, {log.rowsInserted} inseridas
                      </p>
                    </div>
                  </div>
                  <Badge variant={log.status === "completed" ? "default" : log.status === "error" ? "destructive" : "secondary"}>
                    {log.status === "completed" ? "Concluído" : log.status === "error" ? "Erro" : "Processando"}
                  </Badge>
                </div>
              ))}
              {(logsQuery.data || []).length === 0 && <p className="text-center text-muted-foreground py-4">Nenhum upload realizado</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
