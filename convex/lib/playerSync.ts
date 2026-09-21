import { Id } from "../_generated/dataModel";
import { MeleePlayerListEntry } from "../types/melee";
import { parseMeleeRegistrationStatus } from "../models/melee";
import { buildDecklistFromMeleeRecords } from "./melee/decklist";
import { isMissingDecklistData } from "./playerData";

export type DecklistStatus =
  | "missing"
  | "pending"
  | "ready"
  | "fetch_failed"
  | "manual";

/**
 * "fill_missing": add players not yet cached and fill decklists for players
 * cached without one. Used by the polling loop on each round change.
 *
 * "full": additionally re-download every player's decklist and name so that
 * changes made in Melee after the player was first cached are picked up.
 * Used by the "Refresh players" button.
 *
 * Players edited by hand in the dashboard (decklistStatus "manual") are never
 * touched in either mode.
 */
export type PlayerSyncMode = "fill_missing" | "full";

export type CachedPlayerForSync = {
  playerId: Id<"players">;
  externalPlayerId: number;
  name: string;
  externalDecklistId?: string;
  decklistStatus?: DecklistStatus;
  deckName: string;
  deckList: string;
};

export type NewPlayerArgs = {
  externalTournamentId: number;
  name: string;
  externalPlayerId: number;
  registrationStatus?: string;
  externalDecklistId?: string;
  decklistStatus: "ready" | "missing";
  deckName: string;
  deckList: string;
};

export type DecklistUpdate = {
  playerId: Id<"players">;
  deckName: string;
  deckList: string;
  externalDecklistId?: string;
  decklistStatus: "ready" | "fetch_failed";
};

export type DecklistFetchRequest = {
  playerId: Id<"players">;
  externalDecklistId: string;
};

export type PlayerSyncPlan = {
  newPlayers: NewPlayerArgs[];
  /** Decklist updates that can be applied from the player-list payload. */
  decklistUpdates: DecklistUpdate[];
  /** Decklists that must be fetched individually by id. */
  decklistsToFetch: DecklistFetchRequest[];
  nameUpdates: { playerId: Id<"players">; name: string }[];
};

export type PlayerSyncSummary = {
  playerCount: number;
  created: number;
  decklistsUpdated: number;
  decklistFetchesFailed: number;
  namesUpdated: number;
};

export function playerEntryName(entry: MeleePlayerListEntry): string {
  return entry.DisplayName || entry.PlayerName || entry.Username;
}

/**
 * Build a createPlayers row from a player-list entry, using the embedded
 * decklist (with card records) when the player has submitted one.
 */
export function buildNewPlayerArgs(
  externalTournamentId: number,
  entry: MeleePlayerListEntry,
): NewPlayerArgs {
  const embedded = entry.Decklists[0];
  if (embedded && Array.isArray(embedded.Records)) {
    const decklist = buildDecklistFromMeleeRecords({
      records: embedded.Records,
      formatName: embedded.FormatName,
      decklistName: embedded.DecklistName || embedded.Name || undefined,
    });
    return {
      externalTournamentId,
      name: playerEntryName(entry),
      externalPlayerId: entry.ID,
      registrationStatus: parseMeleeRegistrationStatus(entry),
      externalDecklistId: embedded.Guid,
      decklistStatus: "ready",
      deckName: decklist.deckname,
      deckList: decklist.decklist,
    };
  }
  return {
    externalTournamentId,
    name: playerEntryName(entry),
    externalPlayerId: entry.ID,
    registrationStatus: parseMeleeRegistrationStatus(entry),
    decklistStatus: "missing",
    deckName: "MISSING_DECKLIST",
    deckList: "MISSING_DECKLIST",
  };
}

/**
 * Whether a decklist pulled from Melee should overwrite what is cached.
 * Never overwrites hand-edited decklists, never replaces a usable decklist
 * with a failed fetch, and skips writes that would not change anything (each
 * write resets the resolved deck cards and re-queues Scryfall resolution).
 */
export function shouldApplyDecklistUpdate(
  cached: CachedPlayerForSync,
  update: DecklistUpdate,
): boolean {
  if (cached.decklistStatus === "manual") {
    return false;
  }
  if (update.decklistStatus === "fetch_failed") {
    return (
      isMissingDecklistData(cached) &&
      !(
        cached.decklistStatus === "fetch_failed" &&
        cached.externalDecklistId === update.externalDecklistId
      )
    );
  }
  return (
    cached.decklistStatus !== "ready" ||
    cached.deckName !== update.deckName ||
    cached.deckList !== update.deckList ||
    cached.externalDecklistId !== update.externalDecklistId
  );
}

/**
 * Reconcile the Melee player list against the cached players for the
 * tournament. Pure: network fetches (decklistsToFetch) and writes are left
 * to the caller.
 */
