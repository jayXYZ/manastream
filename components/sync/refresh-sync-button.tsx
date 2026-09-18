"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { RefreshCw } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ManualPollResult =
  | "scheduled"
  | "not_polling"
  | "in_progress"
  | "cooldown";

const FEEDBACK_COPY: Record<ManualPollResult, string> = {
  scheduled: "Sync requested. Results will appear shortly.",
  in_progress: "A sync cycle is already running.",
  cooldown: "A sync just finished. Try again in a few seconds.",
  not_polling: "Auto sync is not active.",
};

const FEEDBACK_TIMEOUT_MS = 4000;

/**
 * "Refresh now" for Melee auto sync. Only enabled while a polling session is
 * active; otherwise the scheduled loop is the only source of updates.
 */
export function RefreshSyncButton({
  tournament,
  className,
}: {
  tournament: {
    mode: "manual" | "auto";
    pollingStatus?: "active" | "inactive" | "error";
  };
  className?: string;
}) {
  const requestImmediatePoll = useMutation(
    api.tournamentSync.requestImmediatePoll,
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isPolling =
    tournament.mode === "auto" && tournament.pollingStatus === "active";

  useEffect(() => {
    if (feedback === null) {
      return;
    }
    const timeout = setTimeout(() => setFeedback(null), FEEDBACK_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const handleClick = async () => {
    setIsRequesting(true);
    try {
      const result = await requestImmediatePoll({});
      setFeedback(FEEDBACK_COPY[result]);
    } catch (error) {
      setFeedback(String(error));
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={!isPolling || isRequesting}
        title={
          isPolling
            ? "Poll Melee now instead of waiting for the next scheduled sync"
            : "Enable auto sync to refresh from Melee"
        }
      >
        <RefreshCw className={cn(isRequesting && "animate-spin")} />
        Refresh now
      </Button>
      {feedback && (
        <p className="text-xs text-muted-foreground" role="status">
          {feedback}
        </p>
      )}
    </div>
  );
}
