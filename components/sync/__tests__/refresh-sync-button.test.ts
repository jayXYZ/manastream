import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const refreshSyncButtonSource = readFileSync(
  "components/sync/refresh-sync-button.tsx",
  "utf8",
);

describe("RefreshSyncButton icon variant keyboard access", () => {
  it("makes the tooltip wrapper the tab stop only while the button is disabled", () => {
    // A natively disabled button cannot be focused, so the wrapper must take
    // over as the focusable tooltip trigger in that state, and only in that
    // state so the enabled button does not gain an extra tab stop.
    expect(refreshSyncButtonSource).toContain(
      "tabIndex={isDisabled ? 0 : undefined}",
    );
    expect(refreshSyncButtonSource).toContain(
      'role={isDisabled ? "button" : undefined}',
    );
    expect(refreshSyncButtonSource).toContain(
      "aria-disabled={isDisabled ? true : undefined}",
    );
    expect(refreshSyncButtonSource).toContain(
      'aria-label={isDisabled ? "Refresh now" : undefined}',
    );
  });

  it("hides the disabled inner button so assistive tech announces one control", () => {
    expect(refreshSyncButtonSource).toContain(
      "aria-hidden={isDisabled ? true : undefined}",
    );
  });

  it("keeps the native disabled attribute on the refresh action", () => {
    expect(refreshSyncButtonSource).toContain("disabled={isDisabled}");
  });
});
