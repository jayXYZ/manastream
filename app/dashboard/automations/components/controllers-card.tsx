"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CopyButton from "@/components/copy-button";
import { formatRelativeTime } from "../automation-labels";

export function ControllersCard() {
  const controllers = useQuery(api.automations.listControllers);
  const createController = useMutation(api.automations.createController);
  const regenerateToken = useMutation(
    api.automations.regenerateControllerToken,
  );
  const deleteController = useMutation(api.automations.deleteController);

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = () =>
    run(async () => {
      await createController({ name });
      setName("");
    });

  const handleRegenerate = (controllerId: Id<"obsControllers">) => {
    if (
      !window.confirm(
        "Regenerate this token? The bridge using the old token will stop receiving commands.",
      )
    ) {
      return;
    }
    void run(() => regenerateToken({ controllerId }));
  };

  const handleDelete = (controllerId: Id<"obsControllers">) => {
    if (!window.confirm("Delete this OBS controller?")) return;
    void run(() => deleteController({ controllerId }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>OBS Controllers</CardTitle>
        <CardDescription>
          One controller per OBS machine. Run the bridge on that machine with
          the token below; see packages/obs-bridge/README.md for setup.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {controllers && controllers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No controllers yet. Add one to start sending OBS commands.
          </p>
        )}
        {controllers?.map((controller) => (
          <div
            key={controller._id}
            className="flex flex-col gap-2 rounded-lg border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block size-2 rounded-full ${
                    controller.online ? "bg-green-500" : "bg-white/30"
                  }`}
                  aria-hidden
                />
                <span className="font-medium">{controller.name}</span>
                <span className="text-xs text-muted-foreground">
                  {controller.online
                    ? describeObsState(controller.obsState)
                    : controller.lastSeenAt
                      ? `offline, last seen ${formatRelativeTime(controller.lastSeenAt)}`
                      : "bridge has never connected"}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => handleRegenerate(controller._id)}
                >
                  Regenerate token
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => handleDelete(controller._id)}
                >
                  Delete
                </Button>
              </div>
            </div>
            <CopyButton
              displayText={controller.token}
              textToCopy={controller.token}
            />
          </div>
        ))}

        <div className="flex flex-col gap-2">
          <Label htmlFor="controllerName">Add a controller</Label>
          <div className="flex gap-2">
            <Input
              id="controllerName"
              placeholder="e.g. Main stream PC"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) void handleCreate();
              }}
              className="max-w-md"
            />
            <Button
              onClick={() => void handleCreate()}
              disabled={busy || !name.trim()}
            >
              Add
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function describeObsState(
  state:
    | {
        connected: boolean;
        streaming?: boolean;
        recording?: boolean;
        currentScene?: string;
      }
    | undefined,
): string {
  if (!state) return "bridge online";
  if (!state.connected) return "bridge online, OBS not connected";
  const parts = [
    state.streaming ? "streaming" : "not streaming",
    ...(state.recording ? ["recording"] : []),
    ...(state.currentScene ? [`scene: ${state.currentScene}`] : []),
  ];
  return parts.join(", ");
}
