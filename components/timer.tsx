import { api } from "@/convex/_generated/api";
import { useTimer } from "@/hooks/use-timer";
import { useQuery } from "convex/react";
import { formatTime } from "@/lib/utils";

export default function Timer() {
  const tournament = useQuery(api.tournaments.getUserTournament);

  // Create a default expiry timestamp that's in the future (e.g., 1 hour from now)
  const getDefaultExpiry = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1); // Default to 1 hour from now
    return now;
  };

  const timer = useTimer({
    expiryTimestamp: tournament?.manualTimerExpiry
      ? new Date(tournament.manualTimerExpiry)
      : getDefaultExpiry(),
    autoStart: tournament?.manualTimerRunning || false,
  });

  if (!tournament) {
    return <p>Loading...</p>;
  }

  const timerDisplay = formatTime(timer.totalSeconds);
  const isNegative = timerDisplay.startsWith("-");

  return (
    <span className={isNegative ? "text-red-500" : ""}>{timerDisplay}</span>
  );
}
