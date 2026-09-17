import { Infer } from "convex/values";
import {
  automationActionValidator,
  obsCommandValidator,
  AutomationTrigger,
} from "../../../convex/validators";

export type AutomationAction = Infer<typeof automationActionValidator>;
export type ObsCommand = Infer<typeof obsCommandValidator>;
export type ObsCommandKind = ObsCommand["kind"];

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  "round.started": "New round detected",
  "timer.started": "Round timer started",
  "timer.paused": "Round timer paused",
  "tournament.polling.started": "Tournament sync started",
  "tournament.polling.stopped": "Tournament sync stopped",
  "tournament.polling.error": "Tournament sync error",
  "obs.streaming.started": "OBS started streaming",
  "obs.streaming.stopped": "OBS stopped streaming",
  "obs.scene.changed": "OBS scene changed",
};

/** Payload fields available to conditions and templates for each trigger. */
export const TRIGGER_FIELDS: Record<AutomationTrigger, string[]> = {
  "round.started": [
    "roundNumber",
    "roundDisplayName",
    "roundId",
    "previousRoundNumber",
    "eventName",
  ],
  "timer.started": ["countDirection", "secondsRemaining", "eventName"],
  "timer.paused": ["countDirection", "secondsRemaining", "eventName"],
  "tournament.polling.started": ["status", "eventName"],
  "tournament.polling.stopped": ["status", "eventName"],
  "tournament.polling.error": ["status", "errorMessage", "eventName"],
  "obs.streaming.started": ["controllerName", "streaming"],
  "obs.streaming.stopped": ["controllerName", "streaming"],
  "obs.scene.changed": ["sceneName", "previousSceneName", "controllerName"],
};

export const COMMAND_LABELS: Record<ObsCommandKind, string> = {
  "streaming.start": "Start streaming",
  "streaming.stop": "Stop streaming",
  "recording.start": "Start recording",
  "recording.stop": "Stop recording",
  "replayBuffer.save": "Save replay buffer",
  "scene.set": "Switch scene",
  "sceneItem.setEnabled": "Show or hide a source",
  "filter.setEnabled": "Enable or disable a filter",
  raw: "Raw obs-websocket request",
};

export const COMMAND_KINDS = Object.keys(COMMAND_LABELS) as ObsCommandKind[];

export const CONDITION_OPS = [
  { value: "equals", label: "equals" },
  { value: "notEquals", label: "does not equal" },
  { value: "gt", label: "is greater than" },
  { value: "gte", label: "is at least" },
  { value: "lt", label: "is less than" },
  { value: "lte", label: "is at most" },
  { value: "contains", label: "contains" },
] as const;

export function describeCommand(command: ObsCommand): string {
  switch (command.kind) {
    case "scene.set":
      return `${COMMAND_LABELS[command.kind]} to "${command.sceneName}"`;
    case "sceneItem.setEnabled":
      return `${command.enabled ? "Show" : "Hide"} "${command.sourceName}" in "${command.sceneName}"`;
    case "filter.setEnabled":
      return `${command.enabled ? "Enable" : "Disable"} filter "${command.filterName}" on "${command.sourceName}"`;
    case "raw":
      return `Raw request ${command.requestType}`;
    default:
      return COMMAND_LABELS[command.kind];
  }
}

export function describeAction(
  action: AutomationAction,
  controllerNames: Map<string, string>,
): string {
  if (action.type === "webhook") {
    let host = action.url;
    try {
      host = new URL(action.url).host;
    } catch {
      // Show the raw value when it is not a parseable URL.
    }
    return `${action.method} webhook to ${host}`;
  }
  const controller =
    controllerNames.get(action.controllerId) ?? "deleted controller";
  return `${describeCommand(action.command)} on ${controller}`;
}

/**
 * Builds a command object from the form's flat field state. Returns an error
 * string instead of a command when a required field is missing.
 */
export function buildObsCommand(input: {
  kind: ObsCommandKind;
  sceneName: string;
  sourceName: string;
  filterName: string;
  enabled: boolean;
  requestType: string;
  requestData: string;
}): ObsCommand | { error: string } {
  const sceneName = input.sceneName.trim();
  const sourceName = input.sourceName.trim();
  const filterName = input.filterName.trim();
  switch (input.kind) {
    case "scene.set":
      if (!sceneName) return { error: "Scene name is required" };
      return { kind: "scene.set", sceneName };
    case "sceneItem.setEnabled":
      if (!sceneName || !sourceName) {
        return { error: "Scene name and source name are required" };
      }
      return {
        kind: "sceneItem.setEnabled",
        sceneName,
        sourceName,
        enabled: input.enabled,
      };
    case "filter.setEnabled":
      if (!sourceName || !filterName) {
        return { error: "Source name and filter name are required" };
      }
      return {
        kind: "filter.setEnabled",
        sourceName,
        filterName,
        enabled: input.enabled,
      };
    case "raw": {
      const requestType = input.requestType.trim();
      if (!requestType) return { error: "Request type is required" };
      const raw = input.requestData.trim();
      if (raw === "") return { kind: "raw", requestType };
      try {
        return { kind: "raw", requestType, requestData: JSON.parse(raw) };
      } catch {
        return { error: "Request data must be valid JSON" };
      }
    }
    default:
      return { kind: input.kind };
  }
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
