import { api } from "@/convex/_generated/api";
import { MatchOverlayWithPlayers } from "@/convex/types";
import { useQuery } from "convex/react";
import Timer from "@/components/timer";
import { Mic } from "lucide-react";
import Image from "next/image";
import {
  getBraunDarkPalette,
  type BraunDarkPalette,
} from "@/lib/braun-dark-palettes";

/**
 * Braun Dark — Camera Frame Overlay
 *
 * Dark variant of the Braun / Dieter Rams industrial design overlay.
 * Features a full camera frame layout with bezel borders, 300px card
 * width, 36px gutter, no labels, and the default timer.
 *
 * Theme: Matte anthracite surface, warm stone type — Braun T 1000 receiver
 */

// ── Layout constants ──
const TOP_BAR = 120;
const BOTTOM_BAR = 48;
const SIDE_MARGIN = 24;
const CONTENT_MARGIN = 32;
const CARD_WIDTH = 300;
const GUTTER = 32;
const CARD_ASPECT_W = 745;
const CARD_ASPECT_H = 1040;
const P1_CARD_LOGO_MAX_WIDTH = "70%";
const P2_CARD_LOGO_MAX_WIDTH = "55%";
const CARD_LOGO_MAX_HEIGHT = "70%";

// ── Bezel border tokens ──
const BEZEL_BORDER = 1;
const BEZEL_PAD = 5;
const FRAME_INSET = BEZEL_BORDER + BEZEL_PAD;

// ── Computed layout zones ──
type CameraZone = { x: number; y: number; w: number; h: number };

function computeLayout(): {
  p1: CameraZone;
  p1Card: CameraZone;
  main: CameraZone;
  p2: CameraZone;
  p2Card: CameraZone;
} {
  const mainStartY = TOP_BAR + CONTENT_MARGIN;
  const sideStartY = mainStartY; // full top bar, not compact
  const endY = 1080 - BOTTOM_BAR - CONTENT_MARGIN;

  const sideAvH = endY - sideStartY;
  const mainAvH = endY - mainStartY;
  const avW = 1920 - SIDE_MARGIN * 2;

  const cardH = Math.round(CARD_WIDTH * (CARD_ASPECT_H / CARD_ASPECT_W));
  const playerH = Math.max(60, sideAvH - cardH - GUTTER);
  const mainW = Math.max(200, avW - 2 * CARD_WIDTH - 2 * GUTTER);
  const mainH = mainAvH;

  const leftX = SIDE_MARGIN;
  const mainX = leftX + CARD_WIDTH + GUTTER;
  const rightX = mainX + mainW + GUTTER;

  return {
    p1: { x: leftX, y: sideStartY, w: CARD_WIDTH, h: playerH },
    p1Card: {
      x: leftX,
      y: sideStartY + playerH + GUTTER,
      w: CARD_WIDTH,
      h: cardH,
    },
    main: { x: mainX, y: mainStartY, w: mainW, h: mainH },
    p2: { x: rightX, y: sideStartY, w: CARD_WIDTH, h: playerH },
    p2Card: {
      x: rightX,
      y: sideStartY + playerH + GUTTER,
      w: CARD_WIDTH,
      h: cardH,
    },
  };
}

const ZONES = computeLayout();

// ── Components ──

function GameWinDot({
  won,
  index,
  theme,
}: {
  won: number;
  index: number;
  theme: BraunDarkPalette;
}) {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: index < won ? theme.text : "transparent",
        border: `1.5px solid ${index < won ? theme.text : theme.muted}`,
        transition: "all 0.3s ease",
      }}
    />
  );
}

function BezelFrame({
  zone,
  theme,
}: {
  zone: CameraZone;
  theme: BraunDarkPalette;
}) {
  const fx = zone.x - FRAME_INSET;
  const fy = zone.y - FRAME_INSET;
  const fw = zone.w + FRAME_INSET * 2;
  const fh = zone.h + FRAME_INSET * 2;

  return (
    <div
      style={{
        position: "absolute",
        left: fx,
        top: fy,
        width: fw,
        height: fh,
        border: `${BEZEL_BORDER}px solid ${theme.frameBorder}`,
        boxSizing: "border-box",
        pointerEvents: "none",
      }}
    />
  );
}

