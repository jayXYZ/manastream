import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pairingsPageSource = readFileSync(
  "app/dashboard/pairings/page.tsx",
  "utf8",
);
const pairingsPageMainRender = pairingsPageSource.slice(
  pairingsPageSource.indexOf("  return (\n    <div"),
  pairingsPageSource.indexOf("\nfunction Stat"),
);

describe("Pairings page table scrolling", () => {
  it("keeps the page wrapper from adding height outside the table scroll area", () => {
    expect(pairingsPageMainRender).toContain(
      '<div className="m-8 flex flex-col gap-4">',
    );
    expect(pairingsPageMainRender).toContain(
      '<div className="overflow-hidden rounded-lg border border-border">',
    );

    expect(pairingsPageMainRender).not.toContain(
      'className="flex h-full min-h-0 flex-col gap-4 p-8"',
    );
    expect(pairingsPageMainRender).not.toContain(
      'className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border"',
    );
  });

  it("keeps the header fixed while the pairing rows scroll like the Players table", () => {
    expect(pairingsPageSource).toContain(
      'import { ScrollArea } from "@/components/ui/scroll-area";',
    );
    expect(pairingsPageSource).toContain(
      '<ScrollArea className="h-[calc(100vh-396px)]',
    );

    const headerIndex = pairingsPageSource.indexOf("<TableHeader");
    const scrollAreaIndex = pairingsPageSource.indexOf("<ScrollArea");
    const bodyIndex = pairingsPageSource.indexOf("<TableBody>");

    expect(headerIndex).toBeGreaterThan(-1);
    expect(scrollAreaIndex).toBeGreaterThan(headerIndex);
    expect(bodyIndex).toBeGreaterThan(scrollAreaIndex);
  });
});
