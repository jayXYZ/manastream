import type { StandingsOverlay as StandingsOverlayType } from "@/convex/types";
import type { BraunDarkPalette } from "@/lib/braun-dark-palettes";
import { Mic } from "lucide-react";

const FONT = "'Instrument Sans', 'Helvetica Neue', sans-serif";
const BOTTOM_BAR = 48;
const SIDE_MARGIN = 140;
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
            gridTemplateColumns: "640px 360px 360px",
            columnGap: 70,
            alignItems: "center",
          }}
        >
          <BracketColumn title="Quarterfinals" theme={theme}>
            <div className="grid gap-[34px]">
              {layout.quarterfinals.map((match, index) => (
                <MatchPair key={`qf-${index}`} theme={theme}>
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
                      theme={theme}
                    />
                  ))}
                </MatchPair>
              ))}
            </div>
          </BracketColumn>

          <BracketColumn title="Semifinals" theme={theme}>
            <div className="grid gap-[150px]">
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
                      theme={theme}
                    />
                  ))}
                </MatchPair>
              ))}
            </div>
          </BracketColumn>

          <BracketColumn title="Finals" theme={theme}>
            <div className="grid gap-[60px]">
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
function buildBracketLayout(matches?: Top8BracketMatches): BracketLayout {
  const quarterfinalMatches = orderQuarterfinals(matches?.quarterfinals ?? []);
  const quarterfinals = quarterfinalMatches.map((match) => ({
    slots: match.seeds.map((seed) => ({
      seed,
      placeholder: "TBD",
      eliminated: match.winnerSeed !== undefined && match.winnerSeed !== seed,
    })),
  }));

  const semifinalMatches = matches?.semifinals ?? [];
  const semifinals = [0, 1].map((index) =>
    feedingMatch({
      feeders: [quarterfinalMatches[index * 2], quarterfinalMatches[index * 2 + 1]],
      feederLabels: [`QF ${index * 2 + 1} winner`, `QF ${index * 2 + 2} winner`],
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

function orderQuarterfinals(matches: BracketMatch[]): BracketMatch[] {
  if (matches.length !== TOP_8_PAIRINGS.length) {
    return TOP_8_PAIRINGS.map(([top, bottom]) => ({ seeds: [top, bottom] }));
  }
  const position = (match: BracketMatch) => {
    const best = Math.min(...match.seeds);
    const index = QUARTERFINAL_ORDER.indexOf(best);
    return index === -1 ? QUARTERFINAL_ORDER.length + best : index;
  };
  return [...matches]
    .map((match) => ({
      ...match,
      seeds: [...match.seeds].sort((left, right) => left - right),
    }))
    .sort((left, right) => position(left) - position(right));
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
    };
  });
  return { slots, source };
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
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: BraunDarkPalette;
}) {
  return (
    <section className="min-w-0">
      <div
        style={{
          height: 34,
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
      <div className="pt-8">{children}</div>
    </section>
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
  theme,
}: {
  player?: BracketPlayer;
  seed?: number;
  placeholder: string;
  eliminated: boolean;
  theme: BraunDarkPalette;
}) {
  if (seed === undefined) {
    return <WinnerSlot label={placeholder} theme={theme} />;
  }
  return (
    <div
      className="grid min-w-0"
      style={{
        gridTemplateColumns: "88px minmax(0, 1fr)",
        minHeight: 78,
        borderBottom: `1px solid ${theme.rule}`,
        opacity: eliminated ? 0.45 : 1,
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          color: player ? theme.accent : theme.placeholderLabel,
          fontSize: 30,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          borderRight: `1px solid ${theme.rule}`,
        }}
      >
        {seed}
      </div>
      <div className="flex min-w-0 flex-col justify-center px-5">
        <div
          className="truncate"
          style={{
            color: player ? theme.text : theme.placeholderLabel,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: 0,
            lineHeight: 1.05,
          }}
        >
          {player?.name ?? placeholder}
        </div>
        <div
          className="mt-2 truncate"
          style={{
            color: player ? theme.muted : theme.placeholderDim,
            fontSize: 19,
            fontWeight: 400,
            letterSpacing: "0.01em",
            lineHeight: 1.1,
          }}
        >
          {player?.deckName ?? "-"}
        </div>
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
      <div
        className="grid min-w-0"
        style={{ gridTemplateColumns: "88px minmax(0, 1fr)", minHeight: 78 }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            color: theme.accent,
            fontSize: 30,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            borderRight: `1px solid ${theme.rule}`,
          }}
        >
          {player.seed}
        </div>
        <div className="flex min-w-0 flex-col justify-center px-5">
          <div
            className="truncate"
            style={{
              color: theme.text,
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: 0,
              lineHeight: 1.05,
            }}
          >
            {player.name}
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
            {player.deckName}
          </div>
        </div>
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
      className="flex items-center px-5"
      style={{
        minHeight: 78,
        borderBottom: `1px solid ${theme.rule}`,
        color: theme.placeholderLabel,
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
