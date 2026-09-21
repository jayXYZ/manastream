"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlayerRefreshResult =
  | "scheduled"
  | "in_progress"
  | "no_tournament"
  | "no_credentials";

type PlayerRefreshState = {
  status: "running" | "success" | "error";
  startedAt: number;
  finishedAt?: number;
  message?: string;
};

const FEEDBACK_COPY: Record<PlayerRefreshResult, string> = {
  scheduled: "Downloading players and decklists from Melee...",
  in_progress: "A player refresh is already running.",
  no_tournament: "Set a Melee tournament ID in Settings first.",
  no_credentials: "Add your Melee API credentials in Settings first.",
};

const FEEDBACK_TIMEOUT_MS = 8000;

/**
 * "Refresh players": re-download every registered player and decklist from
 * Melee. Works in manual and auto mode; only needs a tournament ID and Melee
 * credentials. The result message arrives through the tournament document
 * once the background action finishes.
 */
export function RefreshPlayersButton({
  tournament,
  className,
}: {
  tournament: {
    externalTournamentId?: number;
    playerRefresh?: PlayerRefreshState;
  };
  className?: string;
}) {
  const requestPlayerRefresh = useMutation(
    api.tournamentSync.requestPlayerRefresh,
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Set when this button started a refresh; holds the finishedAt of the run
  // that was on record at that moment, so an older result is not mistaken
  // for the new one.
  const [awaiting, setAwaiting] = useState<{
    previousFinishedAt?: number;
  } | null>(null);

  const refresh = tournament.playerRefresh;
  const isRunning = refresh?.status === "running";
  const hasTournament =
    tournament.externalTournamentId !== undefined &&
    tournament.externalTournamentId !== -1;

  useEffect(() => {
    if (
      awaiting === null ||
      !refresh ||
      refresh.status === "running" ||
      refresh.finishedAt === awaiting.previousFinishedAt
    ) {
      return;
    }
    setAwaiting(null);
    setFeedback(
      refresh.message ??
        (refresh.status === "success"
          ? "Players refreshed."
          : "Player refresh failed."),
    );
  }, [awaiting, refresh]);

  useEffect(() => {
    if (feedback === null || awaiting !== null) {
      return;
    }
    const timeout = setTimeout(() => setFeedback(null), FEEDBACK_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [feedback, awaiting]);

  const handleClick = async () => {
    setIsRequesting(true);
    try {
      const previousFinishedAt = refresh?.finishedAt;
      const result = await requestPlayerRefresh({});
      if (result === "scheduled") {
        setAwaiting({ previousFinishedAt });
      }
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
        disabled={!hasTournament || isRunning || isRequesting}
        title={
          hasTournament
            ? "Re-download every player and decklist from Melee"
            : "Set a Melee tournament ID to refresh players"
        }
      >
        <Users className={cn((isRunning || isRequesting) && "animate-pulse")} />
        {isRunning ? "Refreshing players..." : "Refresh players"}
      </Button>
      {feedback && (
        <p className="text-xs text-muted-foreground" role="status">
          {feedback}
        </p>
      )}
    </div>
  );
}
