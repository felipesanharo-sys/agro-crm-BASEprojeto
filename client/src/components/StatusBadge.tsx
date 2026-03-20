import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  em_ciclo: "Em Ciclo",
  alerta: "Alerta",
  pre_inativacao: "Pré-Inativação",
  inativo: "Inativo",
  em_acao: "Em Ação",
  pedido_na_tela: "Pedido na Tela",
  excluido: "Excluído",
};

export default function StatusBadge({ status, manualStatus }: { status: string; manualStatus?: string | null }) {
  const displayStatus = manualStatus && manualStatus !== "reset" ? manualStatus : status;
  const label = STATUS_LABELS[displayStatus] || displayStatus;
  const cssClass = `status-${displayStatus}`;

  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-semibold border-transparent whitespace-nowrap ${cssClass}`}>
      {label}
    </Badge>
  );
}
