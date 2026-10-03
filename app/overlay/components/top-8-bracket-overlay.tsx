import type { StandingsOverlay as StandingsOverlayType } from "@/convex/types";
import type { BraunDarkPalette } from "@/lib/braun-dark-palettes";
import { Mic } from "lucide-react";

const FONT = "'Instrument Sans', 'Helvetica Neue', sans-serif";
const BOTTOM_BAR = 48;
const SIDE_MARGIN = 140;
const SEED_GUTTER = 48;
const SEED_GUTTER_GAP = 20;
const SCORE_WIDTH = 72;
const SLOT_HEIGHT = 78;
const MATCH_HEIGHT = SLOT_HEIGHT * 2 + 2;
const QUARTERFINAL_GAP = 34;
const QUARTERFINAL_STEP = MATCH_HEIGHT + QUARTERFINAL_GAP;
const BRACKET_HEIGHT = MATCH_HEIGHT * 4 + QUARTERFINAL_GAP * 3;
const SEMIFINAL_TOP = QUARTERFINAL_STEP / 2;
const SEMIFINAL_GAP = QUARTERFINAL_STEP * 2 - MATCH_HEIGHT;
const FINAL_TOP = (BRACKET_HEIGHT - MATCH_HEIGHT) / 2;
const TOP_8_PAIRINGS = [
  [1, 8],
  [4, 5],
  [2, 7],
  [3, 6],
] as const;

type StandingRow = NonNullable<
  StandingsOverlayType["standingsDataWithPlayers"]
>[number];

export type Top8BracketStanding = Pick<
  StandingRow,
  "name" | "rank" | "seed"
> & {
  playerData?: Pick<NonNullable<StandingRow["playerData"]>, "deckName">;
};

export type Top8BracketMatches = NonNullable<
  StandingsOverlayType["bracketMatches"]
>;

type BracketMatch = Top8BracketMatches["quarterfinals"][number];

type BracketPlayer = {
  seed: number;
  name: string;
  deckName: string;
};

// Seed order of the quarterfinal matches from top to bottom, so the 1 and 2
// seeds sit in opposite halves.
const QUARTERFINAL_ORDER = [1, 4, 2, 3];

