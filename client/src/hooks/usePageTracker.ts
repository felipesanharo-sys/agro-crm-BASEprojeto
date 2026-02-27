import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const PAGE_NAMES: Record<string, string> = {
  "/": "Home",
  "/clientes": "Clientes",
  "/aceleracao": "Aceleração",
  "/produtos": "Produtos",
  "/historico": "Histórico",
  "/upload": "Upload",
  "/notificacoes": "Notificações",
  "/configuracoes": "Configurações",
  "/usuarios": "Usuários",
};

export function usePageTracker() {
  const [location] = useLocation();
  const trackMutation = trpc.activity.track.useMutation();
  const lastTracked = useRef<string>("");

  useEffect(() => {
    // Avoid tracking the same page twice in a row
    if (location === lastTracked.current) return;
    lastTracked.current = location;

    const pageName = PAGE_NAMES[location] || location;
    trackMutation.mutate({ page: pageName });
  }, [location]);
}
