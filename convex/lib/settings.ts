import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAuth } from "./auth";
import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import type { MeleeCredentials } from "./melee/api";

type SettingsCredentialFields = Pick<
  Doc<"settings">,
  "meleeClientId" | "meleeClientSecret" | "meleeUsername" | "meleePassword"
>;

/**
 * The caller's settings row, or null when there is no signed-in user or
 * the user has not been initialized yet. For queries; mutations use
 * `getUserSettings` and throw.
 */
export async function getOptionalUserSettings(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"settings"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return null;
  }
  return await ctx.db
    .query("settings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

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

export async function getMeleeCredentialsForTournament(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
): Promise<MeleeCredentials> {
  const tournament = await ctx.db.get(tournamentId);
  if (!tournament) {
    throw new Error("Tournament not found");
  }
  const settings = await ctx.db
    .query("settings")
    .withIndex("by_user", (q) => q.eq("userId", tournament.userId))
    .unique();
  if (!settings || !hasMeleeCredentials(settings)) {
    throw new Error("No Melee credentials found for tournament");
  }
  return getMeleeCredentialsFromSettings(settings);
}
