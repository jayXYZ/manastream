import { v } from "convex/values";
import {
  internalMutation,
  internalAction,
  internalQuery,
  mutation,
} from "../_generated/server";
import {
  braunDarkPaletteValidator,
  roundStandingsDataValidator,
} from "../validators";
import {
  getRoundStandingsHelper,
  markRoundStandingsFetchFailedHelper,
  updateRoundStandingsHelper,
} from "../lib/standings";
import { fetchMeleeRoundStandings } from "../lib/melee/api";
import { toStandingRows } from "../models/melee";
import { internal } from "../_generated/api";
import {
  requireRoundForTournament,
  requireStandingsOverlayAccess,
  requireTournamentAccess,
} from "../lib/auth";
import { createStandingsOverlayHelper } from "../lib/overlays";
import { filterUndefined } from "../lib/utils";
import { getMeleeCredentialsForTournament } from "../lib/settings";
import type { MeleeCredentials } from "../lib/melee/api";

export const updateRoundStandings = internalMutation({
  args: {
    standingsId: v.id("roundStandings"),
    standingsData: roundStandingsDataValidator,
  },
  handler: async (ctx, args) => {
    await updateRoundStandingsHelper(ctx, args.standingsId, args.standingsData);
  },
});

export const markRoundStandingsFetchFailed = internalMutation({
  args: {
    standingsId: v.id("roundStandings"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await markRoundStandingsFetchFailedHelper(
      ctx,
      args.standingsId,
      args.error,
    );
  },
});

export const getRoundStandingsCredentials = internalQuery({
  args: {
    tournamentId: v.id("tournaments"),
  },
  returns: v.object({
    clientId: v.string(),
    clientSecret: v.string(),
  }),
  handler: async (ctx, args) => {
    return await getMeleeCredentialsForTournament(ctx, args.tournamentId);
  },
});

export const fetchAndUpdateRoundStandings = internalAction({
  args: {
    tournamentId: v.id("tournaments"),
    externalRoundId: v.number(),
    standingsId: v.id("roundStandings"),
  },
  handler: async (ctx, args) => {
    try {
      const credentials: MeleeCredentials = await ctx.runQuery(
        internal.overlays.getRoundStandingsCredentials,
        { tournamentId: args.tournamentId },
      );
      const meleeStandings = await fetchMeleeRoundStandings(
        args.externalRoundId,
        credentials,
      );
      if (meleeStandings.length === 0) {
        throw new Error(
          `No standings returned for round ${args.externalRoundId}`,
        );
      }
      await ctx.runMutation(internal.overlays.updateRoundStandings, {
        standingsId: args.standingsId,
        standingsData: {
          roundNumber: meleeStandings[0].RoundNumber,
          standings: toStandingRows(meleeStandings),
        },
      });
    } catch (error) {
      await ctx.runMutation(internal.overlays.markRoundStandingsFetchFailed, {
        standingsId: args.standingsId,
        error: String(error),
      });
      throw error;
    }
  },
});

export const updateStandingsOverlay = mutation({
  args: {
    overlayId: v.id("overlays"),
    externalRoundId: v.optional(v.number()),
    showCurrentBracket: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { tournament } = await requireStandingsOverlayAccess(
      ctx,
      args.overlayId,
    );
    if (args.showCurrentBracket) {
      await ctx.db.patch(args.overlayId, {
        showCurrentBracket: true,
      });
      return null;
    }

    if (args.externalRoundId === undefined) {
      await ctx.db.patch(args.overlayId, {
        showCurrentBracket: false,
      });
      return null;
    }

    await requireRoundForTournament(ctx, tournament, args.externalRoundId);
    const standings = await getRoundStandingsHelper(ctx, args.externalRoundId);
    await ctx.db.patch(args.overlayId, {
      roundStandingsId: standings,
      externalRoundId: args.externalRoundId,
      showCurrentBracket: false,
    });
    return null;
  },
});

export const setStandingsOverlaySettings = mutation({
  args: {
    overlayId: v.id("overlays"),
    name: v.optional(v.string()),
    braunDarkPalette: v.optional(braunDarkPaletteValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStandingsOverlayAccess(ctx, args.overlayId);

    const { overlayId, ...updateFields } = args;
    const updates = filterUndefined(updateFields);

    await ctx.db.patch(overlayId, updates);
    return null;
  },
});

/**
 * Public mutation to create a standings overlay.
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
