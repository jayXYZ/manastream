import { describe, expect, it } from "vitest";

import {
  automationMatchesEvent,
  buildEventEnvelope,
  conditionsPass,
  emitAutomationEvent,
  evaluateCondition,
  getPath,
  isBridgeOnline,
  renderTemplate,
  sampleEventPayload,
  validateWebhookUrl,
  OBS_COMMAND_TTL_MS,
} from "../automations";
import { AUTOMATION_TRIGGERS } from "../../validators";

describe("getPath", () => {
  it("walks nested objects and tolerates missing segments", () => {
    const value = { a: { b: { c: 3 } }, list: [1, 2] };
    expect(getPath(value, "a.b.c")).toBe(3);
    expect(getPath(value, "a.x.c")).toBeUndefined();
    expect(getPath(value, "list.1")).toBe(2);
    expect(getPath(null, "a")).toBeUndefined();
    expect(getPath(value, "")).toBe(value);
  });
});

describe("evaluateCondition", () => {
  const payload = { roundNumber: 3, roundDisplayName: "Round 3", live: true };

  it("compares numbers loosely and supports ordering ops", () => {
    expect(
      evaluateCondition({ path: "roundNumber", op: "equals", value: "3" }, payload),
    ).toBe(true);
    expect(
      evaluateCondition({ path: "roundNumber", op: "gte", value: 3 }, payload),
    ).toBe(true);
    expect(
      evaluateCondition({ path: "roundNumber", op: "gt", value: 3 }, payload),
    ).toBe(false);
    expect(
      evaluateCondition({ path: "roundNumber", op: "lt", value: "10" }, payload),
    ).toBe(true);
  });

  it("handles strings, booleans, and missing paths", () => {
    expect(
      evaluateCondition(
        { path: "roundDisplayName", op: "contains", value: "round" },
        payload,
      ),
    ).toBe(true);
    expect(
      evaluateCondition({ path: "live", op: "equals", value: true }, payload),
    ).toBe(true);
    expect(
      evaluateCondition({ path: "missing", op: "equals", value: "x" }, payload),
    ).toBe(false);
    expect(
      evaluateCondition({ path: "missing", op: "notEquals", value: "x" }, payload),
    ).toBe(true);
    expect(
      evaluateCondition({ path: "missing", op: "gte", value: 1 }, payload),
    ).toBe(false);
  });

  it("requires every condition to pass", () => {
    expect(
      conditionsPass(
        [
          { path: "roundNumber", op: "gte", value: 2 },
          { path: "live", op: "equals", value: true },
        ],
        payload,
      ),
    ).toBe(true);
    expect(
      conditionsPass(
        [
          { path: "roundNumber", op: "gte", value: 2 },
          { path: "live", op: "equals", value: false },
        ],
        payload,
      ),
    ).toBe(false);
    expect(conditionsPass([], payload)).toBe(true);
  });
});

describe("renderTemplate", () => {
  it("fills placeholders from the envelope and blanks missing ones", () => {
    const envelope = buildEventEnvelope({
      _id: "evt1" as never,
      _creationTime: 0,
      userId: "user1" as never,
      tournamentId: "t1" as never,
      type: "round.started",
      payload: { roundNumber: 4, name: "Round 4", nested: { ok: true } },
      createdAt: 123,
    });
    expect(
      renderTemplate(
        '{"round": {{payload.roundNumber}}, "type": "{{ type }}", "x": "{{payload.nope}}", "n": {{payload.nested}}}',
        envelope,
      ),
    ).toBe('{"round": 4, "type": "round.started", "x": "", "n": {"ok":true}}');
    expect(envelope.isTest).toBe(false);
  });
});

