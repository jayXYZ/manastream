import { Infer } from "convex/values";
import { MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
  automationConditionValidator,
  AutomationTrigger,
} from "../validators";
import { logIntegrationEvent } from "./logging";

export type AutomationCondition = Infer<typeof automationConditionValidator>;

/** How long an OBS command stays claimable before a bridge must drop it. */
export const OBS_COMMAND_TTL_MS = 60 * 1000;

/** Automations are disabled after this many consecutive failed deliveries. */
export const MAX_CONSECUTIVE_FAILURES = 10;

/** Webhook retry schedule in milliseconds, indexed by attempt number. */
export const WEBHOOK_RETRY_DELAYS_MS = [0, 5 * 1000, 30 * 1000];

/** A bridge is considered online if it checked in within this window. */
export const BRIDGE_ONLINE_WINDOW_MS = 90 * 1000;

export type AutomationEventEnvelope = {
  id: string;
  type: AutomationTrigger;
  createdAt: number;
  tournamentId?: string;
  isTest: boolean;
  payload: unknown;
};

// ---------------------------------------------------------------------------
// Pure helpers (unit tested)
// ---------------------------------------------------------------------------

/**
 * Reads a dot-separated path out of an arbitrary value. Returns undefined
 * for any missing segment rather than throwing.
 */
export function getPath(value: unknown, path: string): unknown {
  if (path === "") return value;
  let current: unknown = value;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function evaluateCondition(
  condition: AutomationCondition,
  payload: unknown,
): boolean {
  const actual = getPath(payload, condition.path);
  const expected = condition.value;

  switch (condition.op) {
    case "equals":
      return looselyEqual(actual, expected);
    case "notEquals":
      return !looselyEqual(actual, expected);
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const left = toNumber(actual);
      const right = toNumber(expected);
      if (left === undefined || right === undefined) return false;
      if (condition.op === "gt") return left > right;
      if (condition.op === "gte") return left >= right;
      if (condition.op === "lt") return left < right;
      return left <= right;
    }
    case "contains": {
      if (typeof actual === "string") {
        return actual.toLowerCase().includes(String(expected).toLowerCase());
      }
      if (Array.isArray(actual)) {
        return actual.some((item) => looselyEqual(item, expected));
      }
      return false;
    }
  }
}

export function conditionsPass(
  conditions: AutomationCondition[],
  payload: unknown,
): boolean {
  return conditions.every((condition) =>
    evaluateCondition(condition, payload),
  );
}

function looselyEqual(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (typeof expected === "number") return toNumber(actual) === expected;
  if (typeof expected === "boolean") {
    if (typeof actual === "string") {
      return actual.toLowerCase() === String(expected);
    }
    return actual === expected;
  }
  return String(actual) === String(expected);
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Replaces `{{path}}` placeholders with values from the event envelope.
 * Objects are serialized as JSON; missing paths become empty strings.
 */
export function renderTemplate(
  template: string,
  envelope: AutomationEventEnvelope,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const value = getPath(envelope, path);
    if (value === undefined || value === null) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

/**
 * Basic guard against pointing webhooks at the backend's own network.
 * Only http(s) URLs to non-local hosts are accepted.
 */
export function validateWebhookUrl(rawUrl: string): string | undefined {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "Webhook URL is not a valid URL";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Webhook URL must use http or https";
  }
  const host = url.hostname.toLowerCase();
  const isLocal =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isLocal) {
    return "Webhook URL must point at a publicly reachable host";
  }
  return undefined;
}

export function buildEventEnvelope(
  event: Doc<"automationEvents">,
): AutomationEventEnvelope {
  return {
    id: event._id,
    type: event.type,
    createdAt: event.createdAt,
    tournamentId: event.tournamentId,
    isTest: event.isTest ?? false,
    payload: event.payload,
  };
}

export function automationMatchesEvent(
  automation: Pick<Doc<"automations">, "enabled" | "trigger" | "conditions">,
  event: Pick<Doc<"automationEvents">, "type" | "payload">,
): boolean {
  if (!automation.enabled) return false;
  if (automation.trigger !== event.type) return false;
  return conditionsPass(automation.conditions, event.payload);
}

export function isBridgeOnline(
  controller: Pick<Doc<"obsControllers">, "lastSeenAt">,
  now: number = Date.now(),
): boolean {
  return (
    controller.lastSeenAt !== undefined &&
    now - controller.lastSeenAt < BRIDGE_ONLINE_WINDOW_MS
  );
}

// ---------------------------------------------------------------------------
// Engine: emit an event and fan out to matching automations
// ---------------------------------------------------------------------------

export type EmitAutomationEventArgs = {
  userId: Id<"users">;
  tournamentId?: Id<"tournaments">;
  type: AutomationTrigger;
  payload: Record<string, unknown>;
  /** When set, a second emit with the same key is a no-op. */
  dedupeKey?: string;
};

/**
 * Records an event and dispatches every matching automation for the user.
 * Safe to call from any mutation; never throws for delivery problems so the
 * calling mutation's own work is not rolled back by a bad automation.
 */
export async function emitAutomationEvent(
  ctx: MutationCtx,
  args: EmitAutomationEventArgs,
): Promise<Id<"automationEvents"> | undefined> {
  if (args.dedupeKey !== undefined) {
    const existing = await ctx.db
      .query("automationEvents")
      .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", args.dedupeKey))
      .first();
    if (existing) {
      return undefined;
    }
  }

  const now = Date.now();
  const eventId = await ctx.db.insert("automationEvents", {
    userId: args.userId,
    tournamentId: args.tournamentId,
    type: args.type,
    payload: args.payload,
    dedupeKey: args.dedupeKey,
    createdAt: now,
  });
  const event = (await ctx.db.get(eventId))!;

  const automations = await ctx.db
    .query("automations")
    .withIndex("by_user_and_trigger", (q) =>
      q.eq("userId", args.userId).eq("trigger", args.type),
    )
    .collect();

  for (const automation of automations) {
    if (!automationMatchesEvent(automation, event)) continue;
    await dispatchAutomation(ctx, automation, event);
  }

  return eventId;
}

