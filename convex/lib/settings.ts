import { requireAuth } from "./auth";
import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

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
