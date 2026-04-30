import { api } from "@/convex/_generated/api";
import { MatchOverlayWithPlayers } from "@/convex/types";
import { useQuery } from "convex/react";
import Timer from "@/components/timer";
import Image from "next/image";
import localFont from "next/font/local";
import { getLc26BackgroundImageForPlayer } from "@/lib/lc26-backgrounds";

const goudyMediaeval = localFont({
  src: "../../../../public/fonts/Goudy Mediaeval Regular.ttf",
  display: "swap",
  variable: "--font-goudy",
});

const plantinRegular = localFont({
  src: "../../../../public/fonts/PlantinMTProRg.ttf",
  display: "swap",
  variable: "--font-plantin",
});

const plantinItalic = localFont({
  src: "../../../../public/fonts/PlantinMTProRgIt.ttf",
  display: "swap",
  variable: "--font-plantin-italic",
});

const THEME = {
  surface: "#1C1B19",
  text: "#D4CFC5",
  muted: "#918A84",
  accent: "#E8642C",
  rule: "rgba(0,0,0,0)",
  placeholderBg: "rgba(0,0,0,0.55)",
  placeholderBgCard: "rgba(0,0,0,0.40)",
  placeholderCrosshair: "rgba(255,255,255,0.04)",
  placeholderLabel: "rgba(255,255,255,0.18)",
  placeholderDim: "rgba(255,255,255,0.08)",
  frameBorder: "#000",
  bezelShadow: "rgba(0,0,0,0.40)",
  bezelHighlight: "rgba(255,255,255,0.22)",
  watermark: "rgba(210,200,185,0.10)",
};

// ── Layout constants ──
const TOP_BAR = 120;
const BOTTOM_BAR = 24;
const SIDE_MARGIN = 24;
const CONTENT_MARGIN = 0;
const CARD_WIDTH = 300;
const GUTTER = 32;
const CARD_ASPECT_W = 745;
const CARD_ASPECT_H = 1040;
const P2_CARD_LOGO_MAX_WIDTH = "70%";
const CARD_LOGO_MAX_HEIGHT = "70%";

// ── Bezel border tokens ──
const BEZEL_BORDER = 2;
const BEZEL_PAD = 8;
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

function GameWinDot({ won, index }: { won: number; index: number }) {
  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: index < won ? "white" : "transparent",
        border: "2px solid white",
        transition: "all 0.3s ease",
      }}
    />
  );
}

function BezelFrame({ zone }: { zone: CameraZone }) {
  const fx = zone.x - FRAME_INSET;
  const fy = zone.y - FRAME_INSET;
  const fw = zone.w + FRAME_INSET * 2;
  const fh = zone.h + FRAME_INSET * 2;

  const ob = BEZEL_BORDER;
  const ib = FRAME_INSET;

  return (
    <>
      {/* Beveled trapezoid fills + diagonal lines */}
      <svg
        style={{
          position: "absolute",
          left: fx,
          top: fy,
          width: fw,
          height: fh,
          pointerEvents: "none",
        }}
      >
        {/* Top trapezoid — darkens */}
        <polygon
          points={`${ob},${ob} ${fw - ob},${ob} ${fw - ib},${ib} ${ib},${ib}`}
          fill={THEME.bezelShadow}
        />
        {/* Right trapezoid — darkens */}
        <polygon
          points={`${fw - ob},${ob} ${fw - ob},${fh - ob} ${fw - ib},${fh - ib} ${fw - ib},${ib}`}
          fill={THEME.bezelShadow}
        />
        {/* Bottom trapezoid — lightens */}
        <polygon
          points={`${ib},${fh - ib} ${fw - ib},${fh - ib} ${fw - ob},${fh - ob} ${ob},${fh - ob}`}
          fill={THEME.bezelHighlight}
        />
        {/* Left trapezoid — lightens */}
        <polygon
          points={`${ob},${ob} ${ib},${ib} ${ib},${fh - ib} ${ob},${fh - ob}`}
          fill={THEME.bezelHighlight}
        />
        {/* Diagonal corner lines */}
        <line
          x1={ob}
          y1={ob}
          x2={ib}
          y2={ib}
          stroke={THEME.frameBorder}
          strokeWidth={1}
        />
        <line
          x1={fw - ob}
          y1={ob}
          x2={fw - ib}
          y2={ib}
          stroke={THEME.frameBorder}
          strokeWidth={1}
        />
        <line
          x1={ob}
          y1={fh - ob}
          x2={ib}
          y2={fh - ib}
          stroke={THEME.frameBorder}
          strokeWidth={1}
        />
        <line
          x1={fw - ob}
          y1={fh - ob}
          x2={fw - ib}
          y2={fh - ib}
          stroke={THEME.frameBorder}
          strokeWidth={1}
        />
      </svg>
      {/* Outer border */}
      <div
        style={{
          position: "absolute",
          left: fx,
          top: fy,
          width: fw,
          height: fh,
          border: `${ob}px solid ${THEME.frameBorder}`,
          boxSizing: "border-box",
          pointerEvents: "none",
        }}
      />
      {/* Inner border flush with camera zone */}
      <div
        style={{
          position: "absolute",
          left: zone.x,
          top: zone.y,
          width: zone.w,
          height: zone.h,
          border: `${ob}px solid ${THEME.frameBorder}`,
          boxSizing: "border-box",
          pointerEvents: "none",
        }}
      />
    </>
  );
}