/**
 * Creates a delivery for one automation and starts its action. Used by the
 * emitter and by the dashboard "send test event" flow.
 */
export async function dispatchAutomation(
  ctx: MutationCtx,
  automation: Doc<"automations">,
  event: Doc<"automationEvents">,
): Promise<Id<"automationDeliveries">> {
  const now = Date.now();
  const deliveryId = await ctx.db.insert("automationDeliveries", {
    userId: automation.userId,
    automationId: automation._id,
    eventId: event._id,
    actionType: automation.action.type,
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.patch(automation._id, { lastTriggeredAt: now });

  switch (automation.action.type) {
    case "webhook": {
      await ctx.scheduler.runAfter(
        0,
        internal.automations.deliverWebhook,
        { deliveryId },
      );
      break;
    }
    case "obs": {
      const controller = await ctx.db.get(automation.action.controllerId);
      if (!controller || controller.userId !== automation.userId) {
        await ctx.db.patch(deliveryId, {
          status: "failed",
          attempts: 1,
          lastError: "OBS controller no longer exists",
          updatedAt: now,
        });
        break;
      }
      const obsCommandId = await ctx.db.insert("obsCommands", {
        userId: automation.userId,
        controllerId: controller._id,
        deliveryId,
        command: automation.action.command,
        status: "pending",
        expiresAt: now + OBS_COMMAND_TTL_MS,
        createdAt: now,
      });
      await ctx.db.patch(deliveryId, { obsCommandId, updatedAt: now });
      // Sweep the command if no bridge picks it up in time.
      await ctx.scheduler.runAfter(
        OBS_COMMAND_TTL_MS + 1000,
        internal.automations.expireObsCommand,
        { obsCommandId },
      );
      break;
    }
  }

  return deliveryId;
}

/**
 * Applies a delivery outcome and the automation's failure bookkeeping.
 */
export async function recordDeliveryOutcome(
  ctx: MutationCtx,
  args: {
    deliveryId: Id<"automationDeliveries">;
    status: "success" | "failed";
    attempts: number;
    error?: string;
    responseStatus?: number;
  },
): Promise<void> {
  const delivery = await ctx.db.get(args.deliveryId);
  if (!delivery) return;
  const now = Date.now();

  await ctx.db.patch(delivery._id, {
    status: args.status,
    attempts: args.attempts,
    lastError: args.error,
    responseStatus: args.responseStatus,
    updatedAt: now,
  });

  const automation = await ctx.db.get(delivery.automationId);
  if (!automation) return;

  if (args.status === "success") {
    if (automation.consecutiveFailures !== 0) {
      await ctx.db.patch(automation._id, {
        consecutiveFailures: 0,
        updatedAt: now,
      });
    }
    return;
  }

  const consecutiveFailures = automation.consecutiveFailures + 1;
  const shouldDisable = consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
  await ctx.db.patch(automation._id, {
    consecutiveFailures,
    ...(shouldDisable ? { enabled: false } : {}),
    updatedAt: now,
  });

  if (shouldDisable) {
    await logIntegrationEvent(ctx, {
      userId: automation.userId,
      action: "AUTOMATION_DISABLED",
      status: "warning",
      message: `Automation "${automation.name}" was disabled after ${consecutiveFailures} consecutive failures`,
      metadata: { automationId: automation._id, lastError: args.error },
    });
  }
}

/**
 * Computes the HMAC-SHA256 signature header value for a webhook request.
 * Signed payload is `${timestamp}.${body}` so receivers can reject replays.
 */
export async function signWebhookBody(
  secret: string,
  timestamp: number,
  body: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${body}`),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${hex}`;
}

// ---------------------------------------------------------------------------
// Sample payloads for "send test event"
// ---------------------------------------------------------------------------

export function sampleEventPayload(
  trigger: AutomationTrigger,
  context: { tournamentId?: string; eventName?: string } = {},
): Record<string, unknown> {
  const tournament = {
    tournamentId: context.tournamentId ?? "sample-tournament",
    eventName: context.eventName ?? "Sample Event",
  };
  switch (trigger) {
    case "round.started":
      return {
        ...tournament,
        roundId: 0,
        roundNumber: 1,
        roundDisplayName: "Round 1",
        previousRoundNumber: undefined,
      };
    case "timer.started":
    case "timer.paused":
      return {
        ...tournament,
        countDirection: "down",
        expiresAt: Date.now() + 50 * 60 * 1000,
        secondsRemaining: 50 * 60,
      };
    case "tournament.polling.started":
      return { ...tournament, status: "active" };
    case "tournament.polling.stopped":
      return { ...tournament, status: "inactive" };
    case "tournament.polling.error":
      return {
        ...tournament,
        status: "error",
        errorMessage: "Sample polling error",
      };
    case "obs.streaming.started":
      return { controllerId: "sample-controller", controllerName: "OBS", streaming: true };
    case "obs.streaming.stopped":
      return { controllerId: "sample-controller", controllerName: "OBS", streaming: false };
    case "obs.scene.changed":
      return {
        controllerId: "sample-controller",
        controllerName: "OBS",
        sceneName: "Match Cam",
        previousSceneName: "Starting Soon",
      };
  }
}
