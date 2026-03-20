import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export function usePageTracker(pageName: string) {
  const { user } = useAuth();
  const recordMutation = trpc.activity.track.useMutation();
  const tracked = useRef(false);

  useEffect(() => {
    if (user && !tracked.current) {
      tracked.current = true;
      recordMutation.mutate({ page: pageName });
    }
  }, [user, pageName]);
}
