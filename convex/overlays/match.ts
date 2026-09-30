import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { filterUndefined } from "../lib/utils";
import {
  braunDarkPaletteValidator,
  matchTemplatesValidator,
  updateMatchOverlayArgsValidator,
} from "../validators";
import {
  requireTournamentAccess,
  requireMatchOverlayAccess,
  requireFeatureMatchForTournament,
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

/**
 * Update a match overlay's life totals, game counts, and manual display
 * overrides. Omitted fields are left untouched. For the display overrides,
 * pass `null` to clear the override: the stored field is removed so the
 * overlay falls back to the linked player's data.
 */
export const updateMatchOverlay = mutation({
  args: updateMatchOverlayArgsValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMatchOverlayAccess(ctx, args.overlayId);

    const { overlayId, ...updateFields } = args;
    // Drop omitted fields so they are not touched, and map `null` to
    // `undefined` so `patch` removes the field (the schema stores these as
    // optional strings, never null).
    const updates = Object.fromEntries(
      Object.entries(updateFields)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, value === null ? undefined : value]),
    ) as {
      [K in keyof typeof updateFields]?: Exclude<
        (typeof updateFields)[K],
        null
      >;
    };

    await ctx.db.patch(overlayId, updates);
    return null;
  },
});

export const updatePlayerLife = mutation({
  args: {
    overlayId: v.id("overlays"),
    playerIndex: v.union(v.literal("1"), v.literal("2")),
    newLifeTotal: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMatchOverlayAccess(ctx, args.overlayId);

    const updateField = `player${args.playerIndex}Life` as const;

    await ctx.db.patch(args.overlayId, {
      [updateField]: args.newLifeTotal,
    });
    return null;
  },
});

export const incrementGamesWon = mutation({
  args: {
    overlayId: v.id("overlays"),
    playerIndex: v.union(v.literal("1"), v.literal("2")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { overlay } = await requireMatchOverlayAccess(ctx, args.overlayId);

    const currentGamesWon = overlay[`player${args.playerIndex}GamesWon`] || 0;
    const updateField = `player${args.playerIndex}GamesWon` as const;

    await ctx.db.patch(args.overlayId, {
      [updateField]: currentGamesWon + 1,
      player1Life: 20,
      player2Life: 20,
    });
    return null;
  },
});

export const resetMatch = mutation({
  args: {
    overlayId: v.id("overlays"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMatchOverlayAccess(ctx, args.overlayId);

    await ctx.db.patch(args.overlayId, {
      player1Life: 20, // or make this configurable
      player2Life: 20, // or make this configurable
      player1GamesWon: 0,
      player2GamesWon: 0,
    });
    return null;
  },
});

export const swapPlayers = mutation({
  args: {
    overlayId: v.id("overlays"),
  },
  returns: v.null(),
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
      player1Lc26BackgroundColor: overlay.player2Lc26BackgroundColor,
      player2Lc26BackgroundColor: overlay.player1Lc26BackgroundColor,
    });
    return null;
  },
});

export const resetMatchOverlay = mutation({
  args: {
    overlayId: v.id("overlays"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { overlay } = await requireMatchOverlayAccess(ctx, args.overlayId);

    await ctx.db.patch(overlay._id, {
      ...DEFAULT_MATCH,
    });
    return null;
  },
});

export const setOverlayFeatureMatch = mutation({
  args: {
    overlayId: v.id("overlays"),
    featureMatchId: v.id("featureMatches"),
    playersSwapped: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { tournament } = await requireMatchOverlayAccess(ctx, args.overlayId);
    const featureMatch = await requireFeatureMatchForTournament(
      ctx,
      args.featureMatchId,
      tournament,
    );

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

    // Start from a clean match so a feature match selected mid-round (after a
    // previous match finished on this overlay) doesn't inherit stale life
    // totals, game counts, or manual display overrides.
    await ctx.db.patch(args.overlayId, {
      ...DEFAULT_MATCH,
      player1,
      player2,
      player1TournamentRecord,
      player2TournamentRecord,
    });
    return null;
  },
});

export const setMatchOverlaySettings = mutation({
  args: {
    overlayId: v.id("overlays"),
    name: v.optional(v.string()),
    template: v.optional(matchTemplatesValidator),
    braunDarkPalette: v.optional(braunDarkPaletteValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMatchOverlayAccess(ctx, args.overlayId);
    const { overlayId, ...updateFields } = args;
    const updates = filterUndefined(updateFields);

    await ctx.db.patch(overlayId, updates);
    return null;
  },
});
