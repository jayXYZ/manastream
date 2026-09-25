"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { RefreshCw } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { CardActionButton } from "@/components/ui/card-action-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
 *
 * The `icon` variant is a hover-revealed corner button for a `group` Card. It
 * reports the outcome of a click in its tooltip instead of a line of text.
 */
export function RefreshSyncButton({
  tournament,
  className,
  variant = "default",
}: {
  tournament: {
    mode: "manual" | "auto";
    pollingStatus?: "active" | "inactive" | "error";
  };
  className?: string;
  variant?: "default" | "icon";
}) {
  const requestImmediatePoll = useMutation(
    api.tournamentSync.requestImmediatePoll,
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const isPolling =
    tournament.mode === "auto" && tournament.pollingStatus === "active";
  const description = isPolling
    ? "Poll Melee now instead of waiting for the next scheduled sync"
    : "Enable auto sync to refresh from Melee";

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

  if (variant === "icon") {
    const showingFeedback = feedback !== null;
    const isDisabled = !isPolling || isRequesting;
    return (
      <Tooltip
        open={tooltipOpen || showingFeedback}
        onOpenChange={setTooltipOpen}
      >
        <TooltipTrigger asChild>
          {/*
           * A natively disabled button cannot be hovered or focused, so the
           * span is the tooltip trigger. While the button is disabled the span
           * also becomes the tab stop (announced as a single disabled button)
           * so keyboard users can still read why refresh is unavailable. When
           * the button is enabled the span drops out of the tab order and the
           * button's own focus reaches the trigger by bubbling.
           */}
          <span
            className={cn(
              "ring-offset-background focus-visible:ring-ring inline-flex rounded-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
              className,
            )}
            tabIndex={isDisabled ? 0 : undefined}
            role={isDisabled ? "button" : undefined}
            aria-disabled={isDisabled ? true : undefined}
            aria-label={isDisabled ? "Refresh now" : undefined}
          >
            <CardActionButton
              revealed={tooltipOpen || showingFeedback}
              onClick={handleClick}
              disabled={isDisabled}
              aria-hidden={isDisabled ? true : undefined}
            >
              <RefreshCw className={cn(isRequesting && "animate-spin")} />
              <span className="sr-only">Refresh now</span>
            </CardActionButton>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{feedback ?? description}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={!isPolling || isRequesting}
        title={description}
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