function Placeholder({
  zone,
  label,
  isCard,
  theme,
}: {
  zone: CameraZone;
  label: string;
  isCard?: boolean;
  theme: BraunDarkPalette;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: zone.x,
        top: zone.y,
        width: zone.w,
        height: zone.h,
        background: isCard ? theme.placeholderBgCard : theme.placeholderBg,
        overflow: "hidden",
      }}
    >
      {/* Crosshair */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 1,
          background: theme.placeholderCrosshair,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 1,
          background: theme.placeholderCrosshair,
        }}
      />
      {/* Card outline hint */}
      {isCard && (
        <div
          style={{
            position: "absolute",
            inset: "12%",
            border: `1px solid ${theme.placeholderCrosshair}`,
            borderRadius: 8,
          }}
        />
      )}
      {/* Top-left coordinates */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          padding: "4px 6px",
          border: `1px solid ${theme.placeholderCrosshair}`,
          background: "rgba(0,0,0,0.35)",
          borderRadius: 4,
          fontFamily: "'Instrument Sans', 'Helvetica Neue', sans-serif",
          fontSize: 10,
          fontWeight: 500,
          color: theme.placeholderLabel,
          letterSpacing: "0.05em",
        }}
      >
        X:{zone.x} Y:{zone.y}
      </div>
      {/* Label */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <span
          style={{
            fontFamily: "'Instrument Sans', 'Helvetica Neue', sans-serif",
            fontSize: 11,
            fontWeight: 500,
            color: theme.placeholderLabel,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "'Instrument Sans', 'Helvetica Neue', sans-serif",
            fontSize: 10,
            color: theme.placeholderDim,
            letterSpacing: "0.05em",
          }}
        >
          {zone.w} × {zone.h}
        </span>
      </div>
    </div>
  );
}

