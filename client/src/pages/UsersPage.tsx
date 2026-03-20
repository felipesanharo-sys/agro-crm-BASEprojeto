import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Shield, Users as UsersIcon, Activity } from "lucide-react";

export default function UsersPage() {
  const { user } = useAuth();
  const [activityUser, setActivityUser] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const usersQuery = trpc.users.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const activityQuery = trpc.admin.userActivity.useQuery(undefined, { enabled: user?.role === "admin" });
  const pageBreakdownQuery = trpc.admin.userPageBreakdown.useQuery(
    { userId: activityUser! },
    { enabled: !!activityUser }
  );
  const repsQuery = trpc.repAliases.list.useQuery();

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => { toast.success("Papel atualizado"); utils.users.list.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateRepCodeMutation = trpc.users.updateRepCode.useMutation({
    onSuccess: () => { toast.success("Código RC atualizado"); utils.users.list.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (user?.role !== "admin") {
    return <div className="flex items-center justify-center h-[60vh]"><p className="text-muted-foreground">Acesso restrito a gestores.</p></div>;
  }

  const activityMap = new Map((activityQuery.data || []).map((a: any) => [a.userId, a]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />Usuários
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gestão de acessos e monitoramento de atividade</p>
      </div>

      <Card className="border shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><UsersIcon className="h-4 w-4" />Usuários Cadastrados</CardTitle></CardHeader>
        <CardContent>
          {usersQuery.isLoading ? <Skeleton className="h-48" /> : (
            <div className="space-y-3">
              {(usersQuery.data || []).map((u: any) => {
                const activity = activityMap.get(u.id) as any;
                return (
                  <div key={u.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium">{u.name || "Sem nome"}</p>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                          {u.role === "admin" ? "Gestor" : "RC"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email || "-"}</p>
                      <p className="text-xs text-muted-foreground">
                        RC: {u.repCode || "Não vinculado"} | Último acesso: {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString("pt-BR") : "-"}
                      </p>
                      {activity && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          {activity.totalViews} visualizações | {activity.daysSinceLastView != null ? `${activity.daysSinceLastView}d sem acessar` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select value={u.role} onValueChange={(v) => updateRoleMutation.mutate({ userId: u.id, role: v as any })}>
                        <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Gestor</SelectItem>
                          <SelectItem value="user">RC</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={u.repCode || "none"} onValueChange={(v) => updateRepCodeMutation.mutate({ userId: u.id, repCode: v === "none" ? null : v })}>
                        <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Vincular RC" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem vínculo</SelectItem>
                          {(repsQuery.data || []).map((r: any) => <SelectItem key={r.repCode} value={r.repCode}>{r.alias || r.repName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => setActivityUser(u.id)} title="Ver atividade">
                        <Activity className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {(usersQuery.data || []).length === 0 && <p className="text-center text-muted-foreground py-4">Nenhum usuário cadastrado</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Dialog */}
      <Dialog open={!!activityUser} onOpenChange={() => setActivityUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Atividade do Usuário</DialogTitle></DialogHeader>
          {pageBreakdownQuery.isLoading ? <Skeleton className="h-32" /> : (
            <div className="space-y-2">
              {(pageBreakdownQuery.data || []).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg border">
                  <p className="text-sm">{p.page}</p>
                  <Badge variant="outline">{p.viewCount} acessos</Badge>
                </div>
              ))}
              {(pageBreakdownQuery.data || []).length === 0 && <p className="text-center text-muted-foreground py-4">Sem atividade registrada</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
