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
import {
  createStandingsOverlayHelper,
  scheduleEliminationPairingsBackfill,
} from "../lib/overlays";
import { filterUndefined } from "../lib/utils";
import { isEliminationRoundName } from "../lib/constants";
import { getMeleeCredentialsForTournament } from "../lib/settings";
import { getOwnExternalTournament } from "../lib/tournaments";
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
        internal.overlays.standings.getRoundStandingsCredentials,
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
      await ctx.runMutation(internal.overlays.standings.updateRoundStandings, {
        standingsId: args.standingsId,
        standingsData: {
          roundNumber: meleeStandings[0].RoundNumber,
          standings: toStandingRows(meleeStandings),
        },
      });
    } catch (error) {
      await ctx.runMutation(
        internal.overlays.standings.markRoundStandingsFetchFailed,
        {
          standingsId: args.standingsId,
          error: String(error),
        },
      );
      throw error;
    }
  },
});

/**
 * Points a standings overlay at one view: the bracket going into the current
 * elimination round, the finished bracket with the finals result, or a
 * completed round. A Swiss round shows that round's standings table, which
 * are fetched from Melee on first use. An elimination round shows the
 * bracket as it stood going into that round, built from captured pairings,
 * so no standings are fetched for it.
 */
export const updateStandingsOverlay = mutation({
  args: {
    overlayId: v.id("overlays"),
    externalRoundId: v.optional(v.number()),
    showCurrentBracket: v.optional(v.boolean()),
    showCompletedBracket: v.optional(v.boolean()),
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
        showCompletedBracket: false,
      });
      const externalTournament = await getOwnExternalTournament(ctx);
      await scheduleEliminationPairingsBackfill(
        ctx,
        tournament,
        externalTournament?.currentRoundId,
      );
      return null;
    }
    if (args.showCompletedBracket) {
      await ctx.db.patch(args.overlayId, {
        showCurrentBracket: false,
        showCompletedBracket: true,
      });
      await scheduleEliminationPairingsBackfill(ctx, tournament);
      return null;
    }

    if (args.externalRoundId === undefined) {
      await ctx.db.patch(args.overlayId, {
        showCurrentBracket: false,
        showCompletedBracket: false,
      });
      return null;
    }

    const { roundName } = await requireRoundForTournament(
      ctx,
      tournament,
      args.externalRoundId,
    );
    if (isEliminationRoundName(roundName)) {
      await ctx.db.patch(args.overlayId, {
        roundStandingsId: undefined,
        externalRoundId: args.externalRoundId,
        showCurrentBracket: false,
        showCompletedBracket: false,
      });
      await scheduleEliminationPairingsBackfill(
        ctx,
        tournament,
        args.externalRoundId,
      );
      return null;
    }
    const standings = await getRoundStandingsHelper(ctx, args.externalRoundId);
    await ctx.db.patch(args.overlayId, {
      roundStandingsId: standings,
      externalRoundId: args.externalRoundId,
      showCurrentBracket: false,
      showCompletedBracket: false,
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