function Placeholder({
  zone,
  label,
  isCard,
}: {
  zone: CameraZone;
  label: string;
  isCard?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: zone.x,
        top: zone.y,
        width: zone.w,
        height: zone.h,
        background: isCard ? THEME.placeholderBgCard : THEME.placeholderBg,
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
          background: THEME.placeholderCrosshair,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 1,
          background: THEME.placeholderCrosshair,
        }}
      />
      {/* Card outline hint */}
      {isCard && (
        <div
          style={{
            position: "absolute",
            inset: "12%",
            border: `1px solid ${THEME.placeholderCrosshair}`,
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
          border: `1px solid ${THEME.placeholderCrosshair}`,
          background: "rgba(0,0,0,0.35)",
          borderRadius: 4,
          fontFamily: "'Instrument Sans', 'Helvetica Neue', sans-serif",
          fontSize: 10,
          fontWeight: 500,
          color: THEME.placeholderLabel,
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
            color: THEME.placeholderLabel,
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
            color: THEME.placeholderDim,
            letterSpacing: "0.05em",
          }}
        >
          {zone.w} × {zone.h}
        </span>
      </div>
    </div>
  );
}

export default function MatchLC26Overlay({
  data,
}: {
  data: MatchOverlayWithPlayers;
}) {
  const tournamentInfo = useQuery(api.tournaments.getTournamentInfo, {
    tournamentId: data.tournamentId,
  });

  const player1Background = getLc26BackgroundImageForPlayer({
    overrideColor: data.player1Lc26BackgroundColor,
    displayDeckName: data.player1DisplayDeck,
    playerDeckName: data.player1Data?.deckName,
    fallbackColor: "Blue",
  });
  const player2Background = getLc26BackgroundImageForPlayer({
    overrideColor: data.player2Lc26BackgroundColor,
    displayDeckName: data.player2DisplayDeck,
    playerDeckName: data.player2Data?.deckName,
    fallbackColor: "Red",
  });

  if (!tournamentInfo) return null;

  return (
    <div
      className={`relative w-[1920px] h-[1080px] ${goudyMediaeval.variable} ${plantinRegular.variable} ${plantinItalic.variable}`}
    >
      <div
        style={{
          // background: "rgba(0,0,0,0.3)",
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: TOP_BAR,
        }}
      ></div>
      {/* <div className="absolute top-0 left-0 w-[1920px] h-[120px] bg-blue-600 z-10 shadow-xl"></div> */}
      {/* ── CAMERA PLACEHOLDERS ── */}
      <Placeholder zone={ZONES.main} label="Overhead Camera" />
      <Placeholder zone={ZONES.p1} label="Player 1 Cam" />
      <Placeholder zone={ZONES.p2} label="Player 2 Cam" />
      {/* ── BEZEL FRAMES (no labels) ── */}
      <BezelFrame zone={ZONES.main} />
      <BezelFrame zone={ZONES.p1} />
      <BezelFrame zone={ZONES.p2} />
      <BezelFrame zone={ZONES.p1Card} />
      <BezelFrame zone={ZONES.p2Card} />
      {/* ── CARD BACKGROUNDS ── */}
      {[ZONES.p1Card, ZONES.p2Card].map((zone, i) => (
        <div
          key={`parchment-${i}`}
          style={{
            position: "absolute",
            left: zone.x,
            top: zone.y,
            width: zone.w,
            height: zone.h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            background: "rgba(220,220,220,0.5)",
            zIndex: 50,
          }}
        ></div>
      ))}
      {/* -- Commentators & Other Info -- */}
      <div
        style={{
          position: "absolute",
          left: ZONES.p2Card.x,
          top: ZONES.p2Card.y,
          width: ZONES.p2Card.w,
          height: ZONES.p2Card.h,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 40,
          zIndex: 100,
          padding: 20,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: `${plantinItalic.style.fontFamily}, sans-serif`,
              fontSize: 36,
              color: "black",
              fontWeight: 600,
            }}
          >
            Event:
          </div>
          <div
            style={{
              fontFamily: `${plantinRegular.style.fontFamily}, sans-serif`,
              fontSize: 32,
              color: "black",
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            {tournamentInfo?.eventName}
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: `${plantinItalic.style.fontFamily}, sans-serif`,
              fontSize: 36,
              color: "black",
              fontWeight: 600,
            }}
          >
            Commentators:
          </div>
          <div
            style={{
              fontFamily: `${plantinRegular.style.fontFamily}, sans-serif`,
              fontSize: 32,
              color: "black",
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            {tournamentInfo?.commentatorLeft} & {<br />}
            {tournamentInfo?.commentatorRight}
          </div>
        </div>
      </div>
      {/* ── TOP BAR ── */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: TOP_BAR,
          // background: THEME.surface,
          borderBottom: `1px solid ${THEME.rule}`,
        }}
      >
        <div className="flex items-stretch h-full">
          {/* Player 1 Life */}
          <div
            className="flex items-center justify-center"
            style={{
              width: 200,
              borderRight: `1px solid ${THEME.rule}`,
            }}
          >
            <span
              style={{
                fontFamily: `${plantinRegular.style.fontFamily}, sans-serif`,
                fontSize: 88,
                fontWeight: 600,
                color: "white",
                letterSpacing: "-0.03em",
                lineHeight: 1,
                textShadow: "4px 4px 2px black",
              }}
            >
              {data.player1Life}
            </span>
          </div>

          {/* Player 1 game wins */}
          <div
            className="flex flex-col items-center justify-center gap-4"
            style={{
              width: 40,
              borderRight: `1px solid ${THEME.rule}`,
            }}
          >
            <GameWinDot won={data.player1GamesWon ?? 0} index={0} />
            <GameWinDot won={data.player1GamesWon ?? 0} index={1} />
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
                fontFamily: `${goudyMediaeval.style.fontFamily}, sans-serif`,
                fontSize: 56,
                fontWeight: 500,
                color: "white",
                letterSpacing: "-0.01em",
                lineHeight: 1,
                textShadow: "3px 3px 2px black",
              }}
            >
              {data.player1DisplayName || data.player1Data?.name || "Player 1"}
            </div>
            <div className="flex items-center gap-3">
              <span
                style={{
                  fontFamily: `${plantinRegular.style.fontFamily}, sans-serif`,
                  fontSize: 32,
                  fontWeight: 400,
                  color: "white",
                  letterSpacing: "0.02em",
                  textShadow: "2px 2px 2px black",
                }}
              >
                {data.player1DisplayDeck ||
                  data.player1Data?.deckName ||
                  "Deck 1"}
              </span>
              {data.player1TournamentRecord && (
                <>
                  <span
                    style={{
                      fontFamily: `${plantinRegular.style.fontFamily}, sans-serif`,
                      fontSize: 20,
                      color: "white",
                      letterSpacing: "0.02em",
                      textShadow: "2px 2px 2px black",
                    }}
                  >
                    {" "}
                    | {data.player1TournamentRecord}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Center — Round + Timer */}
          <div
            className="flex flex-col mt-10 items-center justify-center z-100"
            style={{
              width: 280,
            }}
          >
            <div
              style={{
                fontFamily: `${plantinRegular.style.fontFamily}, sans-serif`,
                fontSize: 24,
                fontWeight: 500,
                color: "white",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                marginBottom: 2,
                textShadow: "2px 2px 2px black",
              }}
            >
              {tournamentInfo?.currentRoundDisplayName || "Round"}
            </div>
            <div
              style={{
                fontFamily: `${plantinRegular.style.fontFamily}, sans-serif`,
                fontSize: 64,
                fontWeight: 600,
                color: "white",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                textShadow: "4px 4px 2px black",
              }}
            >
              <Timer tournamentInfo={tournamentInfo} />
            </div>
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
                fontFamily: `${goudyMediaeval.style.fontFamily}, sans-serif`,
                fontSize: 56,
                fontWeight: 500,
                color: "white",
                letterSpacing: "-0.01em",
                lineHeight: 1,
                textAlign: "right",
                textShadow: "3px 3px 2px black",
              }}
            >
              {data.player2DisplayName || data.player2Data?.name || "Player 2"}
            </div>
            <div className="flex items-center gap-3">
              {data.player2TournamentRecord && (
                <>
                  <span
                    style={{
                      fontFamily: `${plantinRegular.style.fontFamily}, sans-serif`,
                      fontSize: 20,
                      color: "white",
                      letterSpacing: "0.02em",
                      textShadow: "2px 2px 2px black",
                    }}
                  >
                    {data.player2TournamentRecord} |{" "}
                  </span>
                </>
              )}
              <span
                style={{
                  fontFamily: `${plantinRegular.style.fontFamily}, sans-serif`,
                  fontSize: 32,
                  fontWeight: 400,
                  color: "white",
                  letterSpacing: "0.02em",
                  textShadow: "2px 2px 2px black",
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
            className="flex flex-col items-center justify-center gap-4"
            style={{
              width: 40,
              borderLeft: `1px solid ${THEME.rule}`,
            }}
          >
            <GameWinDot won={data.player2GamesWon ?? 0} index={0} />
            <GameWinDot won={data.player2GamesWon ?? 0} index={1} />
          </div>

          {/* Player 2 Life */}
          <div
            className="flex items-center justify-center"
            style={{
              width: 200,
              borderLeft: `1px solid ${THEME.rule}`,
            }}
          >
            <span
              style={{
                fontFamily: `${plantinRegular.style.fontFamily}, sans-serif`,
                fontSize: 88,
                fontWeight: 600,
                color: "white",
                letterSpacing: "-0.03em",
                lineHeight: 1,
                textShadow: "4px 4px 2px black",
              }}
            >
              {data.player2Life}
            </span>
          </div>
        </div>
      </div>
      {/* ── BOTTOM BAR ── */}
      <div className="absolute bottom-0 left-0 right-0 z-100">
        <div
          className="flex items-center justify-center"
          style={{
            fontFamily: `${goudyMediaeval.style.fontFamily}, sans-serif`,
            fontSize: 28,
            fontWeight: 500,
            color: "white",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            textShadow: "2px 2px 2px black",
            alignItems: "baseline",
          }}
        >
          LOBSTERCON
          <span
            style={{
              display: "inline-block",
              lineHeight: 1,
              transform: "scaleY(1.16)",
              transformOrigin: "bottom center",
              marginLeft: "0.28em",
            }}
          >
            2026
          </span>
        </div>
      </div>
      {/* ── LOGO ── */}
      <div
        style={{
          position: "absolute",
          left: ZONES.p1Card.x,
          top: ZONES.p1Card.y,
          width: ZONES.p1Card.w,
          height: ZONES.p1Card.h,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 100,
          gap: 30,
        }}
      >
        <Image
          src="/images/logos/lc-logo.png"
          alt=""
          width={993}
          height={508}
          style={{
            width: "auto",
            height: "auto",
            maxWidth: P2_CARD_LOGO_MAX_WIDTH,
            maxHeight: CARD_LOGO_MAX_HEIGHT,
            objectFit: "contain",
          }}
        />
        <Image
          src="/images/logos/swamp-logo-border.png"
          alt=""
          width={2130}
          height={1800}
          style={{
            width: "auto",
            height: "auto",
            maxWidth: P2_CARD_LOGO_MAX_WIDTH,
            maxHeight: CARD_LOGO_MAX_HEIGHT,
            objectFit: "contain",
          }}
        />
      </div>
      {/* ── OVERLAY BACKGROUNDS ── */}
      <div style={{ display: "flex", width: 1920, height: 1080 }}>
        <div
          style={{
            width: 960,
            height: 1080,
            backgroundImage: `url(${player1Background.backgroundImage})`,
            backgroundSize: "1920px 1080px",
            backgroundPosition: "left top",
          }}
        />
        <div
          style={{
            width: 960,
            height: 1080,
            backgroundImage: `url(${player2Background.backgroundImage})`,
            backgroundSize: "1920px 1080px",
            backgroundPosition: "right top",
          }}
        />
      </div>
      <Image
        src="/images/overlays/lc26/info_final.png"
        alt="Info"
        width={1920}
        height={1080}
        className="absolute inset-0 z-50"
      />
    </div>
  );
}
