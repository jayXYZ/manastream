import { api } from "@/convex/_generated/api";
import { CommentaryOverlay as CommentaryOverlayType } from "@/convex/types";
import { useQuery } from "convex/react";
import {
  BraunDarkPalette,
  getBraunDarkPalette,
} from "@/lib/braun-dark-palettes";

/**
 * Braun Dark Duo — Commentary Separate Nameplates Overlay
 *
 * Two disconnected nameplates at bottom-left and bottom-right of
 * 1920×1080 transparent canvas. Each features a "COMMENTARY" label row
 * with orange accent line, name, and optional sub-text.
 * Follows the Braun T 1000 receiver aesthetic — matte anthracite surface,
 * warm stone type, precise bezel borders, functional orange accents.
 */

// ── Layout constants ──
const PLATE_WIDTH = 440;
const PLATE_HEIGHT = 100;
const EDGE_MARGIN = 40;
const BOTTOM_MARGIN = 40;

const FONT = "'Instrument Sans', 'Helvetica Neue', sans-serif";

function Nameplate({
  name,
  subText,
  align,
  theme,
}: {
  name: string;
  subText: string;
  align: "left" | "right";
  theme: BraunDarkPalette;
}) {
  const isRight = align === "right";

  return (
    <div
      style={{
        width: PLATE_WIDTH,
        height: PLATE_HEIGHT,
        background: theme.surface,
        border: `1px solid ${theme.frameBorder}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow:
          "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* Label row — COMMENTARY + accent rule */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingLeft: isRight ? 16 : 20,
          paddingRight: isRight ? 20 : 16,
          paddingTop: 10,
          paddingBottom: 2,
          flexDirection: isRight ? "row-reverse" : "row",
        }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontSize: 10,
            fontWeight: 500,
            color: theme.muted,
            letterSpacing: "0.25em",
            textTransform: "uppercase" as const,
            flexShrink: 0,
          }}
        >
          COMMENTARY
        </span>
        <div
          style={{
            flex: 1,
            height: 1,
            background: theme.accent,
          }}
        />
        {/* Small indicator dot at rule terminus */}
        <div
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: theme.accent,
            flexShrink: 0,
          }}
        />
      </div>

      {/* Name area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingLeft: 20,
          paddingRight: 20,
          textAlign: align,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 28,
            fontWeight: 500,
            color: theme.text,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          {name || "Commentator"}
        </div>
        {subText && (
          <div
            style={{
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 400,
              color: theme.muted,
              letterSpacing: "0.02em",
              marginTop: 3,
            }}
          >
            {subText}
          </div>
        )}
      </div>

      {/* Bottom edge accent — subtle raised strip */}
      <div
        style={{
          height: 3,
          background: theme.surfaceRaised,
          borderTop: `1px solid ${theme.rule}`,
        }}
      />
    </div>
  );
}

export default function CommentaryBraunDarkDuoOverlay({
  data,
}: {
  data: CommentaryOverlayType;
}) {
  const theme = getBraunDarkPalette(data.braunDarkPalette);
  const tournamentInfo = useQuery(api.tournaments.getTournamentInfo, {
    tournamentId: data.tournamentId,
  });

  const commentatorLeft =
    tournamentInfo?.commentatorLeft ?? data?.commentatorLeft ?? "";
  const commentatorLeftSubText =
    tournamentInfo?.commentatorLeftSubText ??
    data?.commentatorLeftSubText ??
    "";
  const commentatorRight =
    tournamentInfo?.commentatorRight ?? data?.commentatorRight ?? "";
  const commentatorRightSubText =
    tournamentInfo?.commentatorRightSubText ??
    data?.commentatorRightSubText ??
    "";

  return (
    <div className="w-[1920px] h-[1080px] relative overflow-hidden">
      {/* Left nameplate */}
      <div
        style={{
          position: "absolute",
          left: EDGE_MARGIN,
          bottom: BOTTOM_MARGIN,
        }}
      >
        <Nameplate
          name={commentatorLeft}
          subText={commentatorLeftSubText}
          align="left"
          theme={theme}
        />
      </div>

      {/* Right nameplate */}
      <div
        style={{
          position: "absolute",
          right: EDGE_MARGIN,
          bottom: BOTTOM_MARGIN,
        }}
      >
        <Nameplate
          name={commentatorRight}
          subText={commentatorRightSubText}
          align="right"
          theme={theme}
        />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
}
