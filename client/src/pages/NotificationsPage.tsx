import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import {
  Bell, CheckCheck, AlertTriangle, Info, ArrowRightLeft,
  GitBranch, UserCheck, UserPlus, Filter
} from "lucide-react";

const TYPE_CONFIG: Record<string, { icon: any; label: string; bg: string; text: string }> = {
  status_change: {
    icon: ArrowRightLeft,
    label: "Mudança de Status",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-600 dark:text-blue-400",
  },

  cycle_alert: {
    icon: AlertTriangle,
    label: "Alerta de Ciclo",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-600 dark:text-orange-400",
  },
  inactivity_warning: {
    icon: UserCheck,
    label: "Inatividade",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-600 dark:text-red-400",
  },
  new_client: {
    icon: UserPlus,
    label: "Novo Cliente",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-600 dark:text-green-400",
  },
  general: {
    icon: Info,
    label: "Geral",
    bg: "bg-primary/10",
    text: "text-primary",
  },
};

const FILTER_TABS = [
  { value: "todos", label: "Todos" },
  { value: "status_change", label: "Status" },

  { value: "cycle_alert", label: "Ciclo" },
  { value: "general", label: "Geral" },
];

export default function NotificationsPage() {
  const [filter, setFilter] = useState("todos");
  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery(undefined, { staleTime: 30000 });
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetch(),
  });

  const formatDate = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  const filtered = notifications?.filter((n: any) => filter === "todos" || n.type === filter) || [];
  const unreadCount = notifications?.filter((n: any) => !n.isRead).length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Notificações</h1>
          <p className="text-sm text-muted-foreground">{unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}` : "Todas lidas"}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markReadMutation.mutate({})}>
            <CheckCheck className="h-4 w-4 mr-1" />
            Marcar todas
          </Button>
        )}
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {FILTER_TABS.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
              {tab.label}
              {tab.value !== "todos" && notifications?.filter((n: any) => n.type === tab.value).length ? (
                <span className="ml-1 text-[10px] bg-muted px-1 rounded">
                  {notifications.filter((n: any) => n.type === tab.value).length}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {filter === "todos" ? "Nenhuma notificação" : `Nenhuma notificação de "${FILTER_TABS.find(t => t.value === filter)?.label}"`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((n: any) => {
            const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.general;
            const Icon = config.icon;
            return (
              <Card key={n.id} className={`transition-colors ${!n.isRead ? "border-l-2 border-l-primary bg-primary/[0.02]" : ""}`}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${config.bg} ${config.text}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm ${!n.isRead ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${config.bg} ${config.text} font-medium`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      {n.clientName && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          Cliente: {n.clientName} {n.clientCodeSAP ? `(SAP: ${n.clientCodeSAP})` : ""}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">{formatDate(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <button
                        onClick={() => markReadMutation.mutate({ ids: [n.id] })}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Lida
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
