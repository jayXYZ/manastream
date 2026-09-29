import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cardActionButtonSource = readFileSync(
  "components/ui/card-action-button.tsx",
  "utf8",
);

describe("CardActionButton visibility", () => {
  it("only hides the unrevealed button on devices that can hover", () => {
    // Tailwind gates `hover:` and `group-hover:` behind `@media (hover: hover)`,
    // so a touch device never reveals an `opacity-0` button. The resting
    // opacity must therefore be visible, with the hide scoped to hover-capable
    // devices where the card's hover reveals it again.
    expect(cardActionButtonSource).toContain(
      '"opacity-70 [@media(hover:hover)]:opacity-0 group-hover:opacity-70 focus-visible:opacity-70"',
    );
    expect(cardActionButtonSource).toContain(
      '"opacity-30 [@media(hover:hover)]:opacity-0 group-hover:opacity-30"',
    );
    expect(cardActionButtonSource).not.toMatch(/"opacity-0 /);
  });
});
