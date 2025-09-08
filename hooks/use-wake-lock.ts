"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Custom hook to manage screen wake lock functionality
 * Prevents screen from dimming/sleeping while active
 */
export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check if Wake Lock API is supported
  useEffect(() => {
    if (typeof window !== "undefined" && "wakeLock" in navigator) {
      setIsSupported(true);
    } else {
      setIsSupported(false);
      setError("Wake Lock API is not supported in this browser");
    }
  }, []);

  // Function to request wake lock
  const requestWakeLock = async () => {
    if (!isSupported) {
      setError("Wake Lock API is not supported");
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
      setError(null);

      // Handle wake lock release (e.g., when tab becomes inactive)
      wakeLockRef.current.addEventListener("release", () => {
        setIsActive(false);
        wakeLockRef.current = null;
      });

      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to request wake lock";
      setError(errorMessage);
      setIsActive(false);
      wakeLockRef.current = null;
      return false;
    }
  };

  // Function to release wake lock
  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
        setError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to release wake lock";
        setError(errorMessage);
      }
    }
  };

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
  }, [isSupported, isActive]);

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
