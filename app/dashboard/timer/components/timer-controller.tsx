"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTimer } from "@/hooks/use-timer";
import { useState, useCallback, useEffect, useRef } from "react";
import { Play, Pause, Square, Edit3 } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
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
  const setTimer = useMutation(api.tournaments.setTournamentTimer);

  const tournamentId = tournament?._id;
  const countDirection = tournament?.manualTimerCountDirection || "down";

  // Create initial timestamp based on count direction
  const getInitialTimestamp = useCallback(() => {
    const now = new Date();
    if (countDirection === "up") {
      // For count up: start time is now (will count elapsed time from now)
      return now;
    } else {
      // For count down: expiry time is now + initial duration
      now.setMinutes(now.getMinutes() + initialMinutes);
      now.setSeconds(now.getSeconds() + initialSeconds);
      return now;
    }
  }, [initialMinutes, initialSeconds, countDirection]);

  // Create timer hook - always call with consistent parameters
  const timer = useTimer({
    expiryTimestamp: getInitialTimestamp(),
    autoStart: false,
  });

  // Store timer functions in ref to avoid circular dependencies
  const timerRef = useRef(timer);

  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  // Sync timer state with backend when component mounts or tournament changes
  // Note: The hook (use-timer.ts) handles initialization and paused time adjustment locally.
  // When paused, we don't call restart to avoid overwriting the hook's adjustment.
  // When running or not initialized, we call restart to sync state.
  useEffect(() => {
    if (tournament) {
      if (tournament.manualTimerExpiry) {
        // If timer is paused, let the hook handle initialization (it adjusts for paused time)
        // If timer is running, sync state by calling restart
        if (tournament.manualTimerRunning) {
          const timestamp = new Date(tournament.manualTimerExpiry);
          timerRef.current.restart(timestamp, true);
        }
        // When paused, the hook's useEffect already handles initialization with adjustment
      } else {
        // Initialize timer in backend if it doesn't exist
        const initialTimestamp = getInitialTimestamp();
        timerRef.current.restart(initialTimestamp, false);
      }
    }
  }, [tournament, getInitialTimestamp]);

  // Debug info - you can remove this later
  useEffect(() => {
    if (tournament) {
      console.log("Timer Controller Debug:", {
        tournamentId: tournament._id,
        manualTimerExpiry: tournament.manualTimerExpiry,
        manualTimerRunning: tournament.manualTimerRunning,
        timerTotalSeconds: timer.totalSeconds,
        timerIsRunning: timer.isRunning,
        isEditing,
      });
    }
  }, [
    tournament,
    tournament?._id,
    tournament?.manualTimerExpiry,
    tournament?.manualTimerRunning,
    timer.totalSeconds,
    timer.isRunning,
    isEditing,
  ]);

  // Handle timer restart with new values
  const handleRestart = useCallback(
    (minutes: number, seconds: number) => {
      const now = new Date();
      let timestamp: Date;

      if (countDirection === "up") {
        // For count up: set start time to now minus the desired initial value
        // This allows setting an initial elapsed time
        timestamp = new Date(now.getTime() - (minutes * 60 + seconds) * 1000);
      } else {
        // For count down: set expiry time to now plus the duration
        now.setMinutes(now.getMinutes() + minutes);
        now.setSeconds(now.getSeconds() + seconds);
        timestamp = now;
      }

      timerRef.current.restart(timestamp, false);
      setIsEditing(false);
    },
    [countDirection],
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
    timerRef.current.pause();
    const totalSeconds = timerRef.current.totalSeconds;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    setEditMinutes(minutes.toString());
    setEditSeconds(seconds.toString().padStart(2, "0"));
    setIsEditing(true);
  }, []);

  // Handle reset button
  const handleReset = useCallback(() => {
    if (countDirection === "up") {
      // For count up: reset to 0:00
      handleRestart(0, 0);
    } else {
      // For count down: reset to initial values
      handleRestart(initialMinutes, initialSeconds);
    }
  }, [initialMinutes, initialSeconds, handleRestart, countDirection]);

  // Handle timer click when stopped
  const handleTimerClick = useCallback(() => {
    if (!timerRef.current.isRunning) {
      setIsEditing(true);
    }
  }, []);

  // Handle key press in edit mode
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleEditSubmit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      // Reset edit values to current timer values
      const totalSeconds = timerRef.current.totalSeconds;
      const minutes = Math.floor(Math.abs(totalSeconds) / 60);
      const seconds = Math.abs(totalSeconds) % 60;
      setEditMinutes(minutes.toString());
      setEditSeconds(seconds.toString().padStart(2, "0"));
    }
  };

  // Handle count direction toggle
  const handleCountDirectionToggle = useCallback(
    (checked: boolean) => {
      if (tournamentId) {
        const newDirection = checked ? "up" : "down";
        setTimer({
          tournamentId,
          manualTimerCountDirection: newDirection,
        });

        // Reset timer when switching directions
        if (newDirection === "up") {
          // When switching to count up, set start time to now
          const now = new Date();
          timerRef.current.restart(now, false);
        } else {
          // When switching to count down, set expiry to now + current time
          const totalSeconds = timerRef.current.totalSeconds;
          const now = new Date();
          now.setSeconds(now.getSeconds() + totalSeconds);
          timerRef.current.restart(now, false);
        }
      }
    },
    [tournamentId, setTimer],
  );

  if (!tournament) {
    return <p>Loading...</p>;
  }

  // Get reset target for disabled check
  const getResetTarget = () => {
    if (countDirection === "up") {
      return 0;
    } else {
      return initialMinutes * 60 + initialSeconds;
    }
  };

  return (
    <Card className="flex flex-col">
      <CardContent className="flex-1 flex flex-col items-center justify-center gap-6">
        {/* Count Direction Toggle */}
        <div className="flex items-center gap-3">
          <Label htmlFor="countDirection" className="text-sm">
            Count Down
          </Label>
          <Switch
            id="countDirection"
            checked={countDirection === "up"}
            onCheckedChange={handleCountDirectionToggle}
          />
          <Label htmlFor="countDirection" className="text-sm">
            Count Up
          </Label>
        </div>

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
                {formatTime(timer.totalSeconds, countDirection === "down")}
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
            <Button
              onClick={() => timerRef.current.pause()}
              size="lg"
              className="px-6"
            >
              <Pause className="w-5 h-5 mr-2" />
              Pause
            </Button>
          ) : (
            <Button
              onClick={() => timerRef.current.resume()}
              size="lg"
              className="px-6"
              disabled={
                countDirection === "down" && timer.totalSeconds === 0
              }
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
              disabled={timer.totalSeconds === getResetTarget()}
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
          ) : countDirection === "down" && timer.totalSeconds <= 0 ? (
            <span className="text-red-600">Finished</span>
          ) : (
            <span className="text-yellow-600">Paused</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
