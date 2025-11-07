"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const settings = useQuery(api.settings.getSettings);
  const tournament = useQuery(api.tournaments.getUserTournament);
  const spicerackLogs = useQuery(api.settings.getSpicerackLogs);
  const updateSettings = useMutation(api.settings.updateSettings);
  const updateTournament = useMutation(
    api.tournaments.updateTournamentSettings,
  );
  const [inputs, setInputs] = useState({
    spicerackApiKey: settings?.spicerackApiKey ?? "",
    spicerackTournamentId: tournament?.spicerackTournamentId ?? undefined,
    spicerackMode: tournament?.mode ?? "manual",
  });
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setInputs({
      spicerackApiKey: settings?.spicerackApiKey ?? "",
      spicerackTournamentId: tournament?.spicerackTournamentId ?? undefined,
      spicerackMode: tournament?.mode ?? "manual",
    });
    setErrorVisible(false);
    setErrorMessage("");
  }, [settings, tournament]);

  if (!settings || !tournament) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  const hasChanges =
    inputs.spicerackApiKey !== settings?.spicerackApiKey ||
    inputs.spicerackTournamentId !== tournament?.spicerackTournamentId ||
    inputs.spicerackMode !== tournament?.mode;

  const handleSave = () => {
    setIsSaving(true);
    updateSettings({
      spicerackApiKey: inputs.spicerackApiKey,
    });
    try {
      updateTournament({
        spicerackTournamentId: inputs.spicerackTournamentId,
        mode: inputs.spicerackMode,
      });
    } catch (error) {
      setErrorVisible(true);
      setErrorMessage(String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "text-green-500";
      case "error":
        return "text-red-500";
      case "warning":
        return "text-yellow-500";
      case "info":
      default:
        return "text-white/60";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="-mt-[1px] -ml-[1px]">
        <Card>
          <CardHeader>
            <CardTitle>Tournament Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="spicerackApiKey">Spicerack API Key</Label>
                <Input
                  id="spicerackApiKey"
                  value={inputs.spicerackApiKey}
                  onChange={(e) =>
                    setInputs({ ...inputs, spicerackApiKey: e.target.value })
                  }
                  className="max-w-md"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="spicerackTournamentId">
                  Spicerack Tournament ID
                </Label>
                <Input
                  id="spicerackTournamentId"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={inputs.spicerackTournamentId ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty or only numeric values
                    if (value === "" || /^\d+$/.test(value)) {
                      setInputs({
                        ...inputs,
                        spicerackTournamentId:
                          value === "" ? undefined : Number(value),
                      });
                      setErrorVisible(false);
                    } else {
                      setErrorVisible(true);
                      setErrorMessage("Tournament ID must be a number");
                    }
                  }}
                  aria-invalid={errorVisible}
                  className="max-w-md"
                />
                {errorVisible && (
                  <p className="text-sm text-destructive">{errorMessage}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="spicerackMode">Spicerack Auto Mode</Label>
                <Switch
                  id="spicerackMode"
                  checked={inputs.spicerackMode === "auto"}
                  onCheckedChange={(checked) =>
                    setInputs({
                      ...inputs,
                      spicerackMode: checked ? "auto" : "manual",
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || errorVisible}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Spinner className="size-4" /> Saving...
                </span>
              ) : (
                "Save"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
      <div className="-mt-[1px] -ml-[1px]">
        <Card>
          <CardHeader>
            <CardTitle>Spicerack Debug Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="sunken rounded-lg p-4 max-h-[300px] overflow-y-auto">
              {!spicerackLogs || spicerackLogs.length === 0 ? (
                <div className="text-sm text-white/40 font-mono">
                  No logs yet. Enable auto mode to start polling.
                </div>
              ) : (
                <div className="flex flex-col gap-2 font-mono">
                  {spicerackLogs.map((log) => (
                    <div
                      key={log._id}
                      className="flex flex-row gap-3 text-xs border-b border-white/10 pb-2 last:border-b-0"
                    >
                      <div className="text-white/40 shrink-0 w-20">
                        {formatTimestamp(log.timestamp)}
                      </div>
                      <div className="text-white/50 shrink-0 w-32 truncate">
                        {log.action}
                      </div>
                      <div
                        className={`shrink-0 w-16 ${getStatusColor(log.status)}`}
                      >
                        {log.status.toUpperCase()}
                      </div>
                      <div className="text-white/60 flex-1">{log.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="pattern-stripes h-full w-full grow"></div>
    </div>
  );
}
