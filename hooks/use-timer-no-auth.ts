import { useState, useCallback, useEffect } from "react";
import { Time } from "@/lib/time";
import { useInterval } from "@/hooks/use-interval";

const DEFAULT_DELAY = 1000;

function getDelayFromExpiryTimestamp(expiryTimestamp: Date): number {
  const seconds = Time.getSecondsFromExpiry(expiryTimestamp.getTime(), false);
  const extraMilliSeconds = Math.floor((seconds - Math.floor(seconds)) * 1000);
  return extraMilliSeconds > 0 ? extraMilliSeconds : DEFAULT_DELAY;
}

interface UseTimerOptions {
  expiryTimestamp?: Date;
  autoStart?: boolean;
  manualTimerExpiry?: number | undefined;
  manualTimerRunning?: boolean | undefined;
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
      setSeconds(Time.getSecondsFromExpiry(newExpiry.getTime(), false));
      setDelay(getDelayFromExpiryTimestamp(newExpiry));
    }
    if (manualTimerRunning !== undefined) {
      setIsRunning(manualTimerRunning);
    }
  }, [manualTimerExpiry, manualTimerRunning]);

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
        Time.getSecondsFromExpiry(newExpiryTimestamp.getTime(), false),
      );
    },
    [],
  );

  const resume = useCallback(() => {
    const time = new Date();
    time.setMilliseconds(time.getMilliseconds() + seconds * 1000);
    restart(time);
  }, [seconds, restart]);

  const start = useCallback(() => {
    if (didStart) {
      setSeconds(Time.getSecondsFromExpiry(expiryTimestamp.getTime(), false));
      setIsRunning(true);
    } else {
      resume();
    }
  }, [expiryTimestamp, didStart, resume]);

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
