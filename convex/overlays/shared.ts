import { mutation } from "../_generated/server";
import { v, type VLiteral, type VUnion } from "convex/values";
import { requireOverlayAccess } from "../lib/auth";
import {
  cardTemplatesValidator,
  commentaryTemplatesValidator,
  deckTemplatesValidator,
  matchTemplatesValidator,
  overlayTemplatesValidator,
} from "../validators";

// The per-type allowlists are derived from the same validators that the
// per-type settings mutations (setMatchOverlaySettings etc.) accept, so the
// two code paths can never disagree about which templates an overlay type
// supports.
function templateSet(
  validator: VUnion<string, VLiteral<string>[]>,
): ReadonlySet<string> {
  return new Set(validator.members.map((member) => member.value));
}

const MATCH_TEMPLATES = templateSet(matchTemplatesValidator);
const COMMENTARY_TEMPLATES = templateSet(commentaryTemplatesValidator);
const CARD_TEMPLATES = templateSet(cardTemplatesValidator);
const DECK_TEMPLATES = templateSet(deckTemplatesValidator);

export const setOverlayTemplate = mutation({
  args: {
    overlayId: v.id("overlays"),
    template: overlayTemplatesValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { overlay } = await requireOverlayAccess(ctx, args.overlayId);

    if (overlay.overlayType === "match" && !MATCH_TEMPLATES.has(args.template)) {
      throw new Error("Template is not available for match overlays");
    }
    if (
      overlay.overlayType === "commentary" &&
      !COMMENTARY_TEMPLATES.has(args.template)
    ) {
      throw new Error("Template is not available for commentary overlays");
    }
    if (overlay.overlayType === "card" && !CARD_TEMPLATES.has(args.template)) {
      throw new Error("Template is not available for card overlays");
    }
    if (overlay.overlayType === "deck" && !DECK_TEMPLATES.has(args.template)) {
      throw new Error("Template is not available for deck overlays");
    }
    if (overlay.overlayType === "standings") {
      throw new Error(
        `Template updates are not supported for ${overlay.overlayType} overlays`,
      );
    }

    await ctx.db.patch(args.overlayId, {
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
    await requireOverlayAccess(ctx, args.overlayId);

    await ctx.db.delete(args.overlayId);
    return null;
  },
});
