export const DEFAULT_MATCH = {
  player1: undefined,
  player2: undefined,
  player1Life: 20,
  player2Life: 20,
  player1GamesWon: 0,
  player2GamesWon: 0,
  player1DisplayName: undefined,
  player2DisplayName: undefined,
  player1DisplayDeck: undefined,
  player2DisplayDeck: undefined,
  player1TournamentRecord: undefined,
  player2TournamentRecord: undefined,
  player1Lc26BackgroundColor: undefined,
  player2Lc26BackgroundColor: undefined,
};

export const LIFEAPP_TIMEOUT = 1000 * 60 * 2; // 2 min

export const TOURNAMENT_TIMEOUT = 1000 * 60 * 60 * 24; // 24 hours

export const POLLING_INTERVAL = 1000 * 60 * 2; // 2 minutes

// Minimum gap between a finished poll cycle and a manually requested one.
export const MANUAL_POLL_COOLDOWN = 1000 * 15; // 15 seconds

// A "Refresh players" run still marked running after this long is treated as
// dead. Convex actions time out after 10 minutes; the extra minute ensures
// the run can no longer be executing.
export const PLAYER_REFRESH_TIMEOUT = 1000 * 60 * 11; // 11 minutes

export type EliminationRoundName = "Quarterfinals" | "Semifinals" | "Finals";

// Normalize both incoming provider names and names already stored in the
// database. Keep this exact: labels such as "Grand Finals" or "Round 8"
// do not identify a supported top-eight stage unambiguously.
export function getEliminationRoundName(
  roundName: string | undefined,
): EliminationRoundName | undefined {
  switch (roundName?.toLowerCase().replace(/[\s\-\u2010-\u2015]+/g, "")) {
    case "quarterfinal":
    case "quarterfinals":
      return "Quarterfinals";
    case "semifinal":
    case "semifinals":
      return "Semifinals";
    case "final":
    case "finals":
      return "Finals";
    default:
      return undefined;
  }
}

export function isEliminationRoundName(roundName: string | undefined): boolean {
  return getEliminationRoundName(roundName) !== undefined;
}

// How many matches a top-8 cut's rounds hold, so a partly captured round
// can be told from a complete one.
export const EXPECTED_ELIMINATION_MATCHES: Record<
  EliminationRoundName,
  number
> = {
  Quarterfinals: 4,
  Semifinals: 2,
  Finals: 1,
};
