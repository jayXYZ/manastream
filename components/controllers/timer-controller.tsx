"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTimer } from "@/hooks/use-timer";
import { useState, useCallback, useEffect } from "react";
import { Play, Pause, Square, Edit3 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatTime } from "@/lib/utils";

interface TimerControllerProps {
  initialMinutes?: number;
  initialSeconds?: number;
}

export function TimerController({
  initialMinutes = 50,
  initialSeconds = 0,
}: TimerControllerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editMinutes, setEditMinutes] = useState(initialMinutes.toString());
  const [editSeconds, setEditSeconds] = useState(
    initialSeconds.toString().padStart(2, "0"),
  );
  const tournament = useQuery(api.tournaments.getUserTournament);
  if (!tournament) {
    return <p>Loading...</p>;
  }

  // Create initial expiry timestamp
  const getInitialExpiry = useCallback(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + initialMinutes);
    now.setSeconds(now.getSeconds() + initialSeconds);
    return now;
  }, [initialMinutes, initialSeconds]);

  const timer = useTimer({
    expiryTimestamp: tournament.manualTimerExpiry
      ? new Date(tournament.manualTimerExpiry)
      : getInitialExpiry(),
    autoStart: tournament.manualTimerRunning,
  });

  // Sync timer state with backend when component mounts
  useEffect(() => {
    if (tournament && !tournament.manualTimerExpiry) {
      // Initialize timer in backend if it doesn't exist
      const initialExpiry = getInitialExpiry();
      timer.restart(initialExpiry, false);
    }
  }, [tournament, getInitialExpiry, timer]);

  // Debug info - you can remove this later
  useEffect(() => {
    console.log("Timer Controller Debug:", {
      tournamentId: tournament._id,
      manualTimerExpiry: tournament.manualTimerExpiry,
      manualTimerRunning: tournament.manualTimerRunning,
      timerTotalSeconds: timer.totalSeconds,
      timerIsRunning: timer.isRunning,
      isEditing,
    });
  }, [
    tournament._id,
    tournament.manualTimerExpiry,
    tournament.manualTimerRunning,
    timer.totalSeconds,
    timer.isRunning,
    isEditing,
  ]);

  // Handle timer restart with new values
  const handleRestart = useCallback(
    (minutes: number, seconds: number) => {
      const now = new Date();
      now.setMinutes(now.getMinutes() + minutes);
      now.setSeconds(now.getSeconds() + seconds);
      timer.restart(now, false);
      setIsEditing(false);
    },
    [timer],
  );

  // Handle edit submission
  const handleEditSubmit = useCallback(() => {
    const minutes = parseInt(editMinutes) || 0;
    const seconds = parseInt(editSeconds) || 0;

    if (minutes >= 0 && seconds >= 0 && seconds < 60) {
      handleRestart(minutes, seconds);
    }
  }, [editMinutes, editSeconds, handleRestart]);

  // Handle stop button
  const handleStop = useCallback(() => {
    timer.pause();
    const totalSeconds = timer.totalSeconds;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    setEditMinutes(minutes.toString());
    setEditSeconds(seconds.toString().padStart(2, "0"));
    setIsEditing(true);
  }, [timer]);

  // Handle reset button
  const handleReset = useCallback(() => {
    handleRestart(initialMinutes, initialSeconds);
  }, [initialMinutes, initialSeconds, handleRestart]);

  // Handle timer click when stopped
  const handleTimerClick = useCallback(() => {
    if (!timer.isRunning) {
      setIsEditing(true);
    }
  }, [timer.isRunning]);

  // Handle key press in edit mode
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleEditSubmit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      // Reset edit values to current timer values
      const totalSeconds = timer.totalSeconds;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setEditMinutes(minutes.toString());
      setEditSeconds(seconds.toString().padStart(2, "0"));
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-none">
        <CardTitle>Timer Controller</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center gap-6">
        {/* Timer Display/Edit */}
        <div className="text-center">
          {isEditing ? (
            <div className="flex flex-col gap-4 items-center">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="editMinutes">Minutes</Label>
                  <Input
                    id="editMinutes"
                    type="number"
                    min="0"
                    value={editMinutes}
                    onChange={(e) => setEditMinutes(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="w-20 text-center text-2xl font-mono"
                    autoFocus
                  />
                </div>
                <span className="text-2xl font-mono mt-6">:</span>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="editSeconds">Seconds</Label>
                  <Input
                    id="editSeconds"
                    type="number"
                    min="0"
                    max="59"
                    value={editSeconds}
                    onChange={(e) => setEditSeconds(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="w-20 text-center text-2xl font-mono"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleEditSubmit} size="sm" className="px-4">
                  Set
                </Button>
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  size="sm"
                  className="px-4"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="cursor-pointer group"
              onClick={handleTimerClick}
              title={!timer.isRunning ? "Click to edit timer" : ""}
            >
              <div className="text-6xl font-mono font-bold text-center group-hover:text-muted-foreground transition-colors">
                {formatTime(timer.totalSeconds)}
              </div>
              {!timer.isRunning && (
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-2">
                  <Edit3 size={14} />
                  <span>Click to edit</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timer Controls */}
        <div className="flex gap-3">
          {timer.isRunning ? (
            <Button onClick={timer.pause} size="lg" className="px-6">
              <Pause className="w-5 h-5 mr-2" />
              Pause
            </Button>
          ) : (
            <Button
              onClick={timer.resume}
              size="lg"
              className="px-6"
              disabled={timer.totalSeconds === 0}
            >
              <Play className="w-5 h-5 mr-2" />
              Start
            </Button>
          )}

          {timer.isRunning ? (
            <Button
              onClick={handleStop}
              variant="outline"
              size="lg"
              className="px-6"
            >
              <Square className="w-5 h-5 mr-2" />
              Stop
            </Button>
          ) : (
            <Button
              onClick={handleReset}
              variant="outline"
              size="lg"
              className="px-6"
              disabled={
                timer.totalSeconds === initialMinutes * 60 + initialSeconds
              }
            >
              <Square className="w-5 h-5 mr-2" />
              Reset
            </Button>
          )}
        </div>

        {/* Timer Status */}
        <div className="text-center text-sm text-muted-foreground">
          {timer.isRunning ? (
            <span className="text-green-600">Running</span>
          ) : timer.totalSeconds === 0 ? (
            <span className="text-red-600">Finished</span>
          ) : (
            <span className="text-yellow-600">Paused</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
