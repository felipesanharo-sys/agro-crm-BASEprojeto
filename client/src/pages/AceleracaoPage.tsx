import { useAuth } from "@/_core/hooks/useAuth";
import AceleracaoTab from "./AceleracaoTab";

export default function AceleracaoPage() {
  const { user } = useAuth();
  const repCodeFilter = user?.role === "admin" ? undefined : (user as any)?.repCode || undefined;
  return <AceleracaoTab repCodeFilter={repCodeFilter} />;
}