describe("validateWebhookUrl", () => {
  it("accepts public http(s) URLs only", () => {
    expect(validateWebhookUrl("https://example.com/hook")).toBeUndefined();
    expect(validateWebhookUrl("http://hooks.example.org:8080/x")).toBeUndefined();
    expect(validateWebhookUrl("not a url")).toMatch(/valid URL/);
    expect(validateWebhookUrl("ftp://example.com")).toMatch(/http/);
    expect(validateWebhookUrl("http://localhost:4455")).toMatch(/publicly/);
    expect(validateWebhookUrl("http://192.168.1.10/x")).toMatch(/publicly/);
    expect(validateWebhookUrl("http://172.20.0.1/x")).toMatch(/publicly/);
    expect(validateWebhookUrl("http://172.40.0.1/x")).toBeUndefined();
  });
});

describe("automationMatchesEvent", () => {
  it("requires enabled, matching trigger, and passing conditions", () => {
    const event = { type: "round.started" as const, payload: { roundNumber: 2 } };
    const base = {
      enabled: true,
      trigger: "round.started" as const,
      conditions: [],
    };
    expect(automationMatchesEvent(base, event)).toBe(true);
    expect(automationMatchesEvent({ ...base, enabled: false }, event)).toBe(false);
    expect(
      automationMatchesEvent({ ...base, trigger: "timer.started" }, event),
    ).toBe(false);
    expect(
      automationMatchesEvent(
        { ...base, conditions: [{ path: "roundNumber", op: "gte", value: 3 }] },
        event,
      ),
    ).toBe(false);
  });
});

describe("isBridgeOnline", () => {
  it("uses the heartbeat window", () => {
    const now = 1_000_000;
    expect(isBridgeOnline({ lastSeenAt: undefined }, now)).toBe(false);
    expect(isBridgeOnline({ lastSeenAt: now - 10_000 }, now)).toBe(true);
    expect(isBridgeOnline({ lastSeenAt: now - 120_000 }, now)).toBe(false);
  });
});

describe("sampleEventPayload", () => {
  it("returns an object for every trigger in the catalog", () => {
    for (const trigger of AUTOMATION_TRIGGERS) {
      const payload = sampleEventPayload(trigger, { eventName: "Test Open" });
      expect(typeof payload).toBe("object");
    }
    expect(sampleEventPayload("round.started").roundNumber).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Engine test with an in-memory fake of the Convex mutation context
// ---------------------------------------------------------------------------

type Row = Record<string, unknown> & { _id: string };

function createFakeCtx(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(seed)) {
    tables[name] = rows.map((row) => ({ ...row }));
  }
  let nextId = 1;
  const scheduled: { delay: number; fn: unknown; args: unknown }[] = [];

  const findRow = (id: string) => {
    for (const rows of Object.values(tables)) {
      const row = rows.find((candidate) => candidate._id === id);
      if (row) return row;
    }
    return null;
  };

  const ctx = {
    db: {
      get: async (id: string) => findRow(id),
      insert: async (table: string, doc: Record<string, unknown>) => {
        const _id = `${table}:${nextId++}`;
        tables[table] = tables[table] ?? [];
        tables[table].push({ ...doc, _id, _creationTime: Date.now() });
        return _id;
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        const row = findRow(id);
        if (!row) throw new Error(`missing row ${id}`);
        Object.assign(row, patch);
      },
      delete: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) rows.splice(index, 1);
        }
      },
      query: (table: string) => {
        // Index filters are applied by reading the eq() chain into a predicate.
        const filters: [string, unknown][] = [];
        const builder = {
          eq(field: string, value: unknown) {
            filters.push([field, value]);
            return builder;
          },
        };
        const matching = () =>
          (tables[table] ?? []).filter((row) =>
            filters.every(([field, value]) => row[field] === value),
          );
        const chain = {
          withIndex(_name: string, range?: (q: typeof builder) => unknown) {
            range?.(builder);
            return chain;
          },
          first: async () => matching()[0] ?? null,
          collect: async () => matching(),
        };
        return chain;
      },
    },
    scheduler: {
      runAfter: async (delay: number, fn: unknown, args: unknown) => {
        scheduled.push({ delay, fn, args });
      },
    },
  };

  return { ctx: ctx as never, tables, scheduled };
}

