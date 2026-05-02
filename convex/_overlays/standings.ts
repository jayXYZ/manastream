import { v } from "convex/values";
import {
  internalMutation,
  internalAction,
  mutation,
} from "../_generated/server";
import {
  braunDarkPaletteValidator,
  spicerackRoundStandingsDataValidator,
} from "../validators";
import { updateSpicerackRoundStandingsHelper } from "../lib/spicerack/standings";
import { fetchSpicerackRoundStandingsData } from "../lib/spicerack/api";
import { internal } from "../_generated/api";
import {
  requireStandingsOverlayAccess,
  requireTournamentAccess,
} from "../lib/auth";
import { getSpicerackRoundStandingsHelper } from "../lib/spicerack/standings";
import { createStandingsOverlayHelper } from "../lib/overlays";
import { filterUndefined } from "../lib/utils";

export const updateSpicerackRoundStandings = internalMutation({
  args: {
    standingsId: v.id("roundStandings"),
    standingsData: spicerackRoundStandingsDataValidator,
  },
  handler: async (ctx, args) => {
    await updateSpicerackRoundStandingsHelper(
      ctx,
      args.standingsId,
      args.standingsData,
    );
  },
});

export const fetchAndUpdateSpicerackRoundStandings = internalAction({
  args: {
    tournamentId: v.id("tournaments"),
    spicerackRoundId: v.number(),
    standingsId: v.id("roundStandings"),
    spicerackApiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const standings = await fetchSpicerackRoundStandingsData(
      args.spicerackRoundId,
      args.spicerackApiKey,
    );
    await ctx.runMutation(internal.overlays.updateSpicerackRoundStandings, {
      standingsId: args.standingsId,
      standingsData: standings,
    });
  },
});

export const updateStandingsOverlay = mutation({
  args: {
    overlayId: v.id("overlays"),
    spicerackRoundId: v.optional(v.number()),
    showCurrentBracket: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireStandingsOverlayAccess(ctx, args.overlayId);
    if (args.showCurrentBracket) {
      await ctx.db.patch(args.overlayId, {
        showCurrentBracket: true,
      });
      return;
    }

    if (args.spicerackRoundId === undefined) {
      await ctx.db.patch(args.overlayId, {
        showCurrentBracket: false,
      });
      return;
    }

    const standings = await getSpicerackRoundStandingsHelper(
      ctx,
      args.spicerackRoundId,
    );
    await ctx.db.patch(args.overlayId, {
      roundStandingsId: standings,
      spicerackRoundId: args.spicerackRoundId,
      showCurrentBracket: false,
    });
  },
});

export const setStandingsOverlaySettings = mutation({
  args: {
    overlayId: v.id("overlays"),
    name: v.optional(v.string()),
    braunDarkPalette: v.optional(braunDarkPaletteValidator),
  },
  handler: async (ctx, args) => {
    await requireStandingsOverlayAccess(ctx, args.overlayId);

    const { overlayId, ...updateFields } = args;
    const updates = filterUndefined(updateFields);

    await ctx.db.patch(overlayId, updates);
  },
});

/**
 * Public mutation to create a commentary overlay.
 * Requires authentication and tournament access.
 */
export const createStandingsOverlay = mutation({
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

    return await createStandingsOverlayHelper(ctx, tournament._id, args.name);
  },
});
