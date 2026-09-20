"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { AutomationTrigger, AUTOMATION_TRIGGERS } from "@/convex/validators";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  buildObsCommand,
  AutomationAction,
  COMMAND_KINDS,
  COMMAND_LABELS,
  CONDITION_OPS,
  ObsCommandKind,
  TRIGGER_FIELDS,
  TRIGGER_LABELS,
} from "../automation-labels";

type ConditionOp = (typeof CONDITION_OPS)[number]["value"];

type ConditionInput = { path: string; op: ConditionOp; value: string };

type FormState = {
  name: string;
  trigger: AutomationTrigger;
  conditions: ConditionInput[];
  actionType: "obs" | "webhook";
  // OBS
  controllerId: string;
  commandKind: ObsCommandKind;
  sceneName: string;
  sourceName: string;
  filterName: string;
  enabled: boolean;
  requestType: string;
  requestData: string;
  // Webhook
  url: string;
  method: "POST" | "PUT" | "GET";
  webhookSecret: string;
  headers: string;
  bodyTemplate: string;
};

const initialState: FormState = {
  name: "",
  trigger: "round.started",
  conditions: [],
  actionType: "obs",
  controllerId: "",
  commandKind: "streaming.stop",
  sceneName: "",
  sourceName: "",
  filterName: "",
  enabled: true,
  requestType: "",
  requestData: "",
  url: "",
  method: "POST",
  webhookSecret: "",
  headers: "",
  bodyTemplate: "",
};

function parseHeaders(
  raw: string,
): { headers: Record<string, string> } | { error: string } {
  const headers: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf(":");
    if (separator <= 0) {
      return { error: `Header line "${trimmed}" must look like Name: value` };
    }
    headers[trimmed.slice(0, separator).trim()] = trimmed
      .slice(separator + 1)
      .trim();
  }
  return { headers };
}

function coerceConditionValue(raw: string): string | number | boolean {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  return raw;
}

