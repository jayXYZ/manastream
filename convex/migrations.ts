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
