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
import { Switch } from "@/components/ui/switch";
import {
  describeAction,
  formatRelativeTime,
  TRIGGER_LABELS,
} from "../automation-labels";

export function AutomationsCard() {
  const automations = useQuery(api.automations.listAutomations);
  const controllers = useQuery(api.automations.listControllers);
  const setEnabled = useMutation(api.automations.setAutomationEnabled);
  const deleteAutomation = useMutation(api.automations.deleteAutomation);
  const sendTestEvent = useMutation(api.automations.sendTestEvent);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState<string | null>(null);

  const controllerNames = new Map(
    (controllers ?? []).map((controller) => [controller._id, controller.name]),
  );

  const handleTest = async (automationId: Id<"automations">) => {
    setError("");
    setTesting(automationId);
    try {
      await sendTestEvent({ automationId });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (automationId: Id<"automations">) => {
    if (!window.confirm("Delete this automation?")) return;
    setError("");
    try {
      await deleteAutomation({ automationId });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automations</CardTitle>
        <CardDescription>
          Test sends a sample event through the action right now, ignoring
          conditions and the enabled switch.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {automations && automations.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No automations yet. Create one below.
          </p>
        )}
        {automations?.map((automation) => (
          <div
            key={automation._id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={automation.enabled}
                onCheckedChange={(enabled) =>
                  void setEnabled({ automationId: automation._id, enabled })
                }
                aria-label={`Enable ${automation.name}`}
              />
              <div className="flex flex-col">
                <span className="font-medium">{automation.name}</span>
                <span className="text-xs text-muted-foreground">
                  {TRIGGER_LABELS[automation.trigger]}
                  {automation.conditions.length > 0 &&
                    ` (${automation.conditions.length} condition${
                      automation.conditions.length === 1 ? "" : "s"
                    })`}{" "}
                  &rarr; {describeAction(automation.action, controllerNames)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {automation.lastTriggeredAt
                    ? `Last run ${formatRelativeTime(automation.lastTriggeredAt)}`
                    : "Never run"}
                  {automation.consecutiveFailures > 0 &&
                    ` · ${automation.consecutiveFailures} consecutive failure${
                      automation.consecutiveFailures === 1 ? "" : "s"
                    }`}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={testing !== null}
                onClick={() => void handleTest(automation._id)}
              >
                {testing === automation._id ? "Sending..." : "Test"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleDelete(automation._id)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
