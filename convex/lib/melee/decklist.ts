import { MeleeDecklistRecord } from "../../types/melee";
import { classifyDecknameForFormat } from "../deckClassification/deckClassification";

export interface MeleeDecklist {
  deckname: string;
  decklist: string;
  /** Melee's LastUpdated (ISO 8601), when the response carried one. */
  lastUpdated?: string;
}

const MAINDECK_CATEGORY = 0;

/**
 * Convert Melee's structured card records into the plaintext decklist shape
 * the rest of the pipeline stores and parses.
 *
 * The "SIDEBOARD:" separator line must stay compatible with both
 * parseDecklist in lib/deckCards.ts (splits on /\nSIDEBOARD:\n/i) and
 * SIDEBOARD_HEADER_PATTERN in the deck classifier.
 */
export function meleeRecordsToPlaintext(
  records: MeleeDecklistRecord[],
): string {
  const maindeck = records.filter((record) => record.c === MAINDECK_CATEGORY);
  const sideboard = records.filter((record) => record.c !== MAINDECK_CATEGORY);

  const lines = maindeck.map((record) => `${record.q} ${record.n}`);
  if (sideboard.length > 0) {
    lines.push("SIDEBOARD:");
    lines.push(...sideboard.map((record) => `${record.q} ${record.n}`));
  }
  return lines.join("\n");
}

/**
 * Build the internal { deckname, decklist } shape from Melee decklist data.
 * Melee's own decklist name is kept unless the format is one the card-based
 * classifier handles (PREMODERN/OTHER), matching the Spicerack behavior.
 */
export function buildDecklistFromMeleeRecords(args: {
  records: MeleeDecklistRecord[];
  formatName?: string;
  decklistName?: string;
}): MeleeDecklist {
  const plaintextList = meleeRecordsToPlaintext(args.records);
  const deckname = classifyDecknameForFormat({
    eventFormat: args.formatName,
    existingArchetype: args.decklistName,
    plaintextList,
  });
  return {
    deckname,
    decklist: plaintextList,
  };
}