export default function MatchBraunDarkOverlay({
  data,
}: {
  data: MatchOverlayWithPlayers;
}) {
  const theme = getBraunDarkPalette(data.braunDarkPalette);
  const tournamentInfo = useQuery(api.tournaments.getTournamentInfo, {
    tournamentId: data.tournamentId,
  });
  if (!tournamentInfo) return null;

  return (
    <div
      className="w-[1920px] h-[1080px] relative overflow-hidden"
      style={{
        background: theme.surface,
        color: theme.text,
      }}
    >
      {/* ── CAMERA PLACEHOLDERS ── */}
      <Placeholder zone={ZONES.main} label="Overhead Camera" theme={theme} />
      <Placeholder zone={ZONES.p1} label="Player 1 Cam" theme={theme} />
      <Placeholder zone={ZONES.p2} label="Player 2 Cam" theme={theme} />
      {/* <Placeholder zone={ZONES.p1Card} label="P1 Card" isCard />
      <Placeholder zone={ZONES.p2Card} label="P2 Card" isCard /> */}

      {/* ── CARD LOGOS ── */}
      <div
        style={{
          position: "absolute",
          left: ZONES.p1Card.x,
          top: ZONES.p1Card.y,
          width: ZONES.p1Card.w,
          height: ZONES.p1Card.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <Image
          src="/images/logos/swamp-logo-tight.svg"
          alt=""
          width={711}
          height={545}
          style={{
            width: "auto",
            height: "auto",
            maxWidth: P1_CARD_LOGO_MAX_WIDTH,
            maxHeight: CARD_LOGO_MAX_HEIGHT,
            objectFit: "contain",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: ZONES.p2Card.x,
          top: ZONES.p2Card.y,
          width: ZONES.p2Card.w,
          height: ZONES.p2Card.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <Image
          src="/images/logos/great-stories-logo-tan.png"
          alt=""
          width={1639}
          height={2048}
          style={{
            width: "auto",
            height: "auto",
            maxWidth: P2_CARD_LOGO_MAX_WIDTH,
            maxHeight: CARD_LOGO_MAX_HEIGHT,
            objectFit: "contain",
          }}
        />
      </div>

      {/* ── BEZEL FRAMES (no labels) ── */}
      <BezelFrame zone={ZONES.main} theme={theme} />
      <BezelFrame zone={ZONES.p1} theme={theme} />
      <BezelFrame zone={ZONES.p2} theme={theme} />
      {/* <BezelFrame zone={ZONES.p1Card} />
      <BezelFrame zone={ZONES.p2Card} /> */}

      {/* ── TOP BAR ── */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: TOP_BAR,
          background: theme.surface,
          borderBottom: `1px solid ${theme.rule}`,
        }}
      >
        <div className="flex items-stretch h-full">
          {/* Player 1 Life */}
          <div
            className="flex items-center justify-center"
            style={{
              width: 200,
              borderRight: `1px solid ${theme.rule}`,
            }}
          >
            <span
              style={{
                fontFamily: "'Instrument Sans', 'Helvetica Neue', sans-serif",
                fontSize: 72,
                fontWeight: 600,
                color: theme.text,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              {data.player1Life}
            </span>
          </div>

          {/* Player 1 game wins */}
          <div
            className="flex flex-col items-center justify-center gap-2"
            style={{
              width: 40,
              borderRight: `1px solid ${theme.rule}`,
            }}
          >
            <GameWinDot
              won={data.player1GamesWon ?? 0}
              index={0}
              theme={theme}
            />
            <GameWinDot
              won={data.player1GamesWon ?? 0}
              index={1}
              theme={theme}
            />
          </div>

          {/* Player 1 name + deck */}
          <div
            className="flex flex-col justify-center"
            style={{
              flex: 1,
              paddingLeft: 32,
              paddingRight: 20,
            }}
          >
            <div
              style={{
                fontFamily: "'Instrument Sans', 'Helvetica Neue', sans-serif",
                fontSize: 38,
                fontWeight: 500,
                color: theme.text,
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
              }}
            >
              {data.player1DisplayName || data.player1Data?.name || "Player 1"}
            </div>
            <div className="flex items-center gap-3 mt-[2px]">
              <span
                style={{
                  fontFamily: "'Instrument Sans', 'Helvetica Neue', sans-serif",
                  fontSize: 20,
                  fontWeight: 400,
                  color: theme.muted,
                  letterSpacing: "0.02em",
                }}
              >
                {data.player1DisplayDeck ||
                  data.player1Data?.deckName ||
                  "Deck 1"}
              </span>
              {data.player1TournamentRecord && (
                <>
                  <span style={{ color: theme.accent, fontSize: 20 }}>|</span>
                  <span
                    style={{
                      fontFamily:
                        "'Instrument Sans', 'Helvetica Neue', sans-serif",
                      fontSize: 20,
                      color: theme.muted,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {data.player1TournamentRecord}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Center — Round + Timer */}
          <div
            className="flex flex-col items-center justify-center"
            style={{
              width: 280,
              borderLeft: `1px solid ${theme.rule}`,
              borderRight: `1px solid ${theme.rule}`,
            }}
          >
            <div
              style={{
                fontFamily: "'Instrument Sans', 'Helvetica Neue', sans-serif",
                fontSize: 14,
                fontWeight: 500,
                color: theme.muted,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              {tournamentInfo?.currentRoundDisplayName || "Round"}
            </div>
            <div
              style={{
                fontFamily: "'Instrument Sans', 'Helvetica Neue', sans-serif",
                fontSize: 48,
                fontWeight: 600,
                color: theme.text,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              <Timer tournamentInfo={tournamentInfo} />
            </div>
            {/* Functional orange accent line */}
            <div
              style={{
                width: 24,
                height: 2,
                background: theme.accent,
                marginTop: 8,
                borderRadius: 1,
              }}
            />
          </div>

          {/* Player 2 name + deck */}
          <div
            className="flex flex-col justify-center items-end"
            style={{
              flex: 1,
              paddingRight: 32,
              paddingLeft: 20,
            }}
          >
            <div
              style={{
                fontFamily: "'Instrument Sans', 'Helvetica Neue', sans-serif",
                fontSize: 38,
                fontWeight: 500,
                color: theme.text,
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
                textAlign: "right",
              }}
            >
              {data.player2DisplayName || data.player2Data?.name || "Player 2"}
            </div>
            <div className="flex items-center gap-3 mt-[2px]">
              {data.player2TournamentRecord && (
                <>
                  <span
                    style={{
                      fontFamily:
                        "'Instrument Sans', 'Helvetica Neue', sans-serif",
                      fontSize: 20,
                      color: theme.muted,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {data.player2TournamentRecord}
                  </span>
                  <span style={{ color: theme.accent, fontSize: 20 }}>|</span>
                </>
              )}
              <span
                style={{
                  fontFamily: "'Instrument Sans', 'Helvetica Neue', sans-serif",
                  fontSize: 20,
                  fontWeight: 400,
                  color: theme.muted,
                  letterSpacing: "0.02em",
                }}
              >
                {data.player2DisplayDeck ||
                  data.player2Data?.deckName ||
                  "Deck 2"}
              </span>
            </div>
          </div>

          {/* Player 2 game wins */}
          <div
            className="flex flex-col items-center justify-center gap-2"
            style={{
              width: 40,
              borderLeft: `1px solid ${theme.rule}`,
            }}
          >
            <GameWinDot
              won={data.player2GamesWon ?? 0}
              index={0}
              theme={theme}
            />
            <GameWinDot
              won={data.player2GamesWon ?? 0}
              index={1}
              theme={theme}
            />
          </div>

          {/* Player 2 Life */}
          <div
            className="flex items-center justify-center"
            style={{
              width: 200,
              borderLeft: `1px solid ${theme.rule}`,
            }}
          >
            <span
              style={{
                fontFamily: "'Instrument Sans', 'Helvetica Neue', sans-serif",
                fontSize: 72,
                fontWeight: 600,
                color: theme.text,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              {data.player2Life}
            </span>
          </div>
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
        {/* Commentators */}
        {(tournamentInfo.commentatorLeft ||
          tournamentInfo.commentatorRight) && (
          <div className="flex items-center gap-2">
            <Mic size={14} color={theme.accent} strokeWidth={2} />
            <span
              style={{
                fontFamily: "'Instrument Sans', 'Helvetica Neue', sans-serif",
                fontSize: 14,
                color: theme.muted,
                letterSpacing: "0.02em",
              }}
            >
              {[tournamentInfo.commentatorLeft, tournamentInfo.commentatorRight]
                .filter(Boolean)
                .join(" & ")}
            </span>
          </div>
        )}

        {/* Braun-style product label */}
        <div
          className="ml-auto"
          style={{
            fontFamily: "'Instrument Sans', 'Helvetica Neue', sans-serif",
            fontSize: 10,
            fontWeight: 500,
            color: theme.muted,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
          }}
        >
          {tournamentInfo.eventName}{" "}
          <span style={{ color: theme.accent }}>|</span> PREMODERN
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
}