export function planPlayerSync(args: {
  externalTournamentId: number;
  entries: MeleePlayerListEntry[];
  cached: CachedPlayerForSync[];
  mode: PlayerSyncMode;
}): PlayerSyncPlan {
  const plan: PlayerSyncPlan = {
    newPlayers: [],
    decklistUpdates: [],
    decklistsToFetch: [],
    nameUpdates: [],
  };
  const cachedByExternalPlayerId = new Map(
    args.cached.map((player) => [player.externalPlayerId, player]),
  );

  for (const entry of args.entries) {
    const cached = cachedByExternalPlayerId.get(entry.ID);
    if (!cached) {
      plan.newPlayers.push(buildNewPlayerArgs(args.externalTournamentId, entry));
      continue;
    }
    if (cached.decklistStatus === "manual") {
      continue;
    }

    if (args.mode === "full") {
      const name = playerEntryName(entry);
      if (name !== cached.name) {
        plan.nameUpdates.push({ playerId: cached.playerId, name });
      }
    } else if (!isMissingDecklistData(cached)) {
      continue;
    }

    const embedded = entry.Decklists[0];
    if (embedded && Array.isArray(embedded.Records)) {
      const decklist = buildDecklistFromMeleeRecords({
        records: embedded.Records,
        formatName: embedded.FormatName,
        decklistName: embedded.DecklistName || embedded.Name || undefined,
      });
      const update: DecklistUpdate = {
        playerId: cached.playerId,
        deckName: decklist.deckname,
        deckList: decklist.decklist,
        externalDecklistId: embedded.Guid,
        decklistStatus: "ready",
      };
      if (shouldApplyDecklistUpdate(cached, update)) {
        plan.decklistUpdates.push(update);
      }
      continue;
    }

    // The list payload names a decklist without its cards: fetch it by id.
    // In full mode this re-downloads even a cached decklist, since an edited
    // decklist keeps its id.
    const externalDecklistId = embedded?.Guid ?? cached.externalDecklistId;
    if (externalDecklistId) {
      plan.decklistsToFetch.push({
        playerId: cached.playerId,
        externalDecklistId,
      });
    }
  }
  return plan;
}

/**
 * Keep only the fetched decklists that should overwrite the cache.
 */
export function selectFetchedDecklistUpdates(
  fetched: DecklistUpdate[],
  cached: CachedPlayerForSync[],
): DecklistUpdate[] {
  const cachedByPlayerId = new Map(
    cached.map((player) => [player.playerId, player]),
  );
  return fetched.filter((update) => {
    const cachedPlayer = cachedByPlayerId.get(update.playerId);
    return cachedPlayer === undefined
      ? true
      : shouldApplyDecklistUpdate(cachedPlayer, update);
  });
}

export function summarizePlayerSync(args: {
  playerCount: number;
  plan: PlayerSyncPlan;
  appliedDecklistUpdates: DecklistUpdate[];
}): PlayerSyncSummary {
  let decklistsUpdated = 0;
  let decklistFetchesFailed = 0;
  for (const update of args.appliedDecklistUpdates) {
    if (update.decklistStatus === "fetch_failed") {
      decklistFetchesFailed += 1;
    } else {
      decklistsUpdated += 1;
    }
  }
  return {
    playerCount: args.playerCount,
    created: args.plan.newPlayers.length,
    decklistsUpdated,
    decklistFetchesFailed,
    namesUpdated: args.plan.nameUpdates.length,
  };
}

export function formatPlayerSyncSummary(summary: PlayerSyncSummary): string {
  const parts = [
    `${summary.created} added`,
    `${summary.decklistsUpdated} decklist${summary.decklistsUpdated === 1 ? "" : "s"} updated`,
  ];
  if (summary.namesUpdated > 0) {
    parts.push(
      `${summary.namesUpdated} name${summary.namesUpdated === 1 ? "" : "s"} updated`,
    );
  }
  if (summary.decklistFetchesFailed > 0) {
    parts.push(
      `${summary.decklistFetchesFailed} decklist fetch${summary.decklistFetchesFailed === 1 ? "" : "es"} failed`,
    );
  }
  return `Refreshed ${summary.playerCount} player${summary.playerCount === 1 ? "" : "s"} from Melee: ${parts.join(", ")}.`;
}

export type PlayerRefreshState = {
  status: "running" | "success" | "error";
  startedAt: number;
  finishedAt?: number;
  message?: string;
};

export type PlayerRefreshDecision =
  | "scheduled"
  | "in_progress"
  | "no_tournament"
  | "no_credentials";

/**
 * Whether a "refresh players" request may start now. Unlike "refresh now"
 * for auto sync, this does not require an active polling session: it works
 * in manual mode too.
 */
export function playerRefreshDecision(args: {
  externalTournamentId?: number;
  hasCredentials: boolean;
  refresh?: PlayerRefreshState;
}): PlayerRefreshDecision {
  if (
    args.externalTournamentId === undefined ||
    args.externalTournamentId === -1
  ) {
    return "no_tournament";
  }
  if (!args.hasCredentials) {
    return "no_credentials";
  }
  if (args.refresh?.status === "running") {
    return "in_progress";
  }
  return "scheduled";
}
