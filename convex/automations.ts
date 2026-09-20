import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";
import { generatePublicUuid } from "./lib/utils";
import {
  automationActionValidator,
  automationConditionValidator,
  automationDeliveryValidator,
  automationTriggerValidator,
  obsCommandRowValidator,
  obsStateValidator,
  AUTOMATION_TRIGGERS,
} from "./validators";
import {
  buildEventEnvelope,
  dispatchAutomation,
  emitAutomationEvent,
  isBridgeOnline,
  recordDeliveryOutcome,
  renderTemplate,
  sampleEventPayload,
  signWebhookBody,
  validateWebhookUrl,
  WEBHOOK_RETRY_DELAYS_MS,
} from "./lib/automations";

const WEBHOOK_TIMEOUT_MS = 10 * 1000;
const AUTOMATION_HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// Client-facing shapes (secrets stripped)
// ---------------------------------------------------------------------------

const automationClientValidator = v.object({
  _id: v.id("automations"),
  _creationTime: v.number(),
  name: v.string(),
  enabled: v.boolean(),
  trigger: automationTriggerValidator,
  conditions: v.array(automationConditionValidator),
  action: automationActionValidator,
  hasWebhookSecret: v.boolean(),
  consecutiveFailures: v.number(),
  lastTriggeredAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const obsControllerClientValidator = v.object({
  _id: v.id("obsControllers"),
  _creationTime: v.number(),
  name: v.string(),
  token: v.string(),
  online: v.boolean(),
  lastSeenAt: v.optional(v.number()),
  bridgeVersion: v.optional(v.string()),
  obsState: v.optional(obsStateValidator),
  createdAt: v.number(),
});

function toClientAutomation(automation: Doc<"automations">) {
  return {
    _id: automation._id,
    _creationTime: automation._creationTime,
    name: automation.name,
    enabled: automation.enabled,
    trigger: automation.trigger,
    conditions: automation.conditions,
    action: automation.action,
    hasWebhookSecret: (automation.webhookSecret ?? "").length > 0,
    consecutiveFailures: automation.consecutiveFailures,
    lastTriggeredAt: automation.lastTriggeredAt,
    createdAt: automation.createdAt,
    updatedAt: automation.updatedAt,
  };
}

function toClientController(controller: Doc<"obsControllers">) {
  return {
    _id: controller._id,
    _creationTime: controller._creationTime,
    name: controller.name,
    token: controller.token,
    online: isBridgeOnline(controller),
    lastSeenAt: controller.lastSeenAt,
    bridgeVersion: controller.bridgeVersion,
    obsState: controller.obsState,
    createdAt: controller.createdAt,
  };
}

async function requireAutomationAccess(
  ctx: QueryCtx | MutationCtx,
  automationId: Id<"automations">,
): Promise<{ userId: Id<"users">; automation: Doc<"automations"> }> {
  const userId = await requireAuth(ctx);
  const automation = await ctx.db.get(automationId);
  if (!automation || automation.userId !== userId) {
    throw new Error("Automation not found or access denied");
  }
  return { userId, automation };
}

async function requireControllerAccess(
  ctx: QueryCtx | MutationCtx,
  controllerId: Id<"obsControllers">,
): Promise<{ userId: Id<"users">; controller: Doc<"obsControllers"> }> {
  const userId = await requireAuth(ctx);
  const controller = await ctx.db.get(controllerId);
  if (!controller || controller.userId !== userId) {
    throw new Error("OBS controller not found or access denied");
  }
  return { userId, controller };
}

async function validateAction(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  action: Doc<"automations">["action"],
): Promise<void> {
  if (action.type === "webhook") {
    const problem = validateWebhookUrl(action.url);
    if (problem) throw new Error(problem);
    return;
  }
  const controller = await ctx.db.get(action.controllerId);
  if (!controller || controller.userId !== userId) {
    throw new Error("OBS controller not found or access denied");
  }
}

function generateControllerToken(): string {
  return `${generatePublicUuid()}${generatePublicUuid()}`;
}

// ---------------------------------------------------------------------------
// Dashboard: automations
// ---------------------------------------------------------------------------

export const listTriggers = query({
  args: {},
  returns: v.array(automationTriggerValidator),
  handler: async () => [...AUTOMATION_TRIGGERS],
});

export const listAutomations = query({
  args: {},
  returns: v.array(automationClientValidator),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const automations = await ctx.db
      .query("automations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return automations.map(toClientAutomation);
  },
});

export const createAutomation = mutation({
  args: {
    name: v.string(),
    trigger: automationTriggerValidator,
    conditions: v.optional(v.array(automationConditionValidator)),
    action: automationActionValidator,
    webhookSecret: v.optional(v.string()),
  },
  returns: v.id("automations"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const name = args.name.trim();
    if (name === "") throw new Error("Automation name is required");
    await validateAction(ctx, userId, args.action);

    const now = Date.now();
    return await ctx.db.insert("automations", {
      userId,
      name,
      enabled: true,
      trigger: args.trigger,
      conditions: args.conditions ?? [],
      action: args.action,
      webhookSecret:
        args.action.type === "webhook" && args.webhookSecret
          ? args.webhookSecret
          : undefined,
      consecutiveFailures: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateAutomation = mutation({
  args: {
    automationId: v.id("automations"),
    name: v.optional(v.string()),
    trigger: v.optional(automationTriggerValidator),
    conditions: v.optional(v.array(automationConditionValidator)),
    action: v.optional(automationActionValidator),
    // Omitted keeps the stored secret; empty string clears it.
    webhookSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, automation } = await requireAutomationAccess(
      ctx,
      args.automationId,
    );
    const action = args.action ?? automation.action;
    await validateAction(ctx, userId, action);

    const name = args.name?.trim();
    if (name !== undefined && name === "") {
      throw new Error("Automation name is required");
    }

    await ctx.db.patch(automation._id, {
      ...(name !== undefined ? { name } : {}),
      ...(args.trigger !== undefined ? { trigger: args.trigger } : {}),
      ...(args.conditions !== undefined
        ? { conditions: args.conditions }
        : {}),
      ...(args.action !== undefined ? { action: args.action } : {}),
      ...(args.webhookSecret !== undefined
        ? { webhookSecret: args.webhookSecret || undefined }
        : {}),
      updatedAt: Date.now(),
    });
  },
});

export const setAutomationEnabled = mutation({
  args: { automationId: v.id("automations"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const { automation } = await requireAutomationAccess(
      ctx,
      args.automationId,
    );
    await ctx.db.patch(automation._id, {
      enabled: args.enabled,
      // Re-enabling resets the failure streak so it gets a fresh run.
      ...(args.enabled ? { consecutiveFailures: 0 } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const deleteAutomation = mutation({
  args: { automationId: v.id("automations") },
  handler: async (ctx, args) => {
    const { automation } = await requireAutomationAccess(
      ctx,
      args.automationId,
    );
    await ctx.db.delete(automation._id);
  },
});

/**
 * Runs one automation against a synthetic event of its trigger type. Bypasses
 * the enabled flag and conditions so a rule can be checked end to end.
 */
export const sendTestEvent = mutation({
  args: { automationId: v.id("automations") },
  returns: v.id("automationDeliveries"),
  handler: async (ctx, args) => {
    const { userId, automation } = await requireAutomationAccess(
      ctx,
      args.automationId,
    );
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const now = Date.now();
    const eventId = await ctx.db.insert("automationEvents", {
      userId,
      tournamentId: tournament?._id,
      type: automation.trigger,
      payload: sampleEventPayload(automation.trigger, {
        tournamentId: tournament?._id,
        eventName: tournament?.eventName,
      }),
      isTest: true,
      createdAt: now,
    });
    const event = (await ctx.db.get(eventId))!;
    return await dispatchAutomation(ctx, automation, event);
  },
});

export const listDeliveries = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      ...automationDeliveryValidator.fields,
      automationName: v.string(),
      eventType: automationTriggerValidator,
      isTest: v.boolean(),
      obsCommandStatus: v.optional(obsCommandRowValidator.fields.status),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const deliveries = await ctx.db
      .query("automationDeliveries")
      .withIndex("by_user_and_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(Math.min(args.limit ?? 50, 200));

    const automationNames = new Map<string, string>();
    const results = [];
    for (const delivery of deliveries) {
      let automationName = automationNames.get(delivery.automationId);
      if (automationName === undefined) {
        const automation = await ctx.db.get(delivery.automationId);
        automationName = automation?.name ?? "(deleted automation)";
        automationNames.set(delivery.automationId, automationName);
      }
      const event = await ctx.db.get(delivery.eventId);
      const obsCommand = delivery.obsCommandId
        ? await ctx.db.get(delivery.obsCommandId)
        : null;
      results.push({
        ...delivery,
        automationName,
        eventType: event?.type ?? "round.started",
        isTest: event?.isTest ?? false,
        obsCommandStatus: obsCommand?.status,
      });
    }
    return results;
  },
});

// ---------------------------------------------------------------------------
// Dashboard: OBS controllers
// ---------------------------------------------------------------------------

export const listControllers = query({
  args: {},
  returns: v.array(obsControllerClientValidator),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const controllers = await ctx.db
      .query("obsControllers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return controllers.map(toClientController);
  },
});

export const createController = mutation({
  args: { name: v.string() },
  returns: v.id("obsControllers"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const name = args.name.trim();
    if (name === "") throw new Error("Controller name is required");
    return await ctx.db.insert("obsControllers", {
      userId,
      name,
      token: generateControllerToken(),
      createdAt: Date.now(),
    });
  },
});

export const regenerateControllerToken = mutation({
  args: { controllerId: v.id("obsControllers") },
  handler: async (ctx, args) => {
    const { controller } = await requireControllerAccess(
      ctx,
      args.controllerId,
    );
    await ctx.db.patch(controller._id, {
      token: generateControllerToken(),
      lastSeenAt: undefined,
      obsState: undefined,
    });
  },
});

export const deleteController = mutation({
  args: { controllerId: v.id("obsControllers") },
  handler: async (ctx, args) => {
    const { userId, controller } = await requireControllerAccess(
      ctx,
      args.controllerId,
    );
    const dependents = await ctx.db
      .query("automations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const inUse = dependents.some(
      (automation) =>
        automation.action.type === "obs" &&
        automation.action.controllerId === controller._id,
    );
    if (inUse) {
      throw new Error(
        "This controller is used by an automation. Delete or edit that automation first.",
      );
    }
    await ctx.db.delete(controller._id);
  },
});

// ---------------------------------------------------------------------------
// Bridge-facing API (authenticated by controller token)
// ---------------------------------------------------------------------------

async function requireController(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<Doc<"obsControllers">> {
  const controller = await ctx.db
    .query("obsControllers")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!controller) {
    throw new Error("Invalid controller token");
  }
  return controller;
}

export const pendingCommands = query({
  args: { token: v.string() },
  returns: v.array(obsCommandRowValidator),
  handler: async (ctx, args) => {
    const controller = await requireController(ctx, args.token);
    const commands = await ctx.db
      .query("obsCommands")
      .withIndex("by_controller_and_status", (q) =>
        q.eq("controllerId", controller._id).eq("status", "pending"),
      )
      .collect();
    const now = Date.now();
    return commands.filter((command) => command.expiresAt > now);
  },
});

export const claimCommand = mutation({
  args: { token: v.string(), commandId: v.id("obsCommands") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const controller = await requireController(ctx, args.token);
    const command = await ctx.db.get(args.commandId);
    if (!command || command.controllerId !== controller._id) return false;
    if (command.status !== "pending") return false;
    const now = Date.now();
    if (command.expiresAt <= now) {
      await markCommandExpired(ctx, command, now);
      return false;
    }
    await ctx.db.patch(command._id, { status: "running", claimedAt: now });
    return true;
  },
});

export const completeCommand = mutation({
  args: {
    token: v.string(),
    commandId: v.id("obsCommands"),
    result: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const controller = await requireController(ctx, args.token);
    const command = await ctx.db.get(args.commandId);
    if (!command || command.controllerId !== controller._id) return;
    if (command.status !== "running") return;
    const now = Date.now();
    await ctx.db.patch(command._id, {
      status: "succeeded",
      result: args.result,
      completedAt: now,
    });
    if (command.deliveryId) {
      await recordDeliveryOutcome(ctx, {
        deliveryId: command.deliveryId,
        status: "success",
        attempts: 1,
      });
    }
  },
});

export const failCommand = mutation({
  args: {
    token: v.string(),
    commandId: v.id("obsCommands"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const controller = await requireController(ctx, args.token);
    const command = await ctx.db.get(args.commandId);
    if (!command || command.controllerId !== controller._id) return;
    if (command.status !== "running") return;
    const now = Date.now();
    await ctx.db.patch(command._id, {
      status: "failed",
      error: args.error,
      completedAt: now,
    });
    if (command.deliveryId) {
      await recordDeliveryOutcome(ctx, {
        deliveryId: command.deliveryId,
        status: "failed",
        attempts: 1,
        error: args.error,
      });
    }
  },
});

export const bridgeHeartbeat = mutation({
  args: {
    token: v.string(),
    bridgeVersion: v.optional(v.string()),
    obsState: obsStateValidator,
  },
  handler: async (ctx, args) => {
    const controller = await requireController(ctx, args.token);
    await ctx.db.patch(controller._id, {
      lastSeenAt: Date.now(),
      bridgeVersion: args.bridgeVersion,
      obsState: args.obsState,
    });
  },
});

/**
 * Lets a bridge turn OBS events into ManaStream triggers.
 */
export const reportObsEvent = mutation({
  args: {
    token: v.string(),
    type: v.union(
      v.literal("obs.streaming.started"),
      v.literal("obs.streaming.stopped"),
      v.literal("obs.scene.changed"),
    ),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const controller = await requireController(ctx, args.token);
    const extra =
      args.payload && typeof args.payload === "object"
        ? (args.payload as Record<string, unknown>)
        : {};
    await emitAutomationEvent(ctx, {
      userId: controller.userId,
      type: args.type,
      payload: {
        controllerId: controller._id,
        controllerName: controller.name,
        ...extra,
      },
    });
  },
});

// ---------------------------------------------------------------------------
// Internal: OBS command expiry
// ---------------------------------------------------------------------------

async function markCommandExpired(
  ctx: MutationCtx,
  command: Doc<"obsCommands">,
  now: number,
): Promise<void> {
  await ctx.db.patch(command._id, {
    status: "expired",
    error: "No OBS bridge claimed the command before it expired",
    completedAt: now,
  });
  if (command.deliveryId) {
    await recordDeliveryOutcome(ctx, {
      deliveryId: command.deliveryId,
      status: "failed",
      attempts: 1,
      error: "No OBS bridge was connected to run this command",
    });
  }
}

export const expireObsCommand = internalMutation({
  args: { obsCommandId: v.id("obsCommands") },
  handler: async (ctx, args) => {
    const command = await ctx.db.get(args.obsCommandId);
    if (!command || command.status !== "pending") return;
    await markCommandExpired(ctx, command, Date.now());
  },
});

// ---------------------------------------------------------------------------
// Internal: webhook delivery
// ---------------------------------------------------------------------------

export const getWebhookDeliveryContext = internalQuery({
  args: { deliveryId: v.id("automationDeliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) return null;
    const automation = await ctx.db.get(delivery.automationId);
    const event = await ctx.db.get(delivery.eventId);
    if (!automation || !event || automation.action.type !== "webhook") {
      return null;
    }
    return {
      delivery,
      action: automation.action,
      webhookSecret: automation.webhookSecret,
      event,
    };
  },
});

export const recordWebhookAttempt = internalMutation({
  args: {
    deliveryId: v.id("automationDeliveries"),
    attempts: v.number(),
    ok: v.boolean(),
    error: v.optional(v.string()),
    responseStatus: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const final = args.ok || args.attempts >= WEBHOOK_RETRY_DELAYS_MS.length;
    if (final) {
      await recordDeliveryOutcome(ctx, {
        deliveryId: args.deliveryId,
        status: args.ok ? "success" : "failed",
        attempts: args.attempts,
        error: args.error,
        responseStatus: args.responseStatus,
      });
      return;
    }
    await ctx.db.patch(args.deliveryId, {
      attempts: args.attempts,
      lastError: args.error,
      responseStatus: args.responseStatus,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      WEBHOOK_RETRY_DELAYS_MS[args.attempts],
      internal.automations.deliverWebhook,
      { deliveryId: args.deliveryId },
    );
  },
});

export const deliverWebhook = internalAction({
  args: { deliveryId: v.id("automationDeliveries") },
  handler: async (ctx, args): Promise<void> => {
    const context = await ctx.runQuery(
      internal.automations.getWebhookDeliveryContext,
      { deliveryId: args.deliveryId },
    );
    if (!context) return;
    const { delivery, action, webhookSecret, event } = context;
    const attempts = delivery.attempts + 1;

    const envelope = buildEventEnvelope(event);
    const body =
      action.method === "GET"
        ? undefined
        : action.bodyTemplate !== undefined && action.bodyTemplate !== ""
          ? renderTemplate(action.bodyTemplate, envelope)
          : JSON.stringify(envelope);

    const timestamp = Date.now();
    const headers: Record<string, string> = {
      "User-Agent": "ManaStream-Automations/1",
      "X-ManaStream-Event": envelope.type,
      "X-ManaStream-Delivery": delivery._id,
      "X-ManaStream-Timestamp": String(timestamp),
      ...(action.headers ?? {}),
    };
    if (body !== undefined && !("Content-Type" in headers)) {
      headers["Content-Type"] = "application/json";
    }
    if (webhookSecret) {
      headers["X-ManaStream-Signature"] = await signWebhookBody(
        webhookSecret,
        timestamp,
        body ?? "",
      );
    }

    let ok = false;
    let responseStatus: number | undefined;
    let error: string | undefined;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers,
        body,
        signal: abort.signal,
      });
      responseStatus = response.status;
      ok = response.ok;
      if (!ok) {
        const text = await response.text().catch(() => "");
        error = `HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`;
      }
    } catch (caught) {
      error =
        caught instanceof Error && caught.name === "AbortError"
          ? `Timed out after ${WEBHOOK_TIMEOUT_MS / 1000}s`
          : caught instanceof Error
            ? caught.message
            : String(caught);
    } finally {
      clearTimeout(timeout);
    }

    await ctx.runMutation(internal.automations.recordWebhookAttempt, {
      deliveryId: delivery._id,
      attempts,
      ok,
      error,
      responseStatus,
    });
  },
});

// ---------------------------------------------------------------------------
// Internal: retention
// ---------------------------------------------------------------------------

export const cleanupOldAutomationHistory = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - AUTOMATION_HISTORY_RETENTION_MS;
    let hasMore = false;
    for (const table of [
      "automationDeliveries",
      "automationEvents",
      "obsCommands",
    ] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_created", (q) => q.lt("createdAt", cutoff))
        .take(CLEANUP_BATCH_SIZE);
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
      if (rows.length === CLEANUP_BATCH_SIZE) hasMore = true;
    }
    if (hasMore) {
      await ctx.scheduler.runAfter(
        0,
        internal.automations.cleanupOldAutomationHistory,
        {},
      );
    }
  },
});
