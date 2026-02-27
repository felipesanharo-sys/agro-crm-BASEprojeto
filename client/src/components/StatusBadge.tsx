import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "status-ativo" },
  em_ciclo: { label: "Em Ciclo", className: "status-em_ciclo" },
  alerta: { label: "Alerta", className: "status-alerta" },
  pre_inativacao: { label: "Pré-Inativação", className: "status-pre_inativacao" },
  inativo: { label: "Inativo", className: "status-inativo" },
  em_acao: { label: "Em Ação", className: "status-em_acao" },
  pedido_na_tela: { label: "Pedido na Tela", className: "status-pedido_na_tela" },
  excluido: { label: "Excluído", className: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status, manualStatus }: { status: string; manualStatus?: string | null }) {
  const displayStatus = manualStatus && manualStatus !== "reset" ? manualStatus : status;
  const config = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.ativo;
  return (
    <Badge variant="outline" className={`${config.className} border-0 font-medium text-xs px-2 py-0.5`}>
      {config.label}
    </Badge>
  );
}

export function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ativo: "bg-[oklch(0.65_0.19_145)]",
    em_ciclo: "bg-[oklch(0.75_0.17_85)]",
    alerta: "bg-[oklch(0.7_0.18_55)]",
    pre_inativacao: "bg-[oklch(0.55_0.2_310)]",
    inativo: "bg-[oklch(0.6_0.22_25)]",
    em_acao: "bg-[oklch(0.6_0.2_260)]",
    pedido_na_tela: "bg-[oklch(0.55_0.15_170)]",
  };
  return <div className={`h-2.5 w-2.5 rounded-full ${colors[status] || colors.ativo}`} />;
}
