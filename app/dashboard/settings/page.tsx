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
import { RefreshSyncButton } from "@/components/sync/refresh-sync-button";

type SettingsFormInputs = {
  meleeClientId: string;
  meleeClientSecret: string;
  externalTournamentId: number | undefined;
  syncMode: "manual" | "auto";
};

function getSettingsFormInputs(
  settings: { meleeClientId: string } | undefined,
  tournament:
    | { externalTournamentId?: number; mode: "manual" | "auto" }
    | null
    | undefined,
): SettingsFormInputs {
  return {
    meleeClientId: settings?.meleeClientId ?? "",
    // The saved secret is never sent to the client; the field starts empty
    // and a non-empty value means "replace the stored secret".
    meleeClientSecret: "",
    externalTournamentId: tournament?.externalTournamentId ?? undefined,
    syncMode: tournament?.mode ?? "manual",
  };
}

export default function SettingsPage() {
  const settings = useQuery(api.settings.getSettings);
  const tournament = useQuery(api.tournaments.getUserTournament);
  const integrationLogs = useQuery(api.settings.getIntegrationLogs);
  const updateSettings = useMutation(api.settings.updateSettings);
  const updateTournament = useMutation(
    api.tournaments.updateTournamentSettings,
  );
  const [inputs, setInputs] = useState<SettingsFormInputs>(() =>
    getSettingsFormInputs(settings, tournament),
  );
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setInputs(getSettingsFormInputs(settings, tournament));
    setErrorVisible(false);
    setErrorMessage("");
  }, [settings, tournament]);

  const savedInputs = getSettingsFormInputs(settings, tournament);
  const hasChanges =
    inputs.meleeClientId !== savedInputs.meleeClientId ||
    inputs.meleeClientSecret !== "" ||
    inputs.externalTournamentId !== savedInputs.externalTournamentId ||
    inputs.syncMode !== savedInputs.syncMode;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        meleeClientId: inputs.meleeClientId,
        // Omit the secret when the field is empty so the stored one is kept.
        meleeClientSecret:
          inputs.meleeClientSecret === ""
            ? undefined
            : inputs.meleeClientSecret,
      });
      await updateTournament({
        externalTournamentId: inputs.externalTournamentId,
        mode: inputs.syncMode,
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

  if (!settings || !tournament) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

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
                <Label htmlFor="meleeClientId">Melee Client ID</Label>
                <Input
                  id="meleeClientId"
                  value={inputs.meleeClientId}
                  onChange={(e) =>
                    setInputs({ ...inputs, meleeClientId: e.target.value })
                  }
                  className="max-w-md"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="meleeClientSecret">Melee Client Secret</Label>
                <Input
                  id="meleeClientSecret"
                  type="password"
                  value={inputs.meleeClientSecret}
                  placeholder={
                    settings?.hasMeleeClientSecret
                      ? "••••••••  (saved — enter a new value to replace)"
                      : "Enter client secret"
                  }
                  autoComplete="new-password"
                  onChange={(e) =>
                    setInputs({
                      ...inputs,
                      meleeClientSecret: e.target.value,
                    })
                  }
                  className="max-w-md"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="externalTournamentId">
                  Melee Tournament ID
                </Label>
                <Input
                  id="externalTournamentId"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={inputs.externalTournamentId ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty or only numeric values
                    if (value === "" || /^\d+$/.test(value)) {
                      setInputs({
                        ...inputs,
                        externalTournamentId:
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
                <Label htmlFor="syncMode">Auto Sync</Label>
                <div className="flex items-start gap-4">
                  <Switch
                    id="syncMode"
                    checked={inputs.syncMode === "auto"}
                    onCheckedChange={(checked) =>
                      setInputs({
                        ...inputs,
                        syncMode: checked ? "auto" : "manual",
                      })
                    }
                  />
                  <RefreshSyncButton tournament={tournament} />
                </div>
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
            <CardTitle>Sync Debug Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="sunken rounded-lg p-4 max-h-[300px] overflow-y-auto">
              {!integrationLogs || integrationLogs.length === 0 ? (
                <div className="text-sm text-white/40 font-mono">
                  No logs yet. Enable auto mode to start polling.
                </div>
              ) : (
                <div className="flex flex-col gap-2 font-mono">
                  {integrationLogs.map((log) => (
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
