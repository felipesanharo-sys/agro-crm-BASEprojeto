import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { BarChart3, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [accepted, setAccepted] = useState(false);

  const { data: invite, isLoading: inviteLoading } = trpc.invites.getByToken.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );

  const acceptMutation = trpc.invites.accept.useMutation({
    onSuccess: (data) => {
      setAccepted(true);
      // Redirect to main page after 2 seconds
      setTimeout(() => {
        window.location.href = "/clientes";
      }, 2000);
    },
  });

  // Auto-accept when user is logged in and invite is valid
  useEffect(() => {
    if (user && invite && !invite.used && !accepted && !acceptMutation.isPending && !acceptMutation.isError) {
      acceptMutation.mutate({ token: token || "" });
    }
  }, [user, invite, token, accepted]);

  if (authLoading || inviteLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando convite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid or expired invite
  if (!invite) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">Convite Inválido</h2>
            <p className="text-sm text-muted-foreground text-center">
              Este link de convite não é válido ou já expirou.
            </p>
            <Button variant="outline" onClick={() => setLocation("/")}>
              Ir para o início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already used invite
  if (invite.used && !accepted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold">Convite Já Utilizado</h2>
            <p className="text-sm text-muted-foreground text-center">
              Este convite já foi aceito por outro usuário.
            </p>
            <Button onClick={() => setLocation("/clientes")}>
              Acessar o sistema
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Successfully accepted
  if (accepted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold">Bem-vindo!</h2>
            <p className="text-sm text-muted-foreground text-center">
              {invite.isGestor
                ? <>Você foi registrado como <strong>Gestor</strong> com visão completa. Redirecionando...</>
                : <>Você foi vinculado ao RC <strong>{invite.alias}</strong> com sucesso. Redirecionando...</>
              }
            </p>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error accepting
  if (acceptMutation.isError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">Erro ao Aceitar</h2>
            <p className="text-sm text-muted-foreground text-center">
              {acceptMutation.error?.message || "Não foi possível aceitar o convite."}
            </p>
            <Button variant="outline" onClick={() => setLocation("/")}>
              Ir para o início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User not logged in - show invite info + login button
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl">Convite para Agro CRM</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 pt-2">
            <p className="text-sm text-muted-foreground text-center">
              {invite.isGestor
                ? 'Você foi convidado como Gestor com visão completa do sistema'
                : 'Você foi convidado como representante comercial'
              }
            </p>
            <div className="bg-primary/5 rounded-lg px-4 py-3 w-full text-center">
              <p className="text-xs text-muted-foreground">{invite.isGestor ? 'Perfil' : 'Representante'}</p>
              <p className="text-lg font-bold text-primary">{invite.alias}</p>
            </div>
            <Button
              onClick={() => {
                // Store token in sessionStorage so we can accept after login
                sessionStorage.setItem("invite_token", token || "");
                window.location.href = getLoginUrl(`/convite/${token}`);
              }}
              size="lg"
              className="w-full shadow-lg hover:shadow-xl transition-all font-medium"
            >
              Entrar e aceitar convite
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Accepting in progress
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="p-8 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Aceitando convite...</p>
        </CardContent>
      </Card>
    </div>
  );
}
