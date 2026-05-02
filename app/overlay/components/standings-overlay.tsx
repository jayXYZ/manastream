"use client";

import { api } from "@/convex/_generated/api";
import { StandingsOverlay as StandingsOverlayType } from "@/convex/types";
import {
  getBraunDarkPalette,
  type BraunDarkPalette,
} from "@/lib/braun-dark-palettes";
import { useQuery } from "convex/react";
import { Mic } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Top8BracketOverlay, {
  type Top8BracketStanding,
} from "./top-8-bracket-overlay";

const PAGE_SIZE = 16;

const FONT = "'Instrument Sans', 'Helvetica Neue', sans-serif";
const TOP_BAR = 120;
const BOTTOM_BAR = 48;
const SIDE_MARGIN = 140;
const TABLE_PADDING_TOP = 28;
const TABLE_PADDING_BOTTOM = 18;
const HEADER_HEIGHT = 32;
const ROW_HEIGHT = 48;
const ELIMINATION_ROUND_NAMES = new Set([
  "Quarterfinals",
  "Semifinals",
  "Finals",
]);
const MOCK_TOP_8_STANDINGS: Top8BracketStanding[] = [
  {
    seed: 1,
    rank: 1,
    name: "Ari Lax",
    playerData: { deckName: "Dimir Tempo" },
  },
  {
    seed: 2,
    rank: 2,
    name: "Mara Halden",
    playerData: { deckName: "Jeskai Control" },
  },
  {
    seed: 3,
    rank: 3,
    name: "Tomas Rivera",
    playerData: { deckName: "Golgari Midrange" },
  },
  {
    seed: 4,
    rank: 4,
    name: "Noor Patel",
    playerData: { deckName: "Boros Convoke" },
  },
  {
    seed: 5,
    rank: 5,
    name: "Elena Zhang",
    playerData: { deckName: "Amulet Titan" },
  },
  {
    seed: 6,
    rank: 6,
    name: "Sam Okafor",
    playerData: { deckName: "Rakdos Scam" },
  },
  {
    seed: 7,
    rank: 7,
    name: "Jules Martin",
    playerData: { deckName: "Yawgmoth Combo" },
  },
  {
    seed: 8,
    rank: 8,
    name: "Kai Nakamura",
    playerData: { deckName: "Domain Zoo" },
  },
];

