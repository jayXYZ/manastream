import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  buildDecklistUrl,
  mergePdfFiles,
  normalizeStatus,
  sanitizeFilename,
  splitMainAndSide,
  splitPlayerName,
} from "./decklist-pdf-utils.mjs";

describe("splitMainAndSide", () => {
  it("separates SIDEBOARD section", () => {
    const input = `4 Brainstorm
4 Ponder

SIDEBOARD:
2 Hydroblast
3 Pyroblast`;

    expect(splitMainAndSide(input)).toEqual({
      deckmain: "4 Brainstorm\n4 Ponder",
      deckside: "2 Hydroblast\n3 Pyroblast",
    });
  });

  it("supports SB-prefixed lines", () => {
    const input = `4 Brainstorm
SB: 2 Hydroblast
SB: 3 Pyroblast`;

    expect(splitMainAndSide(input)).toEqual({
      deckmain: "4 Brainstorm",
      deckside: "2 Hydroblast\n3 Pyroblast",
    });
  });
});

describe("splitPlayerName", () => {
  it("splits first and last names", () => {
    expect(splitPlayerName("April King")).toEqual({
      firstName: "April",
      lastName: "King",
    });
  });

  it("handles single-word names", () => {
    expect(splitPlayerName("Plato")).toEqual({
      firstName: "Plato",
      lastName: "",
    });
  });
});

describe("sanitizeFilename", () => {
  it("replaces unsafe filename characters", () => {
    expect(sanitizeFilename('A/B:C*"D"')).toBe("A_B_C__D_");
  });
});

describe("buildDecklistUrl", () => {
  it("writes expected query params", () => {
    const url = buildDecklistUrl({
      firstName: "April",
      lastName: "King",
      deckmain: "4 Brainstorm",
      deckside: "2 Hydroblast",
      disableEditing: true,
    });

    expect(url.searchParams.get("firstname")).toBe("April");
    expect(url.searchParams.get("lastname")).toBe("King");
    expect(url.searchParams.get("deckmain")).toBe("4 Brainstorm");
    expect(url.searchParams.get("deckside")).toBe("2 Hydroblast");
    expect(url.searchParams.get("disableediting")).toBe("true");
  });
});

describe("normalizeStatus", () => {
  it("normalizes case and surrounding whitespace", () => {
    expect(normalizeStatus("  eliminated ")).toBe("ELIMINATED");
  });
});

describe("mergePdfFiles", () => {
  it("merges multiple PDFs into one output file", async () => {
    const tempDir = path.join(os.tmpdir(), `decklist-merge-test-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });

    const firstPath = path.join(tempDir, "first.pdf");
    const secondPath = path.join(tempDir, "second.pdf");
    const mergedPath = path.join(tempDir, "merged.pdf");

    const firstPdf = await PDFDocument.create();
    firstPdf.addPage([200, 200]);
    await fs.writeFile(firstPath, await firstPdf.save());

    const secondPdf = await PDFDocument.create();
    secondPdf.addPage([300, 300]);
    await fs.writeFile(secondPath, await secondPdf.save());

    await mergePdfFiles([firstPath, secondPath], mergedPath);

    const mergedBytes = await fs.readFile(mergedPath);
    const mergedPdf = await PDFDocument.load(mergedBytes);
    expect(mergedPdf.getPageCount()).toBe(2);
  });
});