describe("emitAutomationEvent", () => {
  const userId = "users:1";
  const seed = () => ({
    obsControllers: [
      { _id: "obsControllers:1", userId, name: "Main PC", token: "tok" },
    ],
    automations: [
      {
        _id: "automations:1",
        userId,
        name: "Stop stream on round",
        enabled: true,
        trigger: "round.started",
        conditions: [],
        action: {
          type: "obs",
          controllerId: "obsControllers:1",
          command: { kind: "streaming.stop" },
        },
        consecutiveFailures: 0,
      },
      {
        _id: "automations:2",
        userId,
        name: "Discord ping",
        enabled: true,
        trigger: "round.started",
        conditions: [{ path: "roundNumber", op: "gte", value: 5 }],
        action: { type: "webhook", url: "https://example.com", method: "POST" },
        consecutiveFailures: 0,
      },
      {
        _id: "automations:3",
        userId,
        name: "Disabled",
        enabled: false,
        trigger: "round.started",
        conditions: [],
        action: { type: "webhook", url: "https://example.com", method: "POST" },
        consecutiveFailures: 0,
      },
    ],
  });

  it("creates deliveries only for matching automations and queues OBS commands", async () => {
    const { ctx, tables, scheduled } = createFakeCtx(seed());

    const eventId = await emitAutomationEvent(ctx, {
      userId: userId as never,
      type: "round.started",
      dedupeKey: "round.started:t1:10",
      payload: { roundNumber: 2 },
    });

    expect(eventId).toBeDefined();
    expect(tables.automationEvents).toHaveLength(1);
    expect(tables.automationDeliveries).toHaveLength(1);
    expect(tables.automationDeliveries[0].automationId).toBe("automations:1");
    expect(tables.automationDeliveries[0].actionType).toBe("obs");

    expect(tables.obsCommands).toHaveLength(1);
    const command = tables.obsCommands[0];
    expect(command.status).toBe("pending");
    expect(command.controllerId).toBe("obsControllers:1");
    expect(command.command).toEqual({ kind: "streaming.stop" });
    expect((command.expiresAt as number) - (command.createdAt as number)).toBe(
      OBS_COMMAND_TTL_MS,
    );
    expect(tables.automationDeliveries[0].obsCommandId).toBe(command._id);

    // The expiry sweep is scheduled just after the TTL.
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].delay).toBe(OBS_COMMAND_TTL_MS + 1000);
  });

  it("dispatches webhook deliveries through the scheduler when conditions pass", async () => {
    const { ctx, tables, scheduled } = createFakeCtx(seed());

    await emitAutomationEvent(ctx, {
      userId: userId as never,
      type: "round.started",
      payload: { roundNumber: 6 },
    });

    expect(tables.automationDeliveries).toHaveLength(2);
    const webhookDelivery = tables.automationDeliveries.find(
      (row) => row.actionType === "webhook",
    );
    expect(webhookDelivery?.automationId).toBe("automations:2");
    expect(scheduled.some((entry) => entry.delay === 0)).toBe(true);
  });

  it("is a no-op for a repeated dedupe key", async () => {
    const { ctx, tables } = createFakeCtx(seed());
    const args = {
      userId: userId as never,
      type: "round.started" as const,
      dedupeKey: "round.started:t1:10",
      payload: { roundNumber: 2 },
    };

    const first = await emitAutomationEvent(ctx, args);
    const second = await emitAutomationEvent(ctx, args);

    expect(first).toBeDefined();
    expect(second).toBeUndefined();
    expect(tables.automationEvents).toHaveLength(1);
    expect(tables.automationDeliveries).toHaveLength(1);
  });

  it("fails the delivery immediately when the OBS controller is gone", async () => {
    const data = seed();
    data.obsControllers = [];
    const { ctx, tables } = createFakeCtx(data);

    await emitAutomationEvent(ctx, {
      userId: userId as never,
      type: "round.started",
      payload: { roundNumber: 1 },
    });

    expect(tables.obsCommands ?? []).toHaveLength(0);
    expect(tables.automationDeliveries[0].status).toBe("failed");
    expect(tables.automationDeliveries[0].lastError).toMatch(/controller/i);
  });
});