export default function StandingsOverlay({
  data,
}: {
  data: StandingsOverlayType;
}) {
  const theme = getBraunDarkPalette(data.braunDarkPalette);
  const tournamentInfo = useQuery(api.tournaments.getTournamentInfo, {
    tournamentId: data.tournamentId,
  });
  const commentators = [
    tournamentInfo?.commentatorLeft,
    tournamentInfo?.commentatorRight,
  ]
    .filter(Boolean)
    .join(" & ");

  const searchParams = useSearchParams();
  const isMockTop8Preview = searchParams.get("mockTop8") === "1";
  const standings = data.standingsDataWithPlayers ?? [];
  const bracketStandings = isMockTop8Preview
    ? MOCK_TOP_8_STANDINGS
    : data.bracketDataWithPlayers ?? standings;
  const roundName =
    (isMockTop8Preview
      ? "Quarterfinals"
      : data.roundDisplayName ?? tournamentInfo?.currentRoundDisplayName) ??
    "";
  const eventName =
    (isMockTop8Preview ? "Top 8 Preview" : tournamentInfo?.eventName) ?? "";
  const isEliminationPhase =
    isMockTop8Preview ||
    data.isEliminationPhase ||
    ELIMINATION_ROUND_NAMES.has(roundName);
  const parsedPage = parseInt(searchParams.get("page") ?? "1", 10);
  const pageNumber =
    Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const startIndex = (pageNumber - 1) * PAGE_SIZE;
  const paginatedStandings = standings.slice(
    startIndex,
    startIndex + PAGE_SIZE,
  );

  const formatRecord = (wins: number, losses: number, draws: number) =>
    `${wins}-${losses}${draws > 0 ? `-${draws}` : ""}`;

  if (isEliminationPhase) {
    return (
      <Top8BracketOverlay
        commentators={commentators}
        standings={bracketStandings}
        theme={theme}
      />
    );
  }

  return (
    <div
      className="w-[1920px] h-[1080px] relative overflow-hidden"
      style={{ background: theme.surface, color: theme.text, fontFamily: FONT }}
    >
      {/* ── TOP BAR ── */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center"
        style={{
          height: TOP_BAR,
          borderBottom: `1px solid ${theme.rule}`,
          paddingLeft: SIDE_MARGIN,
          paddingRight: SIDE_MARGIN,
        }}
      >
        <div className="flex items-baseline gap-5">
          <span
            style={{
              fontSize: 56,
              fontWeight: 600,
              letterSpacing: 0,
              lineHeight: 1,
              color: theme.text,
            }}
          >
            {eventName}
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: theme.accent,
            }}
          >
            {roundName}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: theme.muted,
            }}
          ></span>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div
        className="absolute left-0 right-0"
        style={{
          top: TOP_BAR,
          bottom: BOTTOM_BAR,
          paddingLeft: SIDE_MARGIN,
          paddingRight: SIDE_MARGIN,
          paddingTop: TABLE_PADDING_TOP,
          paddingBottom: TABLE_PADDING_BOTTOM,
        }}
      >
        <div
          className="grid w-full"
          style={{
            gridTemplateColumns: "100px minmax(0, 1fr) minmax(0, 1fr) 170px",
            columnGap: 28,
            rowGap: 0,
          }}
        >
          {/* Header */}
          <HeaderCell align="left" theme={theme}>
            Rank
          </HeaderCell>
          <HeaderCell align="left" theme={theme}>
            Name
          </HeaderCell>
          <HeaderCell align="left" theme={theme}>
            Deck
          </HeaderCell>
          <HeaderCell align="right" theme={theme}>
            Record
          </HeaderCell>

          {paginatedStandings.map((standing, idx) => {
            const rowBg = idx % 2 === 1 ? theme.rowAlt : "transparent";
            return (
              <Row key={standing.player_id} bg={rowBg} theme={theme}>
                <Cell align="left">
                  <span
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      letterSpacing: 0,
                      color: theme.text,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {String(standing.rank).padStart(2, "0")}
                  </span>
                </Cell>
                <Cell align="left">
                  <span
                    style={{
                      fontSize: 28,
                      fontWeight: 500,
                      letterSpacing: 0,
                      color: theme.text,
                    }}
                  >
                    {standing.name}
                  </span>
                </Cell>
                <Cell align="left">
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 400,
                      color: theme.muted,
                      letterSpacing: "0.01em",
                    }}
                  >
                    {standing.playerData?.deckName ?? "—"}
                  </span>
                </Cell>
                <Cell align="right">
                  <span
                    style={{
                      fontSize: 28,
                      fontWeight: 500,
                      color: theme.text,
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {formatRecord(
                      standing.wins,
                      standing.losses,
                      standing.draws,
                    )}
                  </span>
                </Cell>
              </Row>
            );
          })}
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
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

function HeaderCell({
  children,
  align,
  theme,
}: {
  children: React.ReactNode;
  align: "left" | "right";
  theme: BraunDarkPalette;
}) {
  return (
    <div
      style={{
        padding: "0 12px",
        height: HEADER_HEIGHT,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        borderBottom: `1px solid ${theme.rule}`,
        textAlign: align,
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: "0.25em",
        textTransform: "uppercase",
        color: theme.muted,
      }}
    >
      {children}
    </div>
  );
}

function Row({
  children,
  bg,
  theme,
}: {
  children: React.ReactNode;
  bg: string;
  theme: BraunDarkPalette;
}) {
  return (
    <div
      style={{
        display: "contents",
      }}
    >
      {/* Wrap each cell with the row background by cloning via a fragment */}
      {Array.isArray(children)
        ? children.map((child, i) => (
            <div
              key={i}
              style={{
                background: bg,
                borderBottom: `1px solid ${theme.rule}`,
                height: ROW_HEIGHT,
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              {child}
            </div>
          ))
        : children}
    </div>
  );
}

function Cell({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "left" | "right";
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        padding: "0 12px",
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}
