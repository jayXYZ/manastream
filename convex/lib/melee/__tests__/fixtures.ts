import {
  MeleeMatch,
  MeleeMatchCompetitor,
  MeleeMatchDecklist,
  MeleePaginatedResponse,
  MeleePlayer,
  MeleeTeam,
  MeleeTournamentOverviewResponse,
  MeleeTournamentPhase,
  MeleeTournamentRound,
} from "../../../types/melee";

export const PREMODERN_FORMAT_ID = "920ec64f-a02f-4176-a3d0-0c46eef003cb";
export const TOURNAMENT_ID = 432771;
export const SWISS_PHASE_ID = 436855;
export const TOP8_PHASE_ID = 436856;

export function makePlayer(
  id: number,
  name: string,
  teamId: number,
): MeleePlayer {
  return {
    TeamId: teamId,
    ID: id,
    ScreenName: "N/A",
    MetadataDictionary: {},
    ProfileImageVersion: 0,
    DisplayName: name,
    DisplayNameLastFirst: name,
    Username: name.replace(/\s+/g, ""),
    ArenaScreenName: `${name}#12345`,
    DciNumber: null,
    DiscordUsername: null,
    FirstName: name.split(" ")[0],
    GemPlayerId: null,
    LastName: name.split(" ")[1] ?? "",
    MtgoScreenName: null,
    Name: name,
    NameLastFirst: name,
    AsmoConnectId: null,
    LanguageDescription: "Auto (English)",
    PronounsDescription: null,
  };
}

export function makeTeam(players: MeleePlayer[], teamId: number): MeleeTeam {
  return {
    Players: players,
    ID: teamId,
    Name: null,
    StatusDescription: "Active",
    IsActive: true,
  };
}

export function makeCompetitor(args: {
  playerId: number;
  name: string;
  decklist?: Pick<MeleeMatchDecklist, "DecklistId" | "DecklistName">;
}): MeleeMatchCompetitor {
  const teamId = args.playerId + 10000;
  return {
    Team: makeTeam([makePlayer(args.playerId, args.name, teamId)], teamId),
    ID: args.playerId + 20000,
    CheckedIn: null,
    ResultConfirmed: null,
    SortOrder: 1,
    GameByes: null,
    GameWins: 0,
    TeamId: teamId,
    GameWinsAndGameByes: 0,
    Decklists: args.decklist
      ? [
          {
            DecklistId: args.decklist.DecklistId,
            PlayerId: args.playerId,
            DecklistName: args.decklist.DecklistName,
            Format: "Premodern",
            FormatId: PREMODERN_FORMAT_ID,
          },
        ]
      : [],
  };
}

export function makeMatch(args: {
  guid: string;
  roundId: number;
  roundNumber: number;
  phaseId?: number;
  tableNumber?: number | null;
  featureMatch?: boolean;
  hasResult?: boolean;
  competitors: MeleeMatchCompetitor[];
}): MeleeMatch {
  return {
    Competitors: args.competitors,
    ByeReason: null,
    LossReason: null,
    RoundName: null,
    DateCreated: "2026-05-31T21:39:34Z",
    Type: 0,
    FeatureMatch: args.featureMatch ?? false,
    HasResult: args.hasResult ?? false,
    TimeExtended: false,
    MatchesPublished: true,
    RoundNumber: args.roundNumber,
    GameDraws: null,
    PodNumber: null,
    PhaseSortOrder: 1,
    SortOrder: null,
    TableNumber: args.tableNumber === undefined ? 1 : args.tableNumber,
    TimeExtensionMinutes: null,
    PhaseId: args.phaseId ?? SWISS_PHASE_ID,
    RoundId: args.roundId,
    TournamentId: TOURNAMENT_ID,
    FormatId: PREMODERN_FORMAT_ID,
    Format: "Premodern",
    Guid: args.guid,
    TableLocation: null,
    TableSection: null,
    StaffAssigned: false,
    StaffWatchers: [],
    ByeReasonDescription: null,
    LossReasonDescription: null,
    ResultString: "Not reported",
    AdminResultString: "Not reported",
    RoundDescription: `Round ${args.roundNumber}`,
    TableNumberDescription:
      args.tableNumber === null ? null : `Table ${args.tableNumber ?? 1}`,
    TypeDescription: "Best of Three",
    FormatDescription: "Premodern",
    AcknowledgedDecklists: false,
    AcknowledgedPlayers: false,
    GhostMatch: false,
    MetaValueForName: "-",
  };
}

export function makeRound(
  id: number,
  name: string,
  sortOrder: number,
): MeleeTournamentRound {
  return { ID: id, Guid: `round-guid-${id}`, Name: name, SortOrder: sortOrder };
}

export function makePhase(args: {
  id: number;
  name: string;
  sortOrder: number;
  rounds: MeleeTournamentRound[];
}): MeleeTournamentPhase {
  return {
    ID: args.id,
    Guid: `phase-guid-${args.id}`,
    Name: args.name,
    FormatId: PREMODERN_FORMAT_ID,
    Format: "Premodern",
    SortOrder: args.sortOrder,
    Rounds: args.rounds,
  };
}

export function makeOverview(args: {
  phases: MeleeTournamentPhase[];
  statusDescription?: string;
  currentPhaseId?: number;
}): MeleeTournamentOverviewResponse {
  return {
    ID: TOURNAMENT_ID,
    Guid: "tournament-guid",
    Name: "test tournament",
    CurrentPhaseId: args.currentPhaseId ?? SWISS_PHASE_ID,
    Formats: ["Premodern"],
    OrganizationId: 18546,
    OrganizationName: "Duress Crew",
    SearchTags: [],
    BrandImageSource: "",
    TimerState: 5,
    TimerStateDescription: "Until the Round Ends",
    TimerEnd: "2026-05-31T22:39:34Z",
    Game: "MagicTheGathering",
    TournamentType: 4,
    TournamentTypeDescription: "Tabletop",
    Status: 2,
    StatusDescription: args.statusDescription ?? "In Progress",
    LastPairDateTime: "2026-05-31T21:39:34Z",
    Phases: args.phases,
  };
}

/**
 * Overview matching the sampled test tournament: 3 swiss rounds plus a
 * Top 8 phase whose rounds have generic names (exercises fallback naming).
 */
export function makeStandardOverview(): MeleeTournamentOverviewResponse {
  return makeOverview({
    phases: [
      makePhase({
        id: SWISS_PHASE_ID,
        name: "Swiss Rounds",
        sortOrder: 1,
        rounds: [
          makeRound(1529972, "Round 1", 1),
          makeRound(1529973, "Round 2", 2),
          makeRound(1529974, "Round 3", 3),
        ],
      }),
      makePhase({
        id: TOP8_PHASE_ID,
        name: "Top 8",
        sortOrder: 2,
        rounds: [
          makeRound(1529975, "Round 4", 1),
          makeRound(1529976, "Round 5", 2),
          makeRound(1529977, "Round 6", 3),
        ],
      }),
    ],
  });
}

export function paginated<T>(
  content: T[],
  options?: { page?: number; hasMore?: boolean; recordsTotal?: number },
): MeleePaginatedResponse<T> {
  return {
    Content: content,
    HasMore: options?.hasMore ?? false,
    IgnoreCache: false,
    Page: options?.page ?? 1,
    PageSize: content.length,
    RecordsFiltered: content.length,
    RecordsTotal: options?.recordsTotal ?? content.length,
    StatusCode: 200,
  };
}
