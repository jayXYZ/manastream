/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.{js,ts}");
const testSchema = defineSchema(schema.tables, { schemaValidation: false });

/**
 * One user with a match overlay that already has every manual display
 * override set. `updateMatchOverlay` is the single mutation for match state
 * and display overrides: omitted fields are untouched, `null` clears.
 */
async function setup() {
  const t = convexTest(testSchema, modules);
  const ids = await t.run(async (ctx) => {
    const user = await ctx.db.insert("users", {});
    const tournamentId = await ctx.db.insert("tournaments", {
      mode: "manual",
      manualTimerRunning: false,
      userId: user,
      createdAt: 1,
      updatedAt: 1,
    });
    const match = await ctx.db.insert("overlays", {
      name: "match",
      overlayType: "match",
      template: "Default",
      tournamentId,
      publicUuid: "match",
      player1Life: 17,
      player2Life: 20,
      player1GamesWon: 1,
      player2GamesWon: 0,
      player1DisplayName: "Ada",
      player2DisplayName: "Ben",
      player1DisplayDeck: "Mono Red",
      player2DisplayDeck: "Esper",
      player1TournamentRecord: "3-0",
      player2TournamentRecord: "2-1",
      player1Lc26BackgroundColor: "Red",
      player2Lc26BackgroundColor: "Blue",
      createdAt: 1,
    });
    return { user, match };
  });
  return { t, ...ids, as: t.withIdentity({ subject: ids.user }) };
}

it("leaves omitted fields untouched and clears fields passed as null", async () => {
  const { t, as, match } = await setup();

  await as.mutation(api.overlays.match.updateMatchOverlay, {
    overlayId: match,
    player1DisplayName: "Grace",
    player2DisplayName: null,
    player1Lc26BackgroundColor: null,
    player1Life: 12,
  });

  const overlay = await t.run(async (ctx) => await ctx.db.get(match));
  expect(overlay).toMatchObject({
    player1DisplayName: "Grace",
    player1DisplayDeck: "Mono Red",
    player2DisplayDeck: "Esper",
    player1TournamentRecord: "3-0",
    player2TournamentRecord: "2-1",
    player2Lc26BackgroundColor: "Blue",
    player1Life: 12,
    player2Life: 20,
    player1GamesWon: 1,
    player2GamesWon: 0,
  });
  // Cleared overrides are removed rather than stored as null, so the overlay
  // falls back to the linked player's data.
  expect(overlay).not.toHaveProperty("player2DisplayName");
  expect(overlay).not.toHaveProperty("player1Lc26BackgroundColor");
});

it("rejects updates from a user who does not own the overlay", async () => {
  const { t, match } = await setup();
  const other = await t.run(async (ctx) => await ctx.db.insert("users", {}));

  await expect(
    t
      .withIdentity({ subject: other })
      .mutation(api.overlays.match.updateMatchOverlay, {
        overlayId: match,
        player1DisplayName: null,
      }),
  ).rejects.toThrow();
});
