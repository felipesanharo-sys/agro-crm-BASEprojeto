import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Users, UserPlus, Link2, Copy, Trash2, Shield, ShieldOff,
  Unlink, Search, CheckCircle2, Clock, AlertTriangle, Activity
} from "lucide-react";
import ActivitySection from "./ActivitySection";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "activity">("users");
  const [selectedRepCode, setSelectedRepCode] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");

  // Queries
  const { data: userList, isLoading: usersLoading } = trpc.users.list.useQuery();
  const { data: inviteList, isLoading: invitesLoading } = trpc.invites.list.useQuery();
  const { data: repOptions } = trpc.profile.getRepOptions.useQuery();

  // Mutations
  const utils = trpc.useUtils();
  const createInvite = trpc.invites.create.useMutation({
    onSuccess: (data) => {
      const link = `${window.location.origin}/convite/${data.token}`;
      setGeneratedLink(link);
      utils.invites.list.invalidate();
      toast.success("Convite gerado com sucesso!");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteInvite = trpc.invites.delete.useMutation({
    onSuccess: () => {
      utils.invites.list.invalidate();
      toast.success("Convite removido");
    },
  });
  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("Papel atualizado");
    },
  });
  const unlinkRep = trpc.users.unlinkRep.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("Usuário desvinculado do RC");
    },
  });

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!userList) return [];
    if (!search.trim()) return userList;
    const q = search.toLowerCase();
    return userList.filter(
      (u: any) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.repCode || "").toLowerCase().includes(q) ||
        (u.repAlias || "").toLowerCase().includes(q)
    );
  }, [userList, search]);

  // Get rep alias map for invites display
  const repAliasMap = useMemo(() => {
    const map = new Map<string, string>();
    if (repOptions) {
      for (const r of repOptions) {
        map.set(r.repCode, r.alias || r.repName || r.repCode);
      }
    }
    return map;
  }, [repOptions]);

  // Available RCs for invite (not yet invited or linked)
  const linkedRepCodes = useMemo(() => {
    const set = new Set<string>();
    if (userList) {
      for (const u of userList) {
        if (u.repCode) set.add(u.repCode);
      }
    }
    return set;
  }, [userList]);

  const handleGenerateInvite = () => {
    if (!selectedRepCode) {
      toast.error("Selecione um RC");
      return;
    }
    setGeneratedLink("");
    createInvite.mutate({ repCode: selectedRepCode });
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const handleToggleRole = (userId: number, currentRole: string) => {
    if (userId === currentUser?.id) {
      toast.error("Você não pode alterar seu próprio papel");
      return;
    }
    const newRole = currentRole === "admin" ? "user" : "admin";
    updateRole.mutate({ userId, role: newRole as "admin" | "user" });
  };

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Acesso restrito a gestores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerência de Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie acessos, convites e permissões dos representantes
          </p>
        </div>
        {activeTab === "users" && (
          <Button onClick={() => { setInviteDialogOpen(true); setGeneratedLink(""); setSelectedRepCode(""); }}>
            <UserPlus className="h-4 w-4 mr-2" />
            Gerar Convite
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "users"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          Usuários
        </button>
        <button
          onClick={() => setActiveTab("activity")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "activity"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="h-4 w-4" />
          Monitoramento
        </button>
      </div>

      {activeTab === "activity" ? (
        <ActivitySection />
      ) : (
        <>
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userList?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Usuários</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userList?.filter((u: any) => u.repCode).length || 0}</p>
                <p className="text-xs text-muted-foreground">Vinculados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inviteList?.filter((i: any) => !i.usedAt).length || 0}</p>
                <p className="text-xs text-muted-foreground">Convites pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userList?.filter((u: any) => u.role === "admin").length || 0}</p>
                <p className="text-xs text-muted-foreground">Administradores</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Usuários Cadastrados</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou RC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>RC Vinculado</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Último Acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{u.name || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">{u.email || "-"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.repCode ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {u.repAlias || u.repCode}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Não vinculado
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs">
                        {u.role === "admin" ? "Gestor" : "RC"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString("pt-BR", {
                        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
                      }) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {u.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleRole(u.id, u.role)}
                            title={u.role === "admin" ? "Remover admin" : "Tornar admin"}
                          >
                            {u.role === "admin" ? (
                              <ShieldOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Shield className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        )}
                        {u.repCode && u.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unlinkRep.mutate({ userId: u.id })}
                            title="Desvincular RC"
                          >
                            <Unlink className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Active invites */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Convites Ativos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RC</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitesLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : !inviteList || inviteList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum convite gerado ainda
                  </TableCell>
                </TableRow>
              ) : (
                inviteList.map((inv: any) => {
                  const link = `${window.location.origin}/convite/${inv.token}`;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Badge variant={inv.repCode === '__GESTOR__' ? 'default' : 'outline'} className={`text-xs ${inv.repCode === '__GESTOR__' ? 'bg-purple-600' : 'font-mono'}`}>
                          {inv.repCode === '__GESTOR__' ? '🛡️ Gestor' : (repAliasMap.get(inv.repCode) || inv.repCode)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 max-w-xs">
                          <code className="text-xs truncate bg-muted px-2 py-0.5 rounded flex-1">
                            {link}
                          </code>
                          <Button variant="ghost" size="sm" onClick={() => handleCopyLink(link)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {inv.usedAt ? (
                          <Badge variant="default" className="text-xs bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Aceito
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "2-digit", year: "numeric"
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {!inv.usedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteInvite.mutate({ inviteId: inv.id })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      </>
      )}

      {/* Generate Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Convite</DialogTitle>
            <DialogDescription>
              Selecione o perfil de acesso e gere um link de convite único. 
              Para RCs, o acesso será restrito à sua carteira. Para Gestores, visão completa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Perfil de Acesso</label>
              <Select value={selectedRepCode} onValueChange={setSelectedRepCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__GESTOR__">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-purple-600" />
                      <span className="font-medium">Gestor (visão completa)</span>
                    </div>
                  </SelectItem>
                  {repOptions?.map((r: any) => (
                    <SelectItem key={r.repCode} value={r.repCode}>
                      <div className="flex items-center gap-2">
                        <span>{r.alias || r.repName}</span>
                        {linkedRepCodes.has(r.repCode) && (
                          <Badge variant="secondary" className="text-[10px] px-1">vinculado</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {generatedLink && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Link de Convite</label>
                <div className="flex items-center gap-2">
                  <Input value={generatedLink} readOnly className="text-xs font-mono" />
                  <Button variant="outline" size="sm" onClick={() => handleCopyLink(generatedLink)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Envie este link para o representante. Ao acessar e fazer login, ele será vinculado automaticamente.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            {!generatedLink ? (
              <Button onClick={handleGenerateInvite} disabled={!selectedRepCode || createInvite.isPending}>
                <Link2 className="h-4 w-4 mr-2" />
                {createInvite.isPending ? "Gerando..." : "Gerar Link"}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
