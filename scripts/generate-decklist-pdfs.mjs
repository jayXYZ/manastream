#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import {
  buildDecklistUrl,
  isMissingDeckValue,
  mergePdfFiles,
  normalizeStatus,
  outputFilePath,
  splitMainAndSide,
  splitPlayerName,
} from "./decklist-pdf-utils.mjs";

const HELP_TEXT = `Generate DCI decklist PDFs from Convex players JSONL export.

Usage:
  node scripts/generate-decklist-pdfs.mjs --input <players-documents.jsonl> [options]

Required:
  --input <path>               Path to players/documents.jsonl from \`convex export\`

Options:
  --output <dir>               Output folder for PDFs (default: ./tmp/decklist-pdfs)
  --base-url <url>             Decklist site URL (default: https://www.decklist.org/)
  --decksheet <wotc|scg>       Decksheet format (default: wotc)
  --event <name>               Event name shown on form
  --event-date <YYYY-MM-DD>    Event date shown on form
  --event-location <text>      Event location shown on form
  --deck-designer <name>       Value for deck designer field
  --tournament-id <number>     Filter players by spicerackTournamentId
  --statuses <csv>             Allowed statuses (default: ready,manual)
  --exclude-eliminated         Exclude players with registrationStatus=ELIMINATED
  --exclude-registration-statuses <csv>
                               Exclude any registration statuses (case-insensitive)
  --merge-output <path>        Write a merged batch PDF at this path
  --limit <n>                  Max number of players to process
  --headful                    Run browser with UI
  --dry-run                    Print URLs and planned files without downloading
  --help                       Show this help text
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }
  if (!args.input) {
    throw new Error("Missing required argument: --input");
  }

  const inputPath = path.resolve(args.input);
  const outputDir = path.resolve(args.output ?? "./tmp/decklist-pdfs");
  const allowedStatuses = parseStatuses(args.statuses ?? "ready,manual");
  const excludedRegistrationStatuses = parseExcludedRegistrationStatuses(args);
  const tournamentId = toOptionalNumber(args.tournamentId);
  const limit = toOptionalNumber(args.limit);
  const decksheet = args.decksheet === "scg" ? "scg" : "wotc";
  const maxNameLength = decksheet === "scg" ? 10 : 20;

  const players = await readJsonl(inputPath);
  const candidates = players
    .filter((player) => {
      if (tournamentId !== undefined) {
        return Number(player.spicerackTournamentId) === tournamentId;
      }
      return true;
    })
    .filter((player) => allowedStatuses.has(String(player.decklistStatus ?? "")))
    .filter(
      (player) =>
        !excludedRegistrationStatuses.has(normalizeStatus(player.registrationStatus)),
    )
    .filter((player) => !isMissingDeckValue(player.deckList));

  const selectedPlayers = limit ? candidates.slice(0, limit) : candidates;
  if (selectedPlayers.length === 0) {
    console.log("No matching players found. Nothing to do.");
    return;
  }

  await fs.mkdir(outputDir, { recursive: true });
  const mergeOutputPath = args.mergeOutput
    ? path.resolve(args.mergeOutput)
    : undefined;

  console.log(`Found ${selectedPlayers.length} player(s) to process.`);
  console.log(`Output directory: ${outputDir}`);

  if (args.dryRun) {
    selectedPlayers.forEach((player, index) => {
      const deckParts = splitMainAndSide(player.deckList);
      const { firstName, lastName } = splitPlayerName(player.name, maxNameLength);
      const url = buildDecklistUrl({
        baseUrl: args.baseUrl,
        firstName,
        lastName,
        dciNumber: player.dciNumber ?? "",
        event: args.event ?? "",
        eventDate: args.eventDate ?? "",
        eventLocation: args.eventLocation ?? "",
        decksheet,
        deckName: isMissingDeckValue(player.deckName) ? "" : player.deckName,
        deckDesigner: args.deckDesigner ?? "",
        deckmain: deckParts.deckmain,
        deckside: deckParts.deckside,
        disableEditing: true,
      });
      const outputPath = outputFilePath(outputDir, index, player.name);
      console.log(`${outputPath}\n  ${url.toString()}`);
    });

    if (mergeOutputPath) {
      console.log(`Merged output path: ${mergeOutputPath}`);
    }
    return;
  }

  const browser = await chromium.launch({ headless: !args.headful });
  const context = await browser.newContext({ acceptDownloads: true });

  let successCount = 0;
  const failures = [];
  const generatedPdfPaths = [];

  try {
    for (let index = 0; index < selectedPlayers.length; index += 1) {
      const player = selectedPlayers[index];
      const page = await context.newPage();

      try {
        const deckParts = splitMainAndSide(player.deckList);
        const { firstName, lastName } = splitPlayerName(player.name, maxNameLength);
        const url = buildDecklistUrl({
          baseUrl: args.baseUrl,
          firstName,
          lastName,
          dciNumber: player.dciNumber ?? "",
          event: args.event ?? "",
          eventDate: args.eventDate ?? "",
          eventLocation: args.eventLocation ?? "",
          decksheet,
          deckName: isMissingDeckValue(player.deckName) ? "" : player.deckName,
          deckDesigner: args.deckDesigner ?? "",
          deckmain: deckParts.deckmain,
          deckside: deckParts.deckside,
          disableEditing: true,
        });
        const outputPath = outputFilePath(outputDir, index, player.name);

        console.log(
          `[${index + 1}/${selectedPlayers.length}] Generating PDF for ${player.name}`,
        );

        await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForSelector("#download", { timeout: 15000 });
        await page.waitForTimeout(1200);

        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: 20000 }),
          page.click("#download"),
        ]);

        await download.saveAs(outputPath);
        generatedPdfPaths.push(outputPath);
        successCount += 1;
        console.log(`  Saved ${outputPath}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failures.push({ name: String(player.name ?? "unknown"), error: errorMessage });
        console.error(`  Failed for ${player.name}: ${errorMessage}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  if (mergeOutputPath) {
    if (generatedPdfPaths.length === 0) {
      console.log("Skipped merge because no PDFs were generated successfully.");
    } else {
      try {
        const mergedResult = await mergePdfFiles(generatedPdfPaths, mergeOutputPath);
        console.log(
          `Merged ${mergedResult.sourceCount} PDFs into ${mergedResult.outputPath} (${mergedResult.pageCount} page(s))`,
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failures.push({ name: "merge", error: errorMessage });
        console.error(`Failed to merge PDFs: ${errorMessage}`);
      }
    }
  }

  console.log("");
  console.log(`Completed. Success: ${successCount}, Failed: ${failures.length}`);
  if (failures.length > 0) {
    for (const failure of failures) {
      console.log(`  - ${failure.name}: ${failure.error}`);
    }
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const parsed = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--") {
      continue;
    }

    if (
      token === "--headful" ||
      token === "--dry-run" ||
      token === "--help" ||
      token === "--exclude-eliminated"
    ) {
      const key = token.replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      parsed[key] = true;
      continue;
    }

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }

    const key = token.replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    parsed[key] = next;
    i += 1;
  }

  return parsed;
}

function parseStatuses(csv) {
  const values = String(csv)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(values);
}

function parseExcludedRegistrationStatuses(args) {
  const excluded = new Set();

  if (args.excludeEliminated) {
    excluded.add("ELIMINATED");
  }

  if (args.excludeRegistrationStatuses) {
    const values = String(args.excludeRegistrationStatuses)
      .split(",")
      .map((value) => normalizeStatus(value))
      .filter(Boolean);
    for (const value of values) {
      excluded.add(value);
    }
  }

  return excluded;
}

function toOptionalNumber(value) {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected number, got: ${value}`);
  }
  return parsed;
}

async function readJsonl(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON on line ${index + 1}: ${String(error)}`);
    }
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
