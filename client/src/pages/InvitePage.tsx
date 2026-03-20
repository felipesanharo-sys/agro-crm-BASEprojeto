import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useParams, useLocation } from "wouter";
import { Loader2, CheckCircle, XCircle, Wheat, Shield } from "lucide-react";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Try RC invite first, then manager invite
  const rcValidateQuery = trpc.invites.getByToken.useQuery({ token: token || "" }, { enabled: !!token });
  const managerValidateQuery = trpc.managerInvites.getByToken.useQuery({ token: token || "" }, { enabled: !!token && !rcValidateQuery.data });
  
  const rcAcceptMutation = trpc.invites.accept.useMutation({
    onSuccess: () => { setTimeout(() => setLocation("/"), 2000); },
  });
  const managerAcceptMutation = trpc.managerInvites.accept.useMutation({
    onSuccess: () => { setTimeout(() => setLocation("/"), 2000); },
  });

  // Determine which type of invite this is
  const isManagerInvite = managerValidateQuery.data?.isManager;
  const isRcInvite = rcValidateQuery.data && !isManagerInvite;
  const validateQuery = isManagerInvite ? managerValidateQuery : rcValidateQuery;
  const acceptMutation = isManagerInvite ? managerAcceptMutation : rcAcceptMutation;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="max-w-md w-full mx-4 border shadow-lg">
        <CardContent className="p-8 text-center space-y-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            {isManagerInvite ? <Shield className="h-7 w-7 text-primary" /> : <Wheat className="h-7 w-7 text-primary" />}
          </div>
          <h1 className="text-xl font-bold">Agro CRM GNE</h1>

          {rcValidateQuery.isLoading || managerValidateQuery.isLoading ? (
            <div className="space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Validando convite...</p>
            </div>
          ) : !validateQuery.data || validateQuery.data.used ? (
            <div className="space-y-2">
              <XCircle className="h-10 w-10 mx-auto text-destructive" />
              <p className="text-sm text-muted-foreground">Convite inválido ou já utilizado.</p>
              <Button onClick={() => setLocation("/")} variant="outline">Ir para o início</Button>
            </div>
          ) : !user ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Você foi convidado como <strong>{isManagerInvite ? "Gestor" : `RC ${(validateQuery.data as any).repCode}`}</strong>. Faça login para aceitar.
              </p>
              <Button onClick={() => { window.location.href = getLoginUrl(); }} className="w-full">
                Fazer Login
              </Button>
            </div>
          ) : acceptMutation.isSuccess ? (
            <div className="space-y-2">
              <CheckCircle className="h-10 w-10 mx-auto text-emerald-500" />
              <p className="text-sm font-medium text-emerald-600">Convite aceito com sucesso!</p>
              <p className="text-xs text-muted-foreground">Redirecionando...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Olá, <strong>{user.name}</strong>! Aceite o convite para vincular-se como <strong>{isManagerInvite ? "Gestor" : `RC ${(validateQuery.data as any).repCode}`}</strong>.
              </p>
              <Button onClick={() => acceptMutation.mutate({ token: token || "" })} disabled={acceptMutation.isPending} className="w-full">
                {acceptMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aceitando...</> : "Aceitar Convite"}
              </Button>
              {acceptMutation.isError && <p className="text-xs text-destructive">{acceptMutation.error.message}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
