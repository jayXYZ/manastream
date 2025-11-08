import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { filterUndefined } from "../lib/utils";
import {
  availableTemplatesValidator,
  updateMatchOverlayArgsValidator,
} from "../validators";
import {
  requireTournamentAccess,
  requireMatchOverlayAccess,
} from "../lib/auth";
import { DEFAULT_MATCH } from "../lib/constants";
import { createMatchOverlayHelper } from "../lib/overlays";

/**
 * Internal mutation to create a match overlay.
 * Used by other mutations and initialization logic.
 */
export const internalCreateMatchOverlay = internalMutation({
  args: {
    tournamentId: v.id("tournaments"),
    name: v.string(),
  },
  returns: v.object({
    overlayId: v.id("overlays"),
    publicUuid: v.string(),
  }),
  handler: async (ctx, args) => {
    return await createMatchOverlayHelper(ctx, args.tournamentId, args.name);
  },
});

/**
 * Public mutation to create a match overlay.
 * Requires authentication and tournament access.
 */
export const createMatchOverlay = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    name: v.string(),
  },
  returns: v.object({
    overlayId: v.id("overlays"),
    publicUuid: v.string(),
  }),
  handler: async (ctx, args) => {
    const { tournament } = await requireTournamentAccess(
      ctx,
      args.tournamentId,
    );

    return await createMatchOverlayHelper(ctx, tournament._id, args.name);
  },
});

export const updateMatchOverlay = mutation({
  args: updateMatchOverlayArgsValidator,
  handler: async (ctx, args) => {
    await requireMatchOverlayAccess(ctx, args.overlayId);

    // Extract only the update fields (excluding overlayId) and filter out undefined values
    const { overlayId, ...updateFields } = args;
    const updates = filterUndefined(updateFields);

    await ctx.db.patch(args.overlayId, updates);
  },
});

export const updateMatchOverlayDisplayInfo = mutation({
  args: {
    overlayId: v.id("overlays"),
    player1DisplayName: v.optional(v.string()),
    player2DisplayName: v.optional(v.string()),
    player1DisplayDeck: v.optional(v.string()),
    player2DisplayDeck: v.optional(v.string()),
    player1TournamentRecord: v.optional(v.string()),
    player2TournamentRecord: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMatchOverlayAccess(ctx, args.overlayId);

    // don't filter undefined values here, just update all fields
    await ctx.db.patch(args.overlayId, {
      player1DisplayName: args.player1DisplayName,
      player2DisplayName: args.player2DisplayName,
      player1DisplayDeck: args.player1DisplayDeck,
      player2DisplayDeck: args.player2DisplayDeck,
      player1TournamentRecord: args.player1TournamentRecord,
      player2TournamentRecord: args.player2TournamentRecord,
    });
  },
});

export const updatePlayerLife = mutation({
  args: {
    overlayId: v.id("overlays"),
    playerIndex: v.union(v.literal("1"), v.literal("2")),
    newLifeTotal: v.number(),
  },
  handler: async (ctx, args) => {
    await requireMatchOverlayAccess(ctx, args.overlayId);

    const updateField = `player${args.playerIndex}Life` as const;

    await ctx.db.patch(args.overlayId, {
      [updateField]: args.newLifeTotal,
    });
  },
});

export const incrementGamesWon = mutation({
  args: {
    overlayId: v.id("overlays"),
    playerIndex: v.union(v.literal("1"), v.literal("2")),
  },
  handler: async (ctx, args) => {
    const { overlay } = await requireMatchOverlayAccess(ctx, args.overlayId);

    const currentGamesWon = overlay[`player${args.playerIndex}GamesWon`] || 0;
    const updateField = `player${args.playerIndex}GamesWon` as const;

    await ctx.db.patch(args.overlayId, {
      [updateField]: currentGamesWon + 1,
      player1Life: 20,
      player2Life: 20,
    });
  },
});

export const resetMatch = mutation({
  args: {
    overlayId: v.id("overlays"),
  },
  handler: async (ctx, args) => {
    await requireMatchOverlayAccess(ctx, args.overlayId);

    await ctx.db.patch(args.overlayId, {
      player1Life: 20, // or make this configurable
      player2Life: 20, // or make this configurable
      player1GamesWon: 0,
      player2GamesWon: 0,
    });
  },
});

export const swapPlayers = mutation({
  args: {
    overlayId: v.id("overlays"),
  },
  handler: async (ctx, args) => {
    const { overlay } = await requireMatchOverlayAccess(ctx, args.overlayId);

    await ctx.db.patch(args.overlayId, {
      player1: overlay.player2,
      player2: overlay.player1,
      player1DisplayName: overlay.player2DisplayName,
      player2DisplayName: overlay.player1DisplayName,
      player1DisplayDeck: overlay.player2DisplayDeck,
      player2DisplayDeck: overlay.player1DisplayDeck,
      player1TournamentRecord: overlay.player2TournamentRecord,
      player2TournamentRecord: overlay.player1TournamentRecord,
    });
  },
});

export const resetMatchOverlay = mutation({
  args: {
    overlayId: v.id("overlays"),
  },
  handler: async (ctx, args) => {
    const { overlay } = await requireMatchOverlayAccess(ctx, args.overlayId);

    await ctx.db.patch(overlay._id, {
      ...DEFAULT_MATCH,
    });
  },
});

export const setOverlayFeatureMatch = mutation({
  args: {
    overlayId: v.id("overlays"),
    featureMatchId: v.id("featureMatches"),
    playersSwapped: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireMatchOverlayAccess(ctx, args.overlayId);

    const featureMatch = await ctx.db.get(args.featureMatchId);
    if (!featureMatch) {
      throw new Error("Feature match not found");
    }

    const player1 = args.playersSwapped
      ? featureMatch.player2
      : featureMatch.player1;
    const player1TournamentRecord = args.playersSwapped
      ? featureMatch.player2TournamentRecord
      : featureMatch.player1TournamentRecord;
    const player2 = args.playersSwapped
      ? featureMatch.player1
      : featureMatch.player2;
    const player2TournamentRecord = args.playersSwapped
      ? featureMatch.player1TournamentRecord
      : featureMatch.player2TournamentRecord;

    // TODO: am i forgetting to swap the tournament records?
    await ctx.db.patch(args.overlayId, {
      player1,
      player2,
      player1TournamentRecord,
      player2TournamentRecord,
    });
  },
});

export const setMatchOverlaySettings = mutation({
  args: {
    overlayId: v.id("overlays"),
    name: v.optional(v.string()),
    template: v.optional(availableTemplatesValidator),
  },
  handler: async (ctx, args) => {
    await requireMatchOverlayAccess(ctx, args.overlayId);
    const { overlayId, ...updateFields } = args;
    const updates = filterUndefined(updateFields);

    await ctx.db.patch(overlayId, updates);
  },
});
