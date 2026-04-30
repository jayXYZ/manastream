"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const getWakeLockSupportSnapshot = () =>
  typeof navigator !== "undefined" && "wakeLock" in navigator;

const getWakeLockServerSnapshot = () => null;

const subscribeToWakeLockSupport = () => () => {};

/**
 * Custom hook to manage screen wake lock functionality
 * Prevents screen from dimming/sleeping while active
 */
export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const wakeLockSupport = useSyncExternalStore(
    subscribeToWakeLockSupport,
    getWakeLockSupportSnapshot,
    getWakeLockServerSnapshot,
  );
  const isSupported = wakeLockSupport === true;
  const [isActive, setIsActive] = useState<boolean>(false);
  const [wakeLockError, setWakeLockError] = useState<string | null>(null);
  const error =
    wakeLockError ??
    (wakeLockSupport === false
      ? "Wake Lock API is not supported in this browser"
      : null);

  // Function to request wake lock
  const requestWakeLock = useCallback(async () => {
    if (!isSupported) {
      setWakeLockError("Wake Lock API is not supported");
      return false;
    }

    try {
      // Release existing wake lock if any
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
      }

      // Request new wake lock
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      setIsActive(true);
      setWakeLockError(null);

      // Handle wake lock release (e.g., when tab becomes inactive)
      wakeLockRef.current.addEventListener("release", () => {
        setIsActive(false);
        wakeLockRef.current = null;
      });

      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to request wake lock";
      setWakeLockError(errorMessage);
      setIsActive(false);
      wakeLockRef.current = null;
      return false;
    }
  }, [isSupported]);

  // Function to release wake lock
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
        setWakeLockError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to release wake lock";
        setWakeLockError(errorMessage);
      }
    }
  }, []);

  // Re-request wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        isSupported &&
        !wakeLockRef.current
      ) {
        // Only re-request if we were previously active
        if (isActive || wakeLockRef.current) {
          requestWakeLock();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isSupported, isActive, requestWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
      }
    };
  }, []);

  return {
    isSupported,
    isActive,
    error,
    requestWakeLock,
    releaseWakeLock,
  };
}
