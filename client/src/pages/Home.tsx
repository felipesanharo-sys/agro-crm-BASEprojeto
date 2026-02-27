import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation("/clientes");
    }
  }, [user, setLocation]);

  return null;
}