export function AutomationForm() {
  const controllers = useQuery(api.automations.listControllers);
  const createAutomation = useMutation(api.automations.createAutomation);
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<FormState>) =>
    setForm((current) => ({ ...current, ...patch }));

  const needsScene =
    form.commandKind === "scene.set" ||
    form.commandKind === "sceneItem.setEnabled";
  const needsSource =
    form.commandKind === "sceneItem.setEnabled" ||
    form.commandKind === "filter.setEnabled";
  const needsFilter = form.commandKind === "filter.setEnabled";
  const needsEnabled =
    form.commandKind === "sceneItem.setEnabled" ||
    form.commandKind === "filter.setEnabled";
  const isRaw = form.commandKind === "raw";

  const buildAction = (): AutomationAction | { error: string } => {
    if (form.actionType === "obs") {
      if (!form.controllerId) return { error: "Choose an OBS controller" };
      const command = buildObsCommand({ ...form, kind: form.commandKind });
      if ("error" in command) return command;
      return {
        type: "obs",
        controllerId: form.controllerId as Id<"obsControllers">,
        command,
      };
    }
    if (!form.url.trim()) return { error: "Webhook URL is required" };
    const parsed = parseHeaders(form.headers);
    if ("error" in parsed) return parsed;
    const { headers } = parsed;
    return {
      type: "webhook",
      url: form.url.trim(),
      method: form.method,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      bodyTemplate: form.bodyTemplate.trim() || undefined,
    };
  };

  const handleSave = async () => {
    setError("");
    if (!form.name.trim()) {
      setError("Give the automation a name");
      return;
    }
    const action = buildAction();
    if ("error" in action) {
      setError(action.error);
      return;
    }
    const conditions = form.conditions
      .filter((condition) => condition.path.trim() !== "")
      .map((condition) => ({
        path: condition.path.trim(),
        op: condition.op,
        value: coerceConditionValue(condition.value),
      }));

    setSaving(true);
    try {
      await createAutomation({
        name: form.name.trim(),
        trigger: form.trigger,
        conditions,
        action,
        webhookSecret:
          form.actionType === "webhook" && form.webhookSecret
            ? form.webhookSecret
            : undefined,
      });
      setForm(initialState);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Automation</CardTitle>
        <CardDescription>
          When a trigger fires and every condition passes, run the action.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="automationName">Name</Label>
          <Input
            id="automationName"
            placeholder="e.g. Stop stream between rounds"
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            className="max-w-md"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>When</Label>
          <Select
            value={form.trigger}
            onValueChange={(value) =>
              update({ trigger: value as AutomationTrigger, conditions: [] })
            }
          >
            <SelectTrigger className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTOMATION_TRIGGERS.map((trigger) => (
                <SelectItem key={trigger} value={trigger}>
                  {TRIGGER_LABELS[trigger]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Fields: {TRIGGER_FIELDS[form.trigger].join(", ")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Only if</Label>
          {form.conditions.map((condition, index) => (
            <div key={index} className="flex flex-wrap gap-2">
              <Select
                value={condition.path}
                onValueChange={(path) =>
                  update({
                    conditions: form.conditions.map((c, i) =>
                      i === index ? { ...c, path } : c,
                    ),
                  })
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="field" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_FIELDS[form.trigger].map((field) => (
                    <SelectItem key={field} value={field}>
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={condition.op}
                onValueChange={(op) =>
                  update({
                    conditions: form.conditions.map((c, i) =>
                      i === index ? { ...c, op: op as ConditionOp } : c,
                    ),
                  })
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="w-40"
                placeholder="value"
                value={condition.value}
                onChange={(e) =>
                  update({
                    conditions: form.conditions.map((c, i) =>
                      i === index ? { ...c, value: e.target.value } : c,
                    ),
                  })
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  update({
                    conditions: form.conditions.filter((_, i) => i !== index),
                  })
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                update({
                  conditions: [
                    ...form.conditions,
                    {
                      path: TRIGGER_FIELDS[form.trigger][0],
                      op: "equals",
                      value: "",
                    },
                  ],
                })
              }
            >
              Add condition
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Then</Label>
          <Select
            value={form.actionType}
            onValueChange={(value) =>
              update({ actionType: value as FormState["actionType"] })
            }
          >
            <SelectTrigger className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="obs">Send a command to OBS</SelectItem>
              <SelectItem value="webhook">Call a webhook</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.actionType === "obs" ? (
          <div className="flex flex-col gap-4 rounded-lg border p-4">
            <div className="flex flex-col gap-2">
              <Label>OBS controller</Label>
              <Select
                value={form.controllerId}
                onValueChange={(controllerId) => update({ controllerId })}
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue
                    placeholder={
                      controllers && controllers.length === 0
                        ? "Add a controller above first"
                        : "Choose a controller"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {controllers?.map((controller) => (
                    <SelectItem key={controller._id} value={controller._id}>
                      {controller.name}
                      {controller.online ? "" : " (offline)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Command</Label>
              <Select
                value={form.commandKind}
                onValueChange={(commandKind) =>
                  update({ commandKind: commandKind as ObsCommandKind })
                }
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMAND_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {COMMAND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsScene && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="sceneName">Scene name</Label>
                <Input
                  id="sceneName"
                  value={form.sceneName}
                  onChange={(e) => update({ sceneName: e.target.value })}
                  className="max-w-md"
                />
              </div>
            )}
            {needsSource && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="sourceName">Source name</Label>
                <Input
                  id="sourceName"
                  value={form.sourceName}
                  onChange={(e) => update({ sourceName: e.target.value })}
                  className="max-w-md"
                />
              </div>
            )}
            {needsFilter && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="filterName">Filter name</Label>
                <Input
                  id="filterName"
                  value={form.filterName}
                  onChange={(e) => update({ filterName: e.target.value })}
                  className="max-w-md"
                />
              </div>
            )}
            {needsEnabled && (
              <div className="flex items-center gap-3">
                <Switch
                  id="enabled"
                  checked={form.enabled}
                  onCheckedChange={(enabled) => update({ enabled })}
                />
                <Label htmlFor="enabled">
                  {form.enabled ? "Enable / show" : "Disable / hide"}
                </Label>
              </div>
            )}
            {isRaw && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="requestType">Request type</Label>
                  <Input
                    id="requestType"
                    placeholder="e.g. TriggerHotkeyByName"
                    value={form.requestType}
                    onChange={(e) => update({ requestType: e.target.value })}
                    className="max-w-md"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="requestData">Request data (JSON)</Label>
                  <Textarea
                    id="requestData"
                    placeholder='{"hotkeyName": "OBSBasic.StartStreaming"}'
                    value={form.requestData}
                    onChange={(e) => update({ requestData: e.target.value })}
                    className="max-w-md font-mono"
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-lg border p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="webhookUrl">URL</Label>
              <div className="flex gap-2">
                <Select
                  value={form.method}
                  onValueChange={(method) =>
                    update({ method: method as FormState["method"] })
                  }
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="webhookUrl"
                  placeholder="https://example.com/hooks/manastream"
                  value={form.url}
                  onChange={(e) => update({ url: e.target.value })}
                  className="max-w-md"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="webhookSecret">Signing secret (optional)</Label>
              <Input
                id="webhookSecret"
                type="password"
                autoComplete="new-password"
                value={form.webhookSecret}
                onChange={(e) => update({ webhookSecret: e.target.value })}
                className="max-w-md"
              />
              <p className="text-xs text-muted-foreground">
                Requests carry X-ManaStream-Signature, an HMAC-SHA256 of
                &quot;timestamp.body&quot; using this secret.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="webhookHeaders">
                Extra headers (one per line, Name: value)
              </Label>
              <Textarea
                id="webhookHeaders"
                value={form.headers}
                onChange={(e) => update({ headers: e.target.value })}
                className="max-w-md font-mono"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bodyTemplate">Body template (optional)</Label>
              <Textarea
                id="bodyTemplate"
                placeholder='{"content": "Round {{payload.roundNumber}} has started"}'
                value={form.bodyTemplate}
                onChange={(e) => update({ bodyTemplate: e.target.value })}
                className="max-w-md font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{type}}"}, {"{{payload.<field>}}"}, {"{{tournamentId}}"}
                . Leave empty to send the full event as JSON.
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter>
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? (
            <span className="flex items-center gap-2">
              <Spinner className="size-4" /> Saving...
            </span>
          ) : (
            "Create automation"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
