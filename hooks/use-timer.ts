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

  // Initialize timer state from tournament data
  useEffect(() => {
    if (tournament) {
      if (tournament.manualTimerExpiry) {
        let expiry = new Date(tournament.manualTimerExpiry);

        // If timer was paused, adjust expiry to account for paused time
        if (
          tournament.manualTimerPausedAt &&
          !tournament.manualTimerRunning
        ) {
          const pausedAt = tournament.manualTimerPausedAt;
          const now = Date.now();
          const timePassedWhilePaused = now - pausedAt;
          // Adjust expiry forward by the time that passed while paused
          // This effectively "freezes" the timer at the point it was paused
          expiry = new Date(expiry.getTime() + timePassedWhilePaused);
        }

        setExpiryTimestamp(expiry);

        // Calculate seconds remaining, ensuring it's not negative
        // const secondsRemaining = Math.max(
        //   0,
        //   Time.getSecondsFromExpiry(expiry.getTime(), false),
        // );
        setSeconds(Time.getSecondsFromExpiry(expiry.getTime(), false));

        // Set delay based on expiry
        setDelay(getDelayFromExpiryTimestamp(expiry));
      }

      if (tournament.manualTimerRunning !== undefined) {
        setIsRunning(tournament.manualTimerRunning);
        setDidStart(tournament.manualTimerRunning);
      }
    }
  }, [tournament]);

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

      // Calculate seconds remaining, ensuring it's not negative
      // const secondsRemaining = Math.max(
      //   0,
      //   Time.getSecondsFromExpiry(newExpiryTimestamp.getTime(), false),
      // );
      setSeconds(
        Time.getSecondsFromExpiry(newExpiryTimestamp.getTime(), false),
      );

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
    [tournament?._id, setTimer],
  );

  const resume = useCallback(() => {
    const time = new Date();
    time.setMilliseconds(time.getMilliseconds() + seconds * 1000);
    setIsRunning(true);
    setExpiryTimestamp(time);
    setDelay(getDelayFromExpiryTimestamp(time));
    setSeconds(Time.getSecondsFromExpiry(time.getTime(), false));
    
    if (tournament?._id) {
      setTimer({
        tournamentId: tournament._id,
        manualTimerRunning: true,
        manualTimerExpiry: time.getTime(),
        manualTimerPausedAt: null, // Clear paused timestamp when resuming
      });
    }
  }, [seconds, tournament?._id, setTimer]);

  const start = useCallback(() => {
    if (didStart) {
      const time = Time.getSecondsFromExpiry(expiryTimestamp.getTime(), false);
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
  }, [expiryTimestamp, didStart, resume, tournament?._id, setTimer]);

  useInterval(
    () => {
      if (delay !== DEFAULT_DELAY) {
        setDelay(DEFAULT_DELAY);
      }
      const secondsValue = Time.getSecondsFromExpiry(
        expiryTimestamp.getTime(),
        false,
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
