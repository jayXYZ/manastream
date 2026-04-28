"use client";

import { api } from "@/convex/_generated/api";
import { StandingsOverlay as StandingsOverlayType } from "@/convex/types";
import {
  getBraunDarkPalette,
  type BraunDarkPalette,
} from "@/lib/braun-dark-palettes";
import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";

const PAGE_SIZE = 16;

const FONT = "'Instrument Sans', 'Helvetica Neue', sans-serif";
const TOP_BAR = 120;
const BOTTOM_BAR = 48;
const SIDE_MARGIN = 80;

export default function StandingsOverlay({
  data,
}: {
  data: StandingsOverlayType;
}) {
  const theme = getBraunDarkPalette(data.braunDarkPalette);
  const tournamentInfo = useQuery(api.tournaments.getTournamentInfo, {
    tournamentId: data.tournamentId,
  });

  const standings = data.standingsDataWithPlayers ?? [];
  const searchParams = useSearchParams();
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
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: theme.text,
            }}
          >
            Standings
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
            {tournamentInfo?.currentRoundDisplayName ?? ""}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div
            style={{
              width: 24,
              height: 2,
              background: theme.accent,
              borderRadius: 1,
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: theme.muted,
            }}
          >
            {tournamentInfo?.eventName ?? ""}
          </span>
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
          paddingTop: 36,
          paddingBottom: 24,
        }}
      >
        <div
          className="grid w-full"
          style={{
            gridTemplateColumns: "120px 1fr 1fr 200px",
            columnGap: 32,
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
                      fontSize: 32,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
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
                      fontSize: 30,
                      fontWeight: 500,
                      letterSpacing: "-0.01em",
                      color: theme.text,
                    }}
                  >
                    {standing.name}
                  </span>
                </Cell>
                <Cell align="left">
                  <span
                    style={{
                      fontSize: 26,
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
                      fontSize: 30,
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
          borderTop: `1px solid ${theme.rule}`,
          paddingLeft: SIDE_MARGIN,
          paddingRight: SIDE_MARGIN,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: theme.muted,
          }}
        >
          {standings.length} Players
        </span>
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
        padding: "0 16px 14px 16px",
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
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        padding: "0 16px",
      }}
    >
      {children}
    </div>
  );
}
