import { useState, useCallback, useEffect } from "react";
import { Time } from "@/lib/time";
import { useInterval } from "@/hooks/use-interval";

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
  manualTimerExpiry?: number | undefined;
  manualTimerRunning?: boolean | undefined;
  manualTimerCountDirection?: "up" | "down" | undefined;
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

export function useTimerNoAuth({
  expiryTimestamp: expiry = new Date(),
  autoStart = true,
  manualTimerExpiry,
  manualTimerRunning,
  manualTimerCountDirection = "down",
}: UseTimerOptions = {}): Timer {
  const [expiryTimestamp, setExpiryTimestamp] = useState<Date>(() => expiry);
  const [seconds, setSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(autoStart);
  const [didStart, setDidStart] = useState<boolean>(autoStart);
  const [delay, setDelay] = useState<number>(DEFAULT_DELAY);

  useEffect(() => {
    if (manualTimerExpiry) {
      const newExpiry = new Date(manualTimerExpiry);
      setExpiryTimestamp(newExpiry);
      setSeconds(getSecondsFromTimestamp(newExpiry, manualTimerCountDirection));
      setDelay(getDelayFromExpiryTimestamp(newExpiry));
    }
    if (manualTimerRunning !== undefined) {
      setIsRunning(manualTimerRunning);
    }
  }, [manualTimerExpiry, manualTimerRunning, manualTimerCountDirection]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const restart = useCallback(
    (newExpiryTimestamp: Date, newAutoStart = true) => {
      setDelay(getDelayFromExpiryTimestamp(newExpiryTimestamp));
      setDidStart(newAutoStart);
      setIsRunning(newAutoStart);
      setExpiryTimestamp(newExpiryTimestamp);
      setSeconds(
        getSecondsFromTimestamp(newExpiryTimestamp, manualTimerCountDirection),
      );
    },
    [manualTimerCountDirection],
  );

  const resume = useCallback(() => {
    const now = new Date();
    let time: Date;
    
    if (manualTimerCountDirection === "up") {
      // For count up: set start time to now minus current elapsed seconds
      time = new Date(now.getTime() - seconds * 1000);
    } else {
      // For count down: set expiry time to now plus remaining seconds
      time = new Date();
      time.setMilliseconds(time.getMilliseconds() + seconds * 1000);
    }
    restart(time);
  }, [seconds, restart, manualTimerCountDirection]);

  const start = useCallback(() => {
    if (didStart) {
      setSeconds(getSecondsFromTimestamp(expiryTimestamp, manualTimerCountDirection));
      setIsRunning(true);
    } else {
      resume();
    }
  }, [expiryTimestamp, didStart, resume, manualTimerCountDirection]);

  useInterval(
    () => {
      if (delay !== DEFAULT_DELAY) {
        setDelay(DEFAULT_DELAY);
      }
      const secondsValue = getSecondsFromTimestamp(
        expiryTimestamp,
        manualTimerCountDirection,
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
