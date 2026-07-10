import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const WIPE_TABLES = [
  "players",
  "playerStatuses",
  "playerDecklists",
  "pairings",
  "featureMatches",
  "roundStandings",
  "externalTournaments",
  "integrationLogs",
] as const;

const DELETE_BATCH_SIZE = 500;

/**
 * One-shot reset of all provider-integration data, run before deploying the
 * provider-agnostic schema rename (old-shaped rows would fail validation).
 * Deletes integration tables in batches (self-scheduling to stay within
 * transaction limits), then clears provider fields on retained tables.
 *
 * Run with: npx convex run maintenance:wipeIntegrationData
 */
export const wipeIntegrationData = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const table of WIPE_TABLES) {
      const rows = await ctx.db.query(table).take(DELETE_BATCH_SIZE);
      if (rows.length > 0) {
        for (const row of rows) {
          await ctx.db.delete(row._id);
        }
        await ctx.scheduler.runAfter(
          0,
          internal.maintenance.wipeIntegrationData,
          {},
        );
        console.log(`Deleted ${rows.length} rows from ${table}; continuing`);
        return;
      }
    }

    for await (const tournament of ctx.db.query("tournaments")) {
      await ctx.db.patch(tournament._id, {
        mode: "manual",
        externalTournamentId: undefined,
        externalTournamentStatus: undefined,
        pollingStatus: undefined,
        pollingErrorMessage: undefined,
        pollingSessionId: undefined,
        currentRound: undefined,
        currentRoundDisplayName: undefined,
      });
    }

    for await (const overlay of ctx.db.query("overlays")) {
      if (overlay.overlayType === "standings") {
        await ctx.db.patch(overlay._id, {
          roundStandingsId: undefined,
          externalRoundId: undefined,
          showCurrentBracket: undefined,
        });
      }
    }

    for await (const settings of ctx.db.query("settings")) {
      await ctx.db.patch(settings._id, {
        meleeClientId: undefined,
        meleeClientSecret: undefined,
        meleeUsername: undefined,
        meleePassword: undefined,
      });
    }

    console.log("Integration data wipe complete");
  },
});
