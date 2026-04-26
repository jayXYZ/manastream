import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pairingsPageSource = readFileSync(
  "app/dashboard/pairings/page.tsx",
  "utf8",
);

describe("Pairings page table scrolling", () => {
  it("keeps the header fixed while the pairing rows scroll like the Players table", () => {
    expect(pairingsPageSource).toContain(
      'import { ScrollArea } from "@/components/ui/scroll-area";',
    );
    expect(pairingsPageSource).toContain(
      '<ScrollArea className="h-[calc(100vh-252px)]',
    );

    const headerIndex = pairingsPageSource.indexOf("<TableHeader");
    const scrollAreaIndex = pairingsPageSource.indexOf("<ScrollArea");
    const bodyIndex = pairingsPageSource.indexOf("<TableBody>");

    expect(headerIndex).toBeGreaterThan(-1);
    expect(scrollAreaIndex).toBeGreaterThan(headerIndex);
    expect(bodyIndex).toBeGreaterThan(scrollAreaIndex);
  });
});
