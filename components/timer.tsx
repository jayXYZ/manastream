import { TournamentInfo, Tournament } from "@/convex/types";
import { useTimerNoAuth } from "@/hooks/use-timer-no-auth";
import { formatTime } from "@/lib/utils";

export default function Timer({
  tournamentInfo,
}: {
  tournamentInfo: TournamentInfo | Tournament;
}) {
  // Create a default expiry timestamp that's in the future (e.g., 1 hour from now)
  const getDefaultExpiry = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1); // Default to 1 hour from now
    return now;
  };

  const timer = useTimerNoAuth({
    expiryTimestamp: tournamentInfo?.manualTimerExpiry
      ? new Date(tournamentInfo.manualTimerExpiry)
      : getDefaultExpiry(),
    autoStart: tournamentInfo?.manualTimerRunning || false,
    manualTimerExpiry: tournamentInfo?.manualTimerExpiry,
    manualTimerRunning: tournamentInfo?.manualTimerRunning,
  });

  if (!tournamentInfo) {
    return <p>Loading...</p>;
  }

  const timerDisplay = formatTime(timer.totalSeconds);
  // const isNegative = timerDisplay.startsWith("-");

  return (
    // <span className={isNegative ? "text-red-500" : ""}>{timerDisplay}</span>
    <span>{timerDisplay}</span>
  );
}
