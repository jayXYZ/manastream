import { useEffect, useRef } from "react";

export function useInterval(callback: () => void, delay: number | null) {
  const callbackRef = useRef<() => void>(() => {});

  // update callback function with current render callback that has access to latest props and state
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (delay === null) {
      return () => {};
    }

    const interval = setInterval(() => {
      if (callbackRef.current) {
        callbackRef.current();
      }
    }, delay);
    return () => clearInterval(interval);
  }, [delay]);
}
