/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.{js,ts}");
// See featurematch-removal.test.ts for why schema validation is disabled.
const testSchema = defineSchema(schema.tables, { schemaValidation: false });

async function setup() {
  const t = convexTest(testSchema, modules);
  await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", {});
    const tournament = await ctx.db.insert("tournaments", {
      userId: owner,
      mode: "manual" as const,
      manualTimerRunning: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("overlays", {
      name: "Card",
      overlayType: "card",
      tournamentId: tournament,
      publicUuid: "card-public",
      braunDarkPalette: "Dark",
      cardUrl: "https://example.test/card.png",
      createdAt: 1,
    });
  });
  return t;
}

it("the internal UUID query returns the same overlay as the public one", async () => {
  const t = await setup();
  const [viaInternal, viaPublic] = await Promise.all([
    t.query(internal.overlays.queries.getOverlayByUuidInternal, {
      publicUuid: "card-public",
    }),
    t.query(api.overlays.queries.getOverlayByUuid, {
      publicUuid: "card-public",
    }),
  ]);
  expect(viaInternal).toMatchObject({
    overlayType: "card",
    publicUuid: "card-public",
  });
  expect(viaInternal).toEqual(viaPublic);
  expect(
    await t.query(internal.overlays.queries.getOverlayByUuidInternal, {
      publicUuid: "missing",
    }),
  ).toBeNull();
});

it("GET /api/overlay/:uuid serves the overlay through the internal query", async () => {
  const t = await setup();
  const response = await t.fetch("/api/overlay/card-public", {
    method: "GET",
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(await response.json()).toMatchObject({
    overlayType: "card",
    publicUuid: "card-public",
    cardUrl: "https://example.test/card.png",
  });
});

it("GET /api/overlay/:uuid returns 404 for an unknown uuid", async () => {
  const t = await setup();
  const response = await t.fetch("/api/overlay/missing", { method: "GET" });
  expect(response.status).toBe(404);
  // The route matched and the handler answered, rather than the router
  // reporting that no route exists.
  expect(await response.text()).toBe("Overlay not found");
});
