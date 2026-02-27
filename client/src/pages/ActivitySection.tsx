import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity, Eye, Calendar, ChevronDown, ChevronUp,
  BarChart3, Clock, TrendingUp, AlertCircle
} from "lucide-react";

function formatNumber(n: number) {
  return n.toLocaleString("pt-BR");
}

function daysSince(date: string | Date | null) {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function getDaysLabel(days: number | null) {
  if (days === null) return { text: "Nunca acessou", color: "text-red-600", bg: "bg-red-50" };
  if (days === 0) return { text: "Hoje", color: "text-green-600", bg: "bg-green-50" };
  if (days === 1) return { text: "Ontem", color: "text-green-600", bg: "bg-green-50" };
  if (days <= 3) return { text: `${days} dias atrás`, color: "text-green-600", bg: "bg-green-50" };
  if (days <= 7) return { text: `${days} dias atrás`, color: "text-amber-600", bg: "bg-amber-50" };
  return { text: `${days} dias atrás`, color: "text-red-600", bg: "bg-red-50" };
}

function UserDetailRow({ userId, userName }: { userId: number; userName: string }) {
  const { data: pages, isLoading: pagesLoading } = trpc.activity.userPages.useQuery({ userId });
  const { data: recent, isLoading: recentLoading } = trpc.activity.userRecent.useQuery({ userId, limit: 10 });

  if (pagesLoading || recentLoading) {
    return (
      <TableRow>
        <TableCell colSpan={6} className="bg-muted/30 py-4">
          <p className="text-sm text-muted-foreground text-center">Carregando detalhes...</p>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell colSpan={6} className="bg-muted/30 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pages breakdown */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              Páginas Mais Acessadas
            </h4>
            {pages && (pages as any[]).length > 0 ? (
              <div className="space-y-1.5">
                {(pages as any[]).map((p: any, i: number) => {
                  const maxViews = Math.max(...(pages as any[]).map((x: any) => Number(x.views)));
                  const pct = maxViews > 0 ? (Number(p.views) / maxViews) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs w-24 truncate font-medium">{p.page}</span>
                      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {formatNumber(Number(p.views))}x
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum acesso registrado</p>
            )}
          </div>

          {/* Recent activity */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-emerald-600" />
              Atividade Recente
            </h4>
            {recent && (recent as any[]).length > 0 ? (
              <div className="space-y-1">
                {(recent as any[]).map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{r.page}</span>
                    <span className="text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma atividade recente</p>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function ActivitySection() {
  const { data: activityData, isLoading } = trpc.activity.summary.useQuery();
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"views" | "days" | "name">("days");

  const sortedData = useMemo(() => {
    if (!activityData) return [];
    const arr = [...(activityData as any[])];
    arr.sort((a, b) => {
      if (sortBy === "views") return Number(b.totalViews) - Number(a.totalViews);
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      // Sort by days since last activity (most inactive first)
      const daysA = daysSince(a.lastPageView || a.lastSignedIn);
      const daysB = daysSince(b.lastPageView || b.lastSignedIn);
      if (daysA === null) return -1;
      if (daysB === null) return 1;
      return daysB - daysA;
    });
    return arr;
  }, [activityData, sortBy]);

  // Summary stats
  const stats = useMemo(() => {
    if (!activityData || !(activityData as any[]).length) return { total: 0, active7d: 0, inactive7d: 0, neverAccessed: 0 };
    const arr = activityData as any[];
    const active7d = arr.filter(u => {
      const d = daysSince(u.lastPageView);
      return d !== null && d <= 7;
    }).length;
    const neverAccessed = arr.filter(u => !u.lastPageView && Number(u.totalViews) === 0).length;
    return {
      total: arr.length,
      active7d,
      inactive7d: arr.length - active7d - neverAccessed,
      neverAccessed,
    };
  }, [activityData]);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground">Total Usuários</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.active7d}</p>
                <p className="text-[10px] text-muted-foreground">Ativos (7 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.inactive7d}</p>
                <p className="text-[10px] text-muted-foreground">Inativos (+7 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.neverAccessed}</p>
                <p className="text-[10px] text-muted-foreground">Nunca acessaram</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Monitoramento de Acessos
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Ordenar:</span>
              <div className="flex gap-1">
                <Button
                  variant={sortBy === "days" ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSortBy("days")}
                >
                  Inatividade
                </Button>
                <Button
                  variant={sortBy === "views" ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSortBy("views")}
                >
                  Acessos
                </Button>
                <Button
                  variant={sortBy === "name" ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSortBy("name")}
                >
                  Nome
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-center">Total Acessos</TableHead>
                <TableHead className="text-center">Dias Ativos</TableHead>
                <TableHead>Último Acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando dados de atividade...
                  </TableCell>
                </TableRow>
              ) : sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum dado de atividade disponível ainda. Os acessos começarão a ser registrados automaticamente.
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((u: any) => {
                  const days = daysSince(u.lastPageView || u.lastSignedIn);
                  const label = getDaysLabel(days);
                  const isExpanded = expandedUser === u.userId;
                  return (
                    <>
                      <TableRow
                        key={u.userId}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedUser(isExpanded ? null : u.userId)}
                      >
                        <TableCell className="w-8 pr-0">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{u.name || "Sem nome"}</p>
                            <p className="text-xs text-muted-foreground">{u.email || "-"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs">
                            {u.role === "admin" ? "Gestor" : "RC"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-sm">
                            {formatNumber(Number(u.totalViews))}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm">
                            {formatNumber(Number(u.activeDays))}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${label.bg} ${label.color}`}>
                            <Calendar className="h-3 w-3" />
                            {label.text}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <UserDetailRow key={`detail-${u.userId}`} userId={u.userId} userName={u.name || "Sem nome"} />
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
