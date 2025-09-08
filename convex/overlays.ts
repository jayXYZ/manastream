import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { filterUndefined, generatePublicUuid } from "./lib/utils";
import {
  getOverlayByIdValidator,
  getOverlayByUuidValidator,
  overlayValidator,
  availableTemplatesValidator,
} from "./validators";
import { Player } from "./types";

// Create a match overlay
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Verify tournament ownership
    const tournament = await ctx.db.get(args.tournamentId);
    if (!tournament || tournament.userId !== userId) {
      throw new Error("Tournament not found or access denied");
    }

    const publicUuid = generatePublicUuid();

    const overlayId = await ctx.db.insert("overlays", {
      name: args.name,
      overlayType: "match",
      template: "Default",
      templateId: undefined,
      tournamentId: args.tournamentId,
      publicUuid,
      player1: undefined,
      player2: undefined,
      player1Life: 20,
      player2Life: 20,
      player1GamesWon: 0,
      player2GamesWon: 0,
      createdAt: Date.now(),
    });

    return { overlayId, publicUuid };
  },
});

// Create a card overlay
export const createCardOverlay = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    name: v.string(),
  },
  returns: v.object({
    overlayId: v.id("overlays"),
    publicUuid: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Verify tournament ownership
    const tournament = await ctx.db.get(args.tournamentId);
    if (!tournament || tournament.userId !== userId) {
      throw new Error("Tournament not found or access denied");
    }

    const publicUuid = generatePublicUuid();

    const overlayId = await ctx.db.insert("overlays", {
      name: args.name,
      overlayType: "card",
      tournamentId: args.tournamentId,
      publicUuid,
      cardUrl:
        "https://cards.scryfall.io/png/front/c/a/ca367f49-0f4a-4b7f-8104-851893fbcd8a.png?1562937711",
      createdAt: Date.now(),
    });

    return { overlayId, publicUuid };
  },
});

// Create a commentary overlay
export const createCommentaryOverlay = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    name: v.string(),
  },
  returns: v.object({
    overlayId: v.id("overlays"),
    publicUuid: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const publicUuid = generatePublicUuid();

    const overlayId = await ctx.db.insert("overlays", {
      name: args.name,
      overlayType: "commentary",
      tournamentId: args.tournamentId,
      publicUuid,
      template: "Default",
      templateId: undefined,
      commentatorLeft: "Commentator Left",
      commentatorLeftSubText: undefined,
      commentatorRight: "Commentator Right",
      commentatorRightSubText: undefined,
      createdAt: Date.now(),
    });

    return { overlayId, publicUuid };
  },
});

// Get overlay by public UUID (no authentication required)
export const getOverlayByUuid = query({
  args: {
    publicUuid: v.string(),
  },
  returns: getOverlayByUuidValidator,
  handler: async (ctx, args) => {
    const overlay = await ctx.db
      .query("overlays")
      .withIndex("by_public_uuid", (q) => q.eq("publicUuid", args.publicUuid))
      .unique();

    if (!overlay) {
      return null;
    }

    // For match overlays, fetch player data
    if (overlay.overlayType === "match") {
      if (overlay.player1 && overlay.player2) {
        const [player1, player2] = await Promise.all([
          ctx.db.get(overlay.player1),
          ctx.db.get(overlay.player2),
        ]);
        const tournament = await ctx.db.get(overlay.tournamentId);

        return {
          ...overlay,
          player1Data: player1 ?? undefined,
          player2Data: player2 ?? undefined,
          manualTimerExpiry: tournament?.manualTimerExpiry ?? undefined,
          manualTimerRunning: tournament?.manualTimerRunning ?? undefined,
        };
      } else {
        return {
          ...overlay,
        };
      }
    }

    // For deck overlays, fetch the feature match data if needed
    if (overlay.overlayType === "deck") {
      if (!overlay.matchId) {
        throw new Error("Match ID not found for deck overlay");
      }
      const featureMatch = await ctx.db.get(overlay.matchId);
      if (!featureMatch) {
        throw new Error("Feature match not found for deck overlay");
      }
      const [player1, player2] = await Promise.all([
        ctx.db.get(featureMatch.player1),
        ctx.db.get(featureMatch.player2),
      ]);

      if (!player1 || !player2) {
        throw new Error("Player not found for feature match in deck overlay");
      }
      return {
        ...overlay,
        matchData: {
          ...featureMatch,
          player1Data: player1,
          player2Data: player2,
        },
      };
    }

    return overlay;
  },
});

