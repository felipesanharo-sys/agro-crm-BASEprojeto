import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Bell, CheckCheck, AlertTriangle, Info, ShoppingCart } from "lucide-react";

const typeIcons: Record<string, any> = {
  cycle_alert: AlertTriangle,
  status_change: Info,
  inactivity_warning: AlertTriangle,
  pedido_na_tela: ShoppingCart,
};
const typeLabels: Record<string, string> = {
  cycle_alert: "Alerta de Ciclo",
  status_change: "Mudança de Status",
  inactivity_warning: "Aviso de Inatividade",
  pedido_na_tela: "Pedido na Tela",
};

export default function NotificationsPage() {
  const utils = trpc.useUtils();
  const notificationsQuery = trpc.notifications.list.useQuery();
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => { utils.notifications.list.invalidate(); utils.notifications.unreadCount.invalidate(); toast.success("Notificações marcadas como lidas"); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />Notificações
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Alertas de ciclo, status e inatividade</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => markReadMutation.mutate({})} disabled={markReadMutation.isPending}>
          <CheckCheck className="h-4 w-4 mr-1.5" />Marcar todas como lidas
        </Button>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {notificationsQuery.isLoading ? <Skeleton className="h-48 m-4" /> : (
            <div className="divide-y">
              {(notificationsQuery.data || []).map((n: any) => {
                const Icon = typeIcons[n.type] || Info;
                return (
                  <div key={n.id} className={`flex items-start gap-3 p-4 ${!n.readAt ? "bg-primary/5" : ""}`}>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${!n.readAt ? "bg-primary/10" : "bg-muted"}`}>
                      <Icon className={`h-4 w-4 ${!n.readAt ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm ${!n.readAt ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                        {!n.readAt && <Badge className="text-[9px] px-1 py-0 h-3.5 bg-primary">Novo</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                );
              })}
              {(notificationsQuery.data || []).length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">Nenhuma notificação</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
