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

type BracketPlayer = {
  seed: number;
  name: string;
  deckName: string;
};

export default function Top8BracketOverlay({
  commentators,
  standings,
  theme,
}: {
  commentators: string;
  standings: Top8BracketStanding[];
  theme: BraunDarkPalette;
}) {
  const playersBySeed = buildPlayersBySeed(standings);

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
              {TOP_8_PAIRINGS.map(([topSeed, bottomSeed]) => (
                <MatchPair key={`${topSeed}-${bottomSeed}`} theme={theme}>
                  <PlayerSlot
                    player={playersBySeed.get(topSeed)}
                    seed={topSeed}
                    theme={theme}
                  />
                  <PlayerSlot
                    player={playersBySeed.get(bottomSeed)}
                    seed={bottomSeed}
                    theme={theme}
                  />
                </MatchPair>
              ))}
            </div>
          </BracketColumn>

          <BracketColumn title="Semifinals" theme={theme}>
            <div className="grid gap-[150px]">
              <MatchPair theme={theme}>
                <WinnerSlot label="QF 1 winner" theme={theme} />
                <WinnerSlot label="QF 2 winner" theme={theme} />
              </MatchPair>
              <MatchPair theme={theme}>
                <WinnerSlot label="QF 3 winner" theme={theme} />
                <WinnerSlot label="QF 4 winner" theme={theme} />
              </MatchPair>
            </div>
          </BracketColumn>

          <BracketColumn title="Finals" theme={theme}>
            <div className="grid gap-[250px]">
              <MatchPair theme={theme}>
                <WinnerSlot label="SF 1 winner" theme={theme} />
                <WinnerSlot label="SF 2 winner" theme={theme} />
              </MatchPair>
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
  theme,
}: {
  player?: BracketPlayer;
  seed: number;
  theme: BraunDarkPalette;
}) {
  return (
    <div
      className="grid min-w-0"
      style={{
        gridTemplateColumns: "88px minmax(0, 1fr)",
        minHeight: 78,
        borderBottom: `1px solid ${theme.rule}`,
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
          {player?.name ?? "TBD"}
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
