import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const matchPreviewControllerSource = readFileSync(
  "app/dashboard/controllers/components/match-preview-controller.tsx",
  "utf8",
);

describe("MatchPreviewController dialog state", () => {
  it("resyncs dialog inputs from the current overlay when opened externally", () => {
    expect(matchPreviewControllerSource).toContain(
      "const [dialogResetKey, setDialogResetKey] = useState(0);",
    );
    expect(matchPreviewControllerSource).toContain(
      "setDialogResetKey((key) => key + 1);",
    );
    expect(matchPreviewControllerSource).toContain("onClick={handleEditClick}");
    expect(matchPreviewControllerSource).toContain("key={dialogResetKey}");
    expect(matchPreviewControllerSource).toContain(
      "setInputs(getMatchOverlayDisplayValues(matchOverlay));",
    );
  });
});