// Update match overlay data (authenticated)
export const updateMatchOverlay = mutation({
  args: {
    overlayId: v.id("overlays"),
    player1Life: v.optional(v.number()),
    player2Life: v.optional(v.number()),
    player1GamesWon: v.optional(v.number()),
    player2GamesWon: v.optional(v.number()),
    player1DisplayName: v.optional(v.string()),
    player2DisplayName: v.optional(v.string()),
    player1DisplayDeck: v.optional(v.string()),
    player2DisplayDeck: v.optional(v.string()),
    player1TournamentRecord: v.optional(v.string()),
    player2TournamentRecord: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const overlay = await ctx.db.get(args.overlayId);
    if (!overlay || overlay.overlayType !== "match") {
      throw new Error("Match overlay not found");
    }

    // Verify tournament ownership
    const tournament = await ctx.db.get(overlay.tournamentId);
    if (!tournament || tournament.userId !== userId) {
      throw new Error("Access denied");
    }

    // Extract only the update fields (excluding overlayId) and filter out undefined values
    const { overlayId, ...updateFields } = args;
    const updates = filterUndefined(updateFields);

    await ctx.db.patch(args.overlayId, updates);
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const overlay = await ctx.db.get(args.overlayId);
    if (!overlay || overlay.overlayType !== "match") {
      throw new Error("Match overlay not found");
    }

    // Verify tournament ownership
    const tournament = await ctx.db.get(overlay.tournamentId);
    if (!tournament || tournament.userId !== userId) {
      throw new Error("Access denied");
    }

    const featureMatch = await ctx.db.get(args.featureMatchId);
    if (!featureMatch) {
      throw new Error("Feature match not found");
    }

    const player1 = args.playersSwapped
      ? featureMatch.player2
      : featureMatch.player1;
    const player2 = args.playersSwapped
      ? featureMatch.player1
      : featureMatch.player2;

    await ctx.db.patch(args.overlayId, {
      player1,
      player2,
    });
    return null;
  },
});

// Specialized mutation: Update player life total
export const updatePlayerLife = mutation({
  args: {
    overlayId: v.id("overlays"),
    playerIndex: v.union(v.literal("1"), v.literal("2")),
    newLifeTotal: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const overlay = await ctx.db.get(args.overlayId);
    if (!overlay || overlay.overlayType !== "match") {
      throw new Error("Match overlay not found");
    }

    // Verify tournament ownership
    const tournament = await ctx.db.get(overlay.tournamentId);
    if (!tournament || tournament.userId !== userId) {
      throw new Error("Access denied");
    }

    const updateField = `player${args.playerIndex}Life` as const;

    await ctx.db.patch(args.overlayId, {
      [updateField]: args.newLifeTotal,
    });
    return null;
  },
});

