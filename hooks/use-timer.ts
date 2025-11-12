import { useState, useCallback, useEffect } from "react";
import { Time } from "@/lib/time";
import { useInterval } from "@/hooks/use-interval";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const DEFAULT_DELAY = 1000;

function getDelayFromExpiryTimestamp(expiryTimestamp: Date): number {
  const seconds = Time.getSecondsFromExpiry(expiryTimestamp.getTime(), false);
  const extraMilliSeconds = Math.floor((seconds - Math.floor(seconds)) * 1000);
  return extraMilliSeconds > 0 ? extraMilliSeconds : DEFAULT_DELAY;
}

// Calculate seconds based on count direction
function getSecondsFromTimestamp(
  timestamp: Date,
  countDirection: "up" | "down",
): number {
  const now = Date.now();
  const timestampMs = timestamp.getTime();

  if (countDirection === "up") {
    // For count up: calculate elapsed time (now - start)
    return Math.max(0, (now - timestampMs) / 1000);
  } else {
    // For count down: calculate remaining time (expiry - now)
    return Time.getSecondsFromExpiry(timestampMs, false);
  }
}

interface UseTimerOptions {
  expiryTimestamp?: Date;
  autoStart?: boolean;
}

interface Timer {
  totalSeconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: (newExpiryTimestamp: Date, newAutoStart?: boolean) => void;
  isRunning: boolean;
}

export function useTimer({
  expiryTimestamp: expiry = new Date(),
  autoStart = true,
}: UseTimerOptions = {}): Timer {
  // All hooks must be called at the top level, before any conditional logic
  const tournament = useQuery(api.tournaments.getUserTournament);
  const setTimer = useMutation(api.tournaments.setTournamentTimer);

  const [expiryTimestamp, setExpiryTimestamp] = useState<Date>(() => expiry);
  const [seconds, setSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(autoStart);
  const [didStart, setDidStart] = useState<boolean>(autoStart);
  const [delay, setDelay] = useState<number>(DEFAULT_DELAY);

  const countDirection = tournament?.manualTimerCountDirection || "down";

  // Initialize timer state from tournament data
  useEffect(() => {
    if (tournament) {
      if (tournament.manualTimerExpiry) {
        let timestamp = new Date(tournament.manualTimerExpiry);

        // If timer was paused, adjust timestamp to account for paused time
        if (tournament.manualTimerPausedAt && !tournament.manualTimerRunning) {
          const pausedAt = tournament.manualTimerPausedAt;
          const now = Date.now();
          const timePassedWhilePaused = now - pausedAt;

          if (countDirection === "down") {
            // For count down: adjust expiry forward by the time that passed while paused
            // This effectively "freezes" the timer at the point it was paused
            // When we calculate (expiry - now), it will equal (originalExpiry - pausedAt)
            timestamp = new Date(timestamp.getTime() + timePassedWhilePaused);
          } else {
            // For count up: adjust start time forward by the time that passed while paused
            // This ensures (now - adjustedStart) = (pausedAt - originalStart)
            // So the elapsed time stays frozen at the paused value
            timestamp = new Date(timestamp.getTime() + timePassedWhilePaused);
          }
        }

        setExpiryTimestamp(timestamp);
        setSeconds(getSecondsFromTimestamp(timestamp, countDirection));

        // Set delay based on timestamp
        setDelay(getDelayFromExpiryTimestamp(timestamp));
      }

      if (tournament.manualTimerRunning !== undefined) {
        setIsRunning(tournament.manualTimerRunning);
        setDidStart(tournament.manualTimerRunning);
      }
    }
  }, [tournament, countDirection]);

  const pause = useCallback(() => {
    setIsRunning(false);
    if (tournament?._id) {
      setTimer({
        tournamentId: tournament._id,
        manualTimerRunning: false,
        manualTimerPausedAt: Date.now(),
      });
    }
  }, [tournament?._id, setTimer]);

  const restart = useCallback(
    (newExpiryTimestamp: Date, newAutoStart = true) => {
      setDelay(getDelayFromExpiryTimestamp(newExpiryTimestamp));
      setDidStart(newAutoStart);
      setIsRunning(newAutoStart);
      setExpiryTimestamp(newExpiryTimestamp);
      setSeconds(getSecondsFromTimestamp(newExpiryTimestamp, countDirection));

      if (tournament?._id) {
        setTimer({
          tournamentId: tournament._id,
          manualTimerRunning: newAutoStart,
          manualTimerExpiry: newExpiryTimestamp.getTime(),
          // If restarting paused, set paused timestamp; if restarting running, clear it
          manualTimerPausedAt: newAutoStart ? null : Date.now(),
        });
        console.log("restarted timer", newExpiryTimestamp, newAutoStart);
      }
    },
    [tournament?._id, setTimer, countDirection],
  );

  const resume = useCallback(() => {
    const now = new Date();
    let time: Date;

    if (countDirection === "up") {
      // For count up: set start time to now minus current elapsed seconds
      time = new Date(now.getTime() - seconds * 1000);
    } else {
      // For count down: set expiry time to now plus remaining seconds
      time = new Date();
      time.setMilliseconds(time.getMilliseconds() + seconds * 1000);
    }

    setIsRunning(true);
    setExpiryTimestamp(time);
    setDelay(getDelayFromExpiryTimestamp(time));
    setSeconds(getSecondsFromTimestamp(time, countDirection));

    if (tournament?._id) {
      setTimer({
        tournamentId: tournament._id,
        manualTimerRunning: true,
        manualTimerExpiry: time.getTime(),
        manualTimerPausedAt: null, // Clear paused timestamp when resuming
      });
    }
  }, [seconds, tournament?._id, setTimer, countDirection]);

  const start = useCallback(() => {
    if (didStart) {
      const time = getSecondsFromTimestamp(expiryTimestamp, countDirection);
      const validTime = Math.max(0, time);
      setSeconds(validTime);
      setIsRunning(true);
      if (tournament?._id) {
        setTimer({
          tournamentId: tournament._id,
          manualTimerRunning: true,
          manualTimerExpiry: expiryTimestamp.getTime(),
        });
      }
    } else {
      resume();
    }
  }, [
    expiryTimestamp,
    didStart,
    resume,
    tournament?._id,
    setTimer,
    countDirection,
  ]);

  useInterval(
    () => {
      if (delay !== DEFAULT_DELAY) {
        setDelay(DEFAULT_DELAY);
      }
      const secondsValue = getSecondsFromTimestamp(
        expiryTimestamp,
        countDirection,
      );
      setSeconds(secondsValue);
    },
    isRunning ? delay : null,
  );

  return {
    ...Time.getTimeFromSeconds(seconds),
    start,
    pause,
    resume,
    restart,
    isRunning,
  };
}
