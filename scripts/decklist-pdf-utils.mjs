import path from "node:path";

const MISSING_DECK_VALUES = new Set(["", "MISSING_DECKLIST", "PENDING", "Unknown"]);

export function splitMainAndSide(rawDeckList) {
  const normalized = String(rawDeckList ?? "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const main = [];
  const side = [];

  let currentList = main;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (/^sideboard\s*:?\s*$/i.test(trimmed)) {
      currentList = side;
      continue;
    }

    const sideboardLine = trimmed.match(/^sb:\s*(.+)$/i);
    if (sideboardLine) {
      currentList = side;
      const sideValue = sideboardLine[1]?.trim() ?? "";
      if (sideValue) {
        side.push(sideValue);
      }
      continue;
    }

    currentList.push(trimmed);
  }

  return {
    deckmain: main.join("\n"),
    deckside: side.join("\n"),
  };
}

export function splitPlayerName(fullName, maxNameLength = 20) {
  const cleaned = String(fullName ?? "").trim();
  if (!cleaned) {
    return { firstName: "", lastName: "" };
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: truncate(parts[0], maxNameLength),
      lastName: "",
    };
  }

  return {
    firstName: truncate(parts[0], maxNameLength),
    lastName: truncate(parts.slice(1).join(" "), maxNameLength),
  };
}

export function sanitizeFilename(input) {
  return String(input ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .slice(0, 120);
}

export function isMissingDeckValue(value) {
  return MISSING_DECK_VALUES.has(String(value ?? ""));
}

export function buildDecklistUrl({
  baseUrl = "https://www.decklist.org/",
  firstName = "",
  lastName = "",
  dciNumber = "",
  event = "",
  eventDate = "",
  eventLocation = "",
  decksheet = "wotc",
  deckName = "",
  deckDesigner = "",
  deckmain = "",
  deckside = "",
  disableEditing = true,
}) {
  const url = new URL(baseUrl);
  const params = url.searchParams;

  setParam(params, "firstname", firstName);
  setParam(params, "lastname", lastName);
  setParam(params, "dcinumber", dciNumber);
  setParam(params, "event", event);
  setParam(params, "eventdate", eventDate);
  setParam(params, "eventlocation", eventLocation);
  setParam(params, "decksheet", decksheet);
  setParam(params, "deckname", deckName);
  setParam(params, "deckdesigner", deckDesigner);
  setParam(params, "deckmain", deckmain);
  setParam(params, "deckside", deckside);

  if (disableEditing) {
    params.set("disableediting", "true");
  }

  return url;
}

export function outputFilePath(outputDir, index, playerName) {
  const safeName = sanitizeFilename(playerName) || `player-${index + 1}`;
  const prefix = String(index + 1).padStart(3, "0");
  return path.join(outputDir, `${prefix}-${safeName}.pdf`);
}

function truncate(value, maxLength) {
  if (!value) {
    return "";
  }
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
}

function setParam(params, key, value) {
  const parsed = String(value ?? "");
  if (!parsed) {
    return;
  }
  params.set(key, parsed);
}