// Specialized mutation: Increment games won for a player and reset both
// players' life totals to 20
export const incrementGamesWon = mutation({
  args: {
    overlayId: v.id("overlays"),
    playerIndex: v.union(v.literal("1"), v.literal("2")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const overlay = await ctx.db.get(args.overlayId);
    if (!overlay || overlay.overlayType !== "match") {
      throw new Error("Match overlay not found");
    }

    // Verify tournament ownership
    const tournament = await ctx.db.get(overlay.tournamentId);
    if (!tournament || tournament.userId !== userId) {
      throw new Error("Access denied");
    }

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

// Specialized mutation: Reset match (set both players to starting life and games won to 0)
export const resetMatch = mutation({
  args: {
    overlayId: v.id("overlays"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const overlay = await ctx.db.get(args.overlayId);
    if (!overlay || overlay.overlayType !== "match") {
      throw new Error("Match overlay not found");
    }

    // Verify tournament ownership
    const tournament = await ctx.db.get(overlay.tournamentId);
    if (!tournament || tournament.userId !== userId) {
      throw new Error("Access denied");
    }

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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const overlay = await ctx.db.get(args.overlayId);
    if (!overlay || overlay.overlayType !== "match") {
      throw new Error("Match overlay not found");
    }

    const tournament = await ctx.db.get(overlay.tournamentId);
    if (!tournament || tournament.userId !== userId) {
      throw new Error("Access denied");
    }

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
    return null;
  },
});

// Reset match overlay data (authenticated)
export const resetMatchOverlay = mutation({
  args: {
    overlayId: v.id("overlays"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const overlay = await ctx.db.get(args.overlayId);
    if (!overlay || overlay.overlayType !== "match") {
      throw new Error("Match overlay not found");
    }

    await ctx.db.patch(args.overlayId, {
      player1: undefined,
      player2: undefined,
      player1Life: 20,
      player2Life: 20,
      player1GamesWon: 0,
      player2GamesWon: 0,
      player1DisplayName: undefined,
      player2DisplayName: undefined,
      player1DisplayDeck: undefined,
      player2DisplayDeck: undefined,
      player1TournamentRecord: undefined,
      player2TournamentRecord: undefined,
    });

    return null;
  },
});

// Set card overlay data (authenticated)
export const setCardInCardOverlay = mutation({
  args: {
    overlayId: v.id("overlays"),
    cardUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const overlay = await ctx.db.get(args.overlayId);
    if (!overlay || overlay.overlayType !== "card") {
      throw new Error("Card overlay not found");
    }

    await ctx.db.patch(args.overlayId, {
      cardUrl: args.cardUrl,
    });
    return null;
  },
});

// Get all overlays for a user (authenticated), return overlay ID, type, name, and public UUID
export const getUserOverlays = query({
  args: {},
  returns: v.array(overlayValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }
    // Find the user's tournament (assuming 1 tournament per user)
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!tournament) {
      return [];
    }
    // Fetch overlays for that tournament
    const overlays = await ctx.db
      .query("overlays")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
      .collect();

    return overlays;
  },
});

// Get overlay by id (authenticated)
export const getOverlayById = query({
  args: {
    overlayId: v.id("overlays"),
  },
  returns: getOverlayByIdValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const overlay = await ctx.db.get(args.overlayId);
    if (!overlay) {
      throw new Error("Overlay not found");
    }

    // Verify tournament ownership
    const tournament = await ctx.db.get(overlay.tournamentId);
    if (!tournament || tournament.userId !== userId) {
      throw new Error("Access denied");
    }

    // For match overlays, fetch player data
    if (overlay.overlayType === "match") {
      let player1Data, player2Data;
      if (overlay.player1) {
        player1Data = await ctx.db.get(overlay.player1);
      }
      if (overlay.player2) {
        player2Data = await ctx.db.get(overlay.player2);
      }
      const result = {
        ...overlay,
        player1Data: player1Data ?? undefined,
        player2Data: player2Data ?? undefined,
      };
      return result;
    }

    // For deck overlays, fetch the feature match data if needed
    if (overlay.overlayType === "deck") {
      if (!overlay.matchId) {
        throw new Error("Match ID not found for deck overlay");
      }
      const featureMatch = await ctx.db.get(overlay.matchId);
      if (!featureMatch) {
        throw new Error("Feature match not found for deck overlay");
      }
      const [player1, player2] = await Promise.all([
        ctx.db.get(featureMatch.player1),
        ctx.db.get(featureMatch.player2),
      ]);
      if (!player1 || !player2) {
        throw new Error("Player not found for feature match in deck overlay");
      }
      return {
        ...overlay,
        matchData: {
          ...featureMatch,
          player1Data: player1,
          player2Data: player2,
        },
      };
    }

    return overlay;
  },
});

export const setOverlayTemplate = mutation({
  args: {
    overlayId: v.id("overlays"),
    template: availableTemplatesValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const overlay = await ctx.db.get(args.overlayId);
    if (!overlay) {
      throw new Error("Overlay not found");
    }

    await ctx.db.patch(args.overlayId, {
      template: args.template,
    });
    return null;
  },
});

export const setMatchOverlaySettings = mutation({
  args: {
    overlayId: v.id("overlays"),
    name: v.string(),
    template: availableTemplatesValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const overlay = await ctx.db.get(args.overlayId);
    if (!overlay || overlay.overlayType !== "match") {
      throw new Error("Match overlay not found");
    }

    await ctx.db.patch(args.overlayId, {
      name: args.name,
      template: args.template,
    });
    return null;
  },
});

export const deleteOverlay = mutation({
  args: {
    overlayId: v.id("overlays"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const overlay = await ctx.db.get(args.overlayId);

    if (!overlay) {
      throw new Error("Overlay not found");
    }

    // Verify tournament ownership
    const tournament = await ctx.db.get(overlay.tournamentId);
    if (!tournament || tournament.userId !== userId) {
      throw new Error("Access denied");
    }

    await ctx.db.delete(args.overlayId);
    return null;
  },
});
