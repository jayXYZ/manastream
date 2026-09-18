import { Migrations } from "@convex-dev/migrations";

import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

export const migrations = new Migrations<DataModel>(components.migrations, {
  internalMutation,
});
export const run = migrations.runner();

export const backfillMeleeClientCredentials = migrations.define({
  table: "settings",
  migrateOne: (_ctx, settings) => {
    if (
      settings.meleeClientId !== undefined &&
      settings.meleeClientSecret !== undefined
    ) {
      return;
    }

    return {
      meleeClientId: settings.meleeClientId ?? settings.meleeUsername ?? "",
      meleeClientSecret:
        settings.meleeClientSecret ?? settings.meleePassword ?? "",
    };
  },
});

/**
 * Per-cycle polling bookkeeping moved from the tournaments document to the
 * pollingSessions table. Any tournament that was mid-session when this
 * deployed has an orphaned scheduled loop that can no longer claim its
 * cycle, so reset it to manual with a message asking to re-enable auto sync.
 */
export const clearLegacyPollingFields = migrations.define({
  table: "tournaments",
  migrateOne: (_ctx, tournament) => {
    const hadLegacySession =
      tournament.pollingSessionId !== undefined ||
      tournament.pollingCycleId !== undefined ||
      tournament.pollingCycleStartedAt !== undefined;
    if (!hadLegacySession) {
      return;
    }
    const wasPolling =
      tournament.mode === "auto" && tournament.pollingStatus === "active";
    return {
      pollingSessionId: undefined,
      pollingCycleId: undefined,
      pollingCycleStartedAt: undefined,
      ...(wasPolling
        ? {
            mode: "manual" as const,
            pollingStatus: "inactive" as const,
            pollingErrorMessage:
              "Auto sync was reset by a deploy. Re-enable auto mode to resume polling.",
          }
        : {}),
    };
  },
});