export default function Top8BracketOverlay({
  commentators,
  standings,
  matches,
  theme,
}: {
  commentators: string;
  standings: Top8BracketStanding[];
  matches?: Top8BracketMatches;
  theme: BraunDarkPalette;
}) {
  const playersBySeed = buildPlayersBySeed(standings);
  const layout = buildBracketLayout(matches);
  const champion =
    layout.championSeed !== undefined
      ? playersBySeed.get(layout.championSeed)
      : undefined;

  return (
    <div
      className="w-[1920px] h-[1080px] relative overflow-hidden"
      style={{ background: theme.surface, color: theme.text, fontFamily: FONT }}
    >
      <div
        className="absolute left-0 right-0"
        style={{
          top: 0,
          bottom: BOTTOM_BAR,
          paddingLeft: SIDE_MARGIN,
          paddingRight: SIDE_MARGIN,
          paddingTop: 76,
          paddingBottom: 46,
        }}
      >
        <div
          className="grid h-full"
          style={{
            gridTemplateColumns: `${SEED_GUTTER + SEED_GUTTER_GAP + 620}px 360px 360px`,
            columnGap: 70,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BracketColumn
            title="Quarterfinals"
            titleInset={SEED_GUTTER + SEED_GUTTER_GAP}
            theme={theme}
          >
            <div className="grid" style={{ gap: QUARTERFINAL_GAP }}>
              {layout.quarterfinals.map((match, index) => (
                <div
                  key={`qf-${index}`}
                  className="grid"
                  style={{
                    gridTemplateColumns: `${SEED_GUTTER}px minmax(0, 1fr)`,
                    columnGap: SEED_GUTTER_GAP,
                  }}
                >
                  <SeedGutter
                    seeds={match.slots.map((slot) => slot.seed)}
                    playersBySeed={playersBySeed}
                    theme={theme}
                  />
                  <MatchPair theme={theme}>
                    {match.slots.map((slot, slotIndex) => (
                      <PlayerSlot
                        key={slotIndex}
                        player={
                          slot.seed !== undefined
                            ? playersBySeed.get(slot.seed)
                            : undefined
                        }
                        seed={slot.seed}
                        placeholder={slot.placeholder}
                        eliminated={slot.eliminated}
                        gameWins={slot.gameWins}
                        theme={theme}
                      />
                    ))}
                  </MatchPair>
                </div>
              ))}
            </div>
          </BracketColumn>

          <BracketColumn title="Semifinals" theme={theme}>
            <div
              className="absolute inset-x-0 grid"
              style={{ top: SEMIFINAL_TOP, gap: SEMIFINAL_GAP }}
            >
              {layout.semifinals.map((match, index) => (
                <MatchPair key={`sf-${index}`} theme={theme}>
                  {match.slots.map((slot, slotIndex) => (
                    <PlayerSlot
                      key={slotIndex}
                      player={
                        slot.seed !== undefined
                          ? playersBySeed.get(slot.seed)
                          : undefined
                      }
                      seed={slot.seed}
                      placeholder={slot.placeholder}
                      eliminated={slot.eliminated}
                      gameWins={slot.gameWins}
                      theme={theme}
                    />
                  ))}
                </MatchPair>
              ))}
            </div>
          </BracketColumn>

          <BracketColumn title="Finals" theme={theme}>
            <div
              className="absolute inset-x-0 grid gap-[60px]"
              style={{ top: FINAL_TOP }}
            >
              {layout.finals.map((match, index) => (
                <MatchPair key={`f-${index}`} theme={theme}>
                  {match.slots.map((slot, slotIndex) => (
                    <PlayerSlot
                      key={slotIndex}
                      player={
                        slot.seed !== undefined
                          ? playersBySeed.get(slot.seed)
                          : undefined
                      }
                      seed={slot.seed}
                      placeholder={slot.placeholder}
                      eliminated={slot.eliminated}
                      gameWins={slot.gameWins}
                      theme={theme}
                    />
                  ))}
                </MatchPair>
              ))}
              {champion && <ChampionCard player={champion} theme={theme} />}
            </div>
          </BracketColumn>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 flex items-center"
        style={{
          height: BOTTOM_BAR,
          background: theme.surface,
          borderTop: `1px solid ${theme.rule}`,
          paddingLeft: 40,
          paddingRight: 40,
        }}
      >
        {commentators && (
          <div className="flex items-center gap-2">
            <Mic size={14} color={theme.accent} strokeWidth={2} />
            <span
              style={{
                fontFamily: FONT,
                fontSize: 14,
                color: theme.muted,
                letterSpacing: "0.02em",
              }}
            >
              {commentators}
            </span>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
}

type BracketSlot = {
  seed?: number;
  placeholder: string;
  eliminated: boolean;
  // Games this seed won, once the match is decided and the result is known.
  gameWins?: number;
};

type BracketLayoutMatch = { slots: BracketSlot[] };

type BracketLayout = {
  quarterfinals: BracketLayoutMatch[];
  semifinals: BracketLayoutMatch[];
  finals: BracketLayoutMatch[];
  championSeed?: number;
};

/**
 * Lays the bracket out from the captured matches. Quarterfinals keep the
 * standard 1-8 / 4-5 / 2-7 / 3-6 order; each later match sits beside the two
 * matches that feed it, with a "winner" placeholder for a slot no match has
 * filled yet. Without match data the layout is the empty seeded bracket.
 */
export function buildBracketLayout(
  matches?: Top8BracketMatches,
): BracketLayout {
  const quarterfinalMatches = orderQuarterfinals(matches?.quarterfinals ?? []);
  const quarterfinals = quarterfinalMatches.map((match) => ({
    slots: match.seeds.map((seed, index) => ({
      seed,
      placeholder: "TBD",
      eliminated: match.winnerSeed !== undefined && match.winnerSeed !== seed,
      gameWins: decidedGameWins(match, index),
    })),
  }));

  const semifinalMatches = matches?.semifinals ?? [];
  const semifinals = [0, 1].map((index) =>
    feedingMatch({
      feeders: [
        quarterfinalMatches[index * 2],
        quarterfinalMatches[index * 2 + 1],
      ],
      feederLabels: [
        `QF ${index * 2 + 1} winner`,
        `QF ${index * 2 + 2} winner`,
      ],
      candidates: semifinalMatches,
    }),
  );
  const orderedSemifinals = semifinals.map((match) => match.source);

  const finals = [
    feedingMatch({
      feeders: orderedSemifinals,
      feederLabels: ["SF 1 winner", "SF 2 winner"],
      candidates: matches?.finals ?? [],
    }),
  ];

  return {
    quarterfinals,
    semifinals: semifinals.map(({ slots }) => ({ slots })),
    finals: finals.map(({ slots }) => ({ slots })),
    championSeed: matches?.championSeed,
  };
}

/**
 * Puts each captured quarterfinal in the seeded position its seeds belong
 * to, keeping the standard top-to-bottom order. Positions no captured match
 * fills show the seeds expected there, so a partially posted round still
 * shows the matches Melee has published. A match whose seeds fit no free
 * position takes the first one left.
 */
export function orderQuarterfinals(matches: BracketMatch[]): BracketMatch[] {
  const positions: (BracketMatch | undefined)[] = TOP_8_PAIRINGS.map(
    () => undefined,
  );
  const unplaced: BracketMatch[] = [];
  for (const match of matches) {
    const order = match.seeds
      .map((seed, index) => ({ seed, index }))
      .sort((left, right) => left.seed - right.seed);
    const sorted = {
      ...match,
      seeds: order.map(({ seed }) => seed),
      ...(match.gameWins
        ? { gameWins: order.map(({ index }) => match.gameWins![index]) }
        : {}),
    };
    const best = sorted.seeds[0];
    const index = QUARTERFINAL_ORDER.indexOf(best);
    const position =
      index !== -1 && positions[index] === undefined
        ? index
        : TOP_8_PAIRINGS.findIndex(
            (pair, candidate) =>
              positions[candidate] === undefined &&
              pair.some((seed) => sorted.seeds.includes(seed)),
          );
    if (position === -1) {
      unplaced.push(sorted);
    } else {
      positions[position] = sorted;
    }
  }
  return positions.map(
    (match, index) =>
      match ?? unplaced.shift() ?? { seeds: [...TOP_8_PAIRINGS[index]] },
  );
}

/**
 * The match fed by two earlier matches: its slots hold the seed that came
 * through each feeder, or that feeder's "winner" placeholder.
 */
function feedingMatch(args: {
  feeders: (BracketMatch | undefined)[];
  feederLabels: string[];
  candidates: BracketMatch[];
}): { slots: BracketSlot[]; source: BracketMatch | undefined } {
  const feederSeeds = args.feeders.map(
    (feeder) => new Set(feeder?.seeds ?? []),
  );
  const source = args.candidates.find((candidate) =>
    candidate.seeds.some((seed) =>
      feederSeeds.some((seeds) => seeds.has(seed)),
    ),
  );
  const slots = args.feeders.map((feeder, index): BracketSlot => {
    const seed =
      source?.seeds.find((candidate) => feederSeeds[index].has(candidate)) ??
      feeder?.winnerSeed;
    return {
      seed,
      placeholder: args.feederLabels[index],
      eliminated:
        seed !== undefined &&
        source?.winnerSeed !== undefined &&
        source.winnerSeed !== seed,
      gameWins:
        source && seed !== undefined
          ? decidedGameWins(source, source.seeds.indexOf(seed))
          : undefined,
    };
  });
  return { slots, source };
}

/** Game wins for the seed at `index`, only once the match has a winner. */
function decidedGameWins(
  match: BracketMatch,
  index: number,
): number | undefined {
  return match.winnerSeed !== undefined && index >= 0
    ? match.gameWins?.[index]
    : undefined;
}

function buildPlayersBySeed(standings: Top8BracketStanding[]) {
  const players = standings
    .map((standing): BracketPlayer | undefined => {
      const seed = standing.seed ?? standing.rank;
      if (seed < 1 || seed > 8) {
        return undefined;
      }

      return {
        seed,
        name: standing.name,
        deckName: standing.playerData?.deckName ?? "-",
      };
    })
    .filter((player): player is BracketPlayer => player !== undefined)
    .sort((left, right) => left.seed - right.seed);

  return new Map(players.map((player) => [player.seed, player]));
}

function BracketColumn({
  title,
  titleInset = 0,
  children,
  theme,
}: {
  title: string;
  // Starts the title at the cards' left edge when a seed gutter sits before them.
  titleInset?: number;
  children: React.ReactNode;
  theme: BraunDarkPalette;
}) {
  return (
    <section className="min-w-0">
      <div
        style={{
          height: 34,
          paddingLeft: titleInset,
          borderBottom: `1px solid ${theme.rule}`,
          color: theme.muted,
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "0.25em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {/* Equal-height columns keep headings aligned and the final stationary
          when the champion appears. Later matches use feeder midpoints. */}
      <div className="relative mt-8" style={{ height: BRACKET_HEIGHT }}>
        {children}
      </div>
    </section>
  );
}

/**
 * The seeds of a quarterfinal, sitting outside the card so each player is
 * numbered once. Rows line up with the card's slots: one pixel of card
 * border, then a slot per row.
 */
function SeedGutter({
  seeds,
  playersBySeed,
  theme,
}: {
  seeds: (number | undefined)[];
  playersBySeed: Map<number, BracketPlayer>;
  theme: BraunDarkPalette;
}) {
  return (
    <div
      className="grid"
      style={{
        paddingTop: 1,
        gridTemplateRows: `repeat(${seeds.length}, ${SLOT_HEIGHT}px)`,
      }}
    >
      {seeds.map((seed, index) => (
        <div
          key={index}
          className="flex items-center justify-end"
          style={{
            color:
              seed !== undefined && playersBySeed.has(seed)
                ? theme.accent
                : theme.muted,
            fontSize: 30,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {seed}
        </div>
      ))}
    </div>
  );
}

function MatchPair({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: BraunDarkPalette;
}) {
  return (
    <div
      className="grid overflow-hidden"
      style={{
        border: `1px solid ${theme.rule}`,
        background: theme.surfaceRaised,
      }}
    >
      {children}
    </div>
  );
}

function PlayerSlot({
  player,
  seed,
  placeholder,
  eliminated,
  gameWins,
  theme,
}: {
  player?: BracketPlayer;
  seed?: number;
  placeholder: string;
  eliminated: boolean;
  gameWins?: number;
  theme: BraunDarkPalette;
}) {
  if (seed === undefined) {
    return <WinnerSlot label={placeholder} theme={theme} />;
  }
  // Only the text dims for an eliminated player. The slot's borders keep
  // the rule color so every card frame reads the same.
  const dimmed = eliminated ? 0.45 : 1;
  return (
    <div
      className="grid min-w-0 border-b last:border-b-0"
      style={{
        gridTemplateColumns:
          gameWins !== undefined
            ? `minmax(0, 1fr) ${SCORE_WIDTH}px`
            : "minmax(0, 1fr)",
        minHeight: SLOT_HEIGHT,
        borderColor: theme.rule,
      }}
    >
      <PlayerText
        name={player?.name ?? placeholder}
        deckName={player?.deckName ?? "-"}
        nameColor={player ? theme.text : theme.muted}
        opacity={dimmed}
        theme={theme}
      />
      {gameWins !== undefined && (
        <div
          className="flex items-center justify-center"
          style={{ borderLeft: `1px solid ${theme.rule}` }}
        >
          <span
            style={{
              color: theme.text,
              opacity: dimmed,
              fontSize: 30,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {gameWins}
          </span>
        </div>
      )}
    </div>
  );
}

function PlayerText({
  name,
  deckName,
  nameColor,
  opacity = 1,
  theme,
}: {
  name: string;
  deckName: string;
  nameColor: string;
  opacity?: number;
  theme: BraunDarkPalette;
}) {
  return (
    <div
      className="flex min-w-0 flex-col justify-center px-5"
      style={{ opacity }}
    >
      <div
        className="truncate"
        style={{
          color: nameColor,
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: 0,
          lineHeight: 1.05,
        }}
      >
        {name}
      </div>
      <div
        className="mt-2 truncate"
        style={{
          color: theme.muted,
          fontSize: 19,
          fontWeight: 400,
          letterSpacing: "0.01em",
          lineHeight: 1.1,
        }}
      >
        {deckName}
      </div>
    </div>
  );
}

function ChampionCard({
  player,
  theme,
}: {
  player: BracketPlayer;
  theme: BraunDarkPalette;
}) {
  return (
    <div
      className="grid min-w-0 overflow-hidden"
      style={{
        border: `1px solid ${theme.accent}`,
        background: theme.surfaceRaised,
      }}
    >
      <div
        className="px-5"
        style={{
          height: 34,
          display: "flex",
          alignItems: "center",
          borderBottom: `1px solid ${theme.rule}`,
          color: theme.accent,
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "0.25em",
          textTransform: "uppercase",
        }}
      >
        Champion
      </div>
      <div className="grid min-w-0" style={{ minHeight: SLOT_HEIGHT }}>
        <PlayerText
          name={player.name}
          deckName={player.deckName}
          nameColor={theme.text}
          theme={theme}
        />
      </div>
    </div>
  );
}

function WinnerSlot({
  label,
  theme,
}: {
  label: string;
  theme: BraunDarkPalette;
}) {
  return (
    <div
      className="flex items-center border-b px-5 last:border-b-0"
      style={{
        minHeight: SLOT_HEIGHT,
        borderColor: theme.rule,
        color: theme.muted,
        fontSize: 18,
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
}
