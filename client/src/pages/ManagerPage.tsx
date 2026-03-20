import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState } from "react";
import { UserPlus, Copy, Trash2, CheckCircle, Clock, Shield } from "lucide-react";

export default function ManagerPage() {
  const { user } = useAuth();
  const [repCode, setRepCode] = useState("");
  const utils = trpc.useUtils();

  const invitesQuery = trpc.invites.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const managerInvitesQuery = trpc.managerInvites.list.useQuery(undefined, { enabled: user?.role === "admin" });
  
  const createMutation = trpc.invites.create.useMutation({
    onSuccess: (data) => {
      toast.success("Convite criado!");
      setRepCode("");
      utils.invites.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const createManagerMutation = trpc.managerInvites.create.useMutation({
    onSuccess: (data) => {
      toast.success("Convite para gestor criado!");
      utils.managerInvites.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.invites.delete.useMutation({
    onSuccess: () => { toast.success("Convite removido"); utils.invites.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteManagerMutation = trpc.managerInvites.delete.useMutation({
    onSuccess: () => { toast.success("Convite removido"); utils.managerInvites.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  if (user?.role !== "admin") {
    return <div className="flex items-center justify-center h-[60vh]"><p className="text-muted-foreground">Acesso restrito a gestores.</p></div>;
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/convite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-primary" />Convites
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gere links de convite para vincular RCs e gestores ao sistema</p>
      </div>

      <Card className="border shadow-sm">
        <CardHeader><CardTitle className="text-base">Novo Convite para RC</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="Código do RC (repCode)" value={repCode} onChange={e => setRepCode(e.target.value)} className="max-w-xs" />
            <Button onClick={() => createMutation.mutate({ repCode })} disabled={!repCode || createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Gerar Convite"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader><CardTitle className="text-base">Convites para RCs</CardTitle></CardHeader>
        <CardContent>
          {invitesQuery.isLoading ? <Skeleton className="h-32" /> : (
            <div className="space-y-2">
              {(invitesQuery.data || []).map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {inv.usedAt ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-amber-500" />}
                    <div>
                      <p className="text-sm font-medium">RC: {inv.repCode}</p>
                      <p className="text-xs text-muted-foreground">
                        Criado: {new Date(inv.createdAt).toLocaleDateString("pt-BR")}
                        {inv.usedAt && ` | Usado: ${new Date(inv.usedAt).toLocaleDateString("pt-BR")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={inv.usedAt ? "default" : "secondary"}>
                      {inv.usedAt ? "Utilizado" : "Pendente"}
                    </Badge>
                    {!inv.usedAt && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => copyLink(inv.token)} title="Copiar link">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ inviteId: inv.id })} title="Remover">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {(invitesQuery.data || []).length === 0 && <p className="text-center text-muted-foreground py-4">Nenhum convite gerado</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" />Novo Convite para Gestor</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Gere um link de convite para um novo gestor acessar o sistema com permissões de administrador.</p>
          <Button onClick={() => createManagerMutation.mutate()} disabled={createManagerMutation.isPending}>
            {createManagerMutation.isPending ? "Criando..." : "Gerar Convite para Gestor"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader><CardTitle className="text-base">Convites para Gestores</CardTitle></CardHeader>
        <CardContent>
          {managerInvitesQuery.isLoading ? <Skeleton className="h-32" /> : (
            <div className="space-y-2">
              {(managerInvitesQuery.data || []).map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border bg-blue-50 dark:bg-blue-950">
                  <div className="flex items-center gap-3">
                    {inv.usedAt ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-amber-500" />}
                    <div>
                      <p className="text-sm font-medium">Gestor</p>
                      <p className="text-xs text-muted-foreground">
                        Criado: {new Date(inv.createdAt).toLocaleDateString("pt-BR")}
                        {inv.usedAt && ` | Usado: ${new Date(inv.usedAt).toLocaleDateString("pt-BR")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={inv.usedAt ? "default" : "secondary"}>
                      {inv.usedAt ? "Utilizado" : "Pendente"}
                    </Badge>
                    {!inv.usedAt && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => copyLink(inv.token)} title="Copiar link">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteManagerMutation.mutate({ inviteId: inv.id })} title="Remover">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {(managerInvitesQuery.data || []).length === 0 && <p className="text-center text-muted-foreground py-4">Nenhum convite gerado</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
