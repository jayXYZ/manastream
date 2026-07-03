import { requireAuth } from "./auth";
import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import type { MeleeCredentials } from "./melee/api";

type SettingsCredentialFields = Pick<
  Doc<"settings">,
  "meleeClientId" | "meleeClientSecret" | "meleeUsername" | "meleePassword"
>;

export async function getUserSettings(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"settings">> {
  const user = await requireAuth(ctx);
  const settings = await ctx.db
    .query("settings")
    .withIndex("by_user", (q) => q.eq("userId", user))
    .unique();
  if (!settings) {
    throw new Error("Settings not found");
  }
  return settings;
}

export function getMeleeCredentialsFromSettings(
  settings: SettingsCredentialFields,
): MeleeCredentials {
  return {
    clientId: settings.meleeClientId ?? settings.meleeUsername ?? "",
    clientSecret: settings.meleeClientSecret ?? settings.meleePassword ?? "",
  };
}

export function hasMeleeCredentials(settings: SettingsCredentialFields) {
  const credentials = getMeleeCredentialsFromSettings(settings);
  return credentials.clientId.length > 0 && credentials.clientSecret.length > 0;
}
