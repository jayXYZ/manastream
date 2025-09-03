import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format time display
export function formatTime(totalSeconds: number) {
  const minutes = Math.floor(Math.abs(totalSeconds) / 60);
  const seconds = Math.abs(totalSeconds % 60);
  const isNegative = totalSeconds < 0;
  return `${isNegative ? "-" : ""}${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
