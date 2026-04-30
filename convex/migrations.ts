import { Migrations } from "@convex-dev/migrations";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";

export const migrations = new Migrations<DataModel>(components.migrations, {
  internalMutation,
});
export const run = migrations.runner();

export const backfillPlayerStatuses = migrations.define({
  table: "players",
  batchSize: 25,
  migrateOne: async (ctx, player) => {
    if (player.spicerackTournamentId === undefined) {
      return;
    }
    const existing = await ctx.db
      .query("playerStatuses")
      .withIndex("by_player_id", (q) => q.eq("playerId", player._id))
      .unique();
    const row = {
      playerId: player._id,
      spicerackTournamentId: player.spicerackTournamentId,
      spicerackPlayerId: player.spicerackPlayerId,
      registrationStatus: player.registrationStatus,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, row);
      return;
    }
    await ctx.db.insert("playerStatuses", row);
  },
});

export const backfillPlayerDecklists = migrations.define({
  table: "players",
  batchSize: 10,
  migrateOne: async (ctx, player) => {
    if (player.spicerackTournamentId === undefined) {
      return;
    }
    const existing = await ctx.db
      .query("playerDecklists")
      .withIndex("by_player_id", (q) => q.eq("playerId", player._id))
      .unique();
    const row = {
      playerId: player._id,
      spicerackTournamentId: player.spicerackTournamentId,
      spicerackPlayerId: player.spicerackPlayerId,
      deckId: player.deckId ?? -1,
      decklistStatus: player.decklistStatus,
      deckName: player.deckName ?? "MISSING_DECKLIST",
      deckList: player.deckList ?? "MISSING_DECKLIST",
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, row);
      return;
    }
    await ctx.db.insert("playerDecklists", row);
  },
});

export const verifyPlayerDataSplit = query({
  args: {
    spicerackTournamentId: v.optional(v.number()),
  },
  returns: v.object({
    sampleMissingStatusRows: v.array(v.id("players")),
    sampleMissingDecklistRows: v.array(v.id("players")),
  }),
  handler: async (ctx, args) => {
    const playersQuery =
      args.spicerackTournamentId === undefined
        ? ctx.db.query("players")
        : ctx.db
            .query("players")
            .withIndex("by_spicerack_tournament_id", (q) =>
              q.eq("spicerackTournamentId", args.spicerackTournamentId),
            );
    const sampleMissingStatusRows = [];
    const sampleMissingDecklistRows = [];

    for await (const player of playersQuery) {
      const [status, decklist] = await Promise.all([
        ctx.db
          .query("playerStatuses")
          .withIndex("by_player_id", (q) => q.eq("playerId", player._id))
          .unique(),
        ctx.db
          .query("playerDecklists")
          .withIndex("by_player_id", (q) => q.eq("playerId", player._id))
          .unique(),
      ]);
      if (!status) {
        sampleMissingStatusRows.push(player._id);
      }
      if (!decklist) {
        sampleMissingDecklistRows.push(player._id);
      }
      if (
        sampleMissingStatusRows.length >= 10 &&
        sampleMissingDecklistRows.length >= 10
      ) {
        break;
      }
    }

    return {
      sampleMissingStatusRows,
      sampleMissingDecklistRows,
    };
  },
});
