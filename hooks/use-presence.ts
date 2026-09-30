import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function usePresence(overlayId: string | null) {
  const setConnectedLifeTracker = useMutation(
    api.presence.setConnectedLifeTracker,
  );
  const disconnectLifeTracker = useMutation(api.presence.disconnectLifeTracker);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!overlayId) return;

    // Generate unique session ID
    if (!sessionIdRef.current) {
      sessionIdRef.current = `${Date.now()}-${Math.random()}`;
    }

    const sessionId = sessionIdRef.current;

    // The mutation refuses overlays the user does not own or that no longer
    // exist (a stale persisted selection is cleared by useOverlayValidation).
    const connect = () =>
      setConnectedLifeTracker({
        overlayId: overlayId as Id<"overlays">,
        sessionId,
      }).catch((error) => {
        console.warn("Could not register life tracker presence:", error);
      });

    connect();

    // set up heartbeat to maintain presence
    const heartbeat = setInterval(connect, 60 * 1000); // 1 minute

    // handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        disconnectLifeTracker({ sessionId });
      } else {
        connect();
      }
    };

    // handle before unload
    const handleBeforeUnload = () => {
      disconnectLifeTracker({ sessionId });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      disconnectLifeTracker({ sessionId });
    };
  }, [overlayId, setConnectedLifeTracker, disconnectLifeTracker]);
}
