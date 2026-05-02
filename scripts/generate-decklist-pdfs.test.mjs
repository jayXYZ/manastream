import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(new URL("./generate-decklist-pdfs.mjs", import.meta.url));

describe("generate-decklist-pdfs CLI", () => {
  it("accepts a forwarded -- separator before options", () => {
    const result = spawnSync(process.execPath, [scriptPath, "--", "--help"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Generate DCI decklist PDFs");
  });
});
