/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.{js,ts}");
const testSchema = defineSchema(schema.tables, { schemaValidation: false });

/**
 * One user with a match, commentary, card and deck overlay. `setOverlayTemplate`
 * derives its per-type allowlists from the template validators, so it must
 * accept exactly what the per-type settings mutations accept.
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
      player1Life: 20,
      player2Life: 20,
      player1GamesWon: 0,
      player2GamesWon: 0,
      createdAt: 1,
    });
    const commentary = await ctx.db.insert("overlays", {
      name: "commentary",
      overlayType: "commentary",
      template: "Default",
      tournamentId,
      publicUuid: "commentary",
      commentatorLeft: "",
      commentatorRight: "",
      createdAt: 1,
    });
    const card = await ctx.db.insert("overlays", {
      name: "card",
      overlayType: "card",
      tournamentId,
      publicUuid: "card",
      cardUrl: "",
      createdAt: 1,
    });
    const deck = await ctx.db.insert("overlays", {
      name: "deck",
      overlayType: "deck",
      tournamentId,
      publicUuid: "deck",
      createdAt: 1,
    });
    return { user, match, commentary, card, deck };
  });
  return { t, ...ids, as: t.withIdentity({ subject: ids.user }) };
}

it("accepts every template the match settings mutation accepts, including LC26", async () => {
  const { t, as, match } = await setup();

  await as.mutation(api.overlays.match.setMatchOverlaySettings, {
    overlayId: match,
    template: "LC26",
  });
  await as.mutation(api.overlays.shared.setOverlayTemplate, {
    overlayId: match,
    template: "Braun Dark",
  });
  await as.mutation(api.overlays.shared.setOverlayTemplate, {
    overlayId: match,
    template: "LC26",
  });

  await t.run(async (ctx) => {
    const overlay = await ctx.db.get(match);
    expect(overlay?.overlayType === "match" && overlay.template).toBe("LC26");
  });
});

it("still rejects templates that belong to a different overlay type", async () => {
  const { as, match, commentary, card, deck } = await setup();

  await expect(
    as.mutation(api.overlays.shared.setOverlayTemplate, {
      overlayId: match,
      template: "Braun Dark Duo",
    }),
  ).rejects.toThrow("Template is not available for match overlays");
  await expect(
    as.mutation(api.overlays.shared.setOverlayTemplate, {
      overlayId: commentary,
      template: "LC26",
    }),
  ).rejects.toThrow("Template is not available for commentary overlays");
  await expect(
    as.mutation(api.overlays.shared.setOverlayTemplate, {
      overlayId: card,
      template: "Duress Crew",
    }),
  ).rejects.toThrow("Template is not available for card overlays");
  await expect(
    as.mutation(api.overlays.shared.setOverlayTemplate, {
      overlayId: deck,
      template: "Default",
    }),
  ).rejects.toThrow("Template is not available for deck overlays");
});

it("accepts the templates each per-type settings mutation accepts", async () => {
  const { t, as, commentary, card, deck } = await setup();

  await as.mutation(api.overlays.shared.setOverlayTemplate, {
    overlayId: commentary,
    template: "Braun Dark Duo",
  });
  await as.mutation(api.overlays.shared.setOverlayTemplate, {
    overlayId: card,
    template: "Braun Dark",
  });
  await as.mutation(api.overlays.shared.setOverlayTemplate, {
    overlayId: deck,
    template: "Duress Crew",
  });

  await t.run(async (ctx) => {
    const [c, k, d] = await Promise.all([
      ctx.db.get(commentary),
      ctx.db.get(card),
      ctx.db.get(deck),
    ]);
    expect(c?.overlayType === "commentary" && c.template).toBe(
      "Braun Dark Duo",
    );
    expect(k?.overlayType === "card" && k.template).toBe("Braun Dark");
    expect(d?.overlayType === "deck" && d.template).toBe("Duress Crew");
  });
});
