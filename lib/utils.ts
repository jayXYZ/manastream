import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format time display
export function formatTime(totalSeconds: number, showNegative: boolean = true) {
  const minutes = Math.floor(Math.abs(totalSeconds) / 60);
  const seconds = Math.abs(totalSeconds % 60);
  const isNegative = totalSeconds < 0;
  return `${isNegative && showNegative ? "-" : ""}${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
