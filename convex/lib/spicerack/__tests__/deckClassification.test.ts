import { describe, expect, it } from "vitest";
import {
  classifyDecknameForFormat,
  determineArchetype,
  parseMaindeckFromPlaintext,
  type ArchetypeDefinitions,
} from "../deckClassification";

const SAMPLE_ARCHETYPES: ArchetypeDefinitions = {
  deadguy: {
    deckname: "Deadguy Ale",
    required: [
      "Gerrard's Verdict",
      "Hypnotic Specter",
      "Swords to Plowshares",
      "Dark Ritual",
    ],
    conflicts: ["Eternal Dragon"],
  },
  bw_control: {
    deckname: "Black/White Control",
    required: [
      "Swords to Plowshares",
      "Vindicate",
      "Gerrard's Verdict",
      "Eternal Dragon",
    ],
    conflicts: ["Hypnotic Specter", "Dark Ritual"],
  },
};

describe("parseMaindeckFromPlaintext", () => {
  it("parses maindeck cards and ignores sideboard sections", () => {
    const parsed = parseMaindeckFromPlaintext(`
4 Dark Ritual
4 Swords to Plowshares
1 Gerrard's Verdict
2 Hypnotic Specter

Sideboard
3 Duress
SB: 2 Chainer's Edict
`);

    expect(parsed["Dark Ritual"]).toBe(4);
    expect(parsed["Swords to Plowshares"]).toBe(4);
    expect(parsed["Duress"]).toBeUndefined();
    expect(parsed["Chainer's Edict"]).toBeUndefined();
  });
});

describe("determineArchetype", () => {
  it("preserves existing archetype when maindeck is empty and existing is known", () => {
    const result = determineArchetype({}, SAMPLE_ARCHETYPES, "Deadguy Ale");
    expect(result).toBe("Deadguy Ale");
  });

  it('returns "Unknown" when no archetype matches', () => {
    const result = determineArchetype(
      { "Lightning Bolt": 4 },
      SAMPLE_ARCHETYPES,
      "Some Existing Archetype",
    );
    expect(result).toBe("Unknown");
  });

  it("matches archetype only when required cards exist and conflicts do not", () => {
    const result = determineArchetype(
      {
        "Swords to Plowshares": 4,
        Vindicate: 3,
        "Gerrard's Verdict": 4,
        "Eternal Dragon": 3,
      },
      SAMPLE_ARCHETYPES,
      "Unknown",
    );
    expect(result).toBe("Black/White Control");
  });
});

describe("classifyDecknameForFormat", () => {
  it("uses classifier for PREMODERN", () => {
    const result = classifyDecknameForFormat({
      eventFormat: "PREMODERN",
      existingArchetype: "Unknown",
      plaintextList: `
4 Dark Ritual
4 Swords to Plowshares
3 Gerrard's Verdict
3 Hypnotic Specter
`,
      archetypes: SAMPLE_ARCHETYPES,
    });

    expect(result).toBe("Deadguy Ale");
  });

  it("keeps existing archetype for non-PREMODERN formats", () => {
    const result = classifyDecknameForFormat({
      eventFormat: "LEGACY",
      existingArchetype: "Spicerack Legacy Name",
      plaintextList: `
4 Dark Ritual
4 Swords to Plowshares
3 Gerrard's Verdict
3 Hypnotic Specter
`,
      archetypes: SAMPLE_ARCHETYPES,
    });

    expect(result).toBe("Spicerack Legacy Name");
  });
});
