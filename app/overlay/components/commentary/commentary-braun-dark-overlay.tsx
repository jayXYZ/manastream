import { api } from "@/convex/_generated/api";
import { CommentaryOverlay as CommentaryOverlayType } from "@/convex/types";
import { useQuery } from "convex/react";
import Image from "next/image";
import { getBraunDarkPalette } from "@/lib/braun-dark-palettes";

/**
 * Braun Dark — Commentary Connected Bar Overlay
 *
 * Single lower-third bar centered at bottom of 1920×1080 transparent canvas.
 * Three sections: left name | center logo/divider space | right name.
 * Follows the Braun T 1000 receiver aesthetic — matte anthracite surface,
 * warm stone type, precise bezel borders, functional orange accents.
 */

// ── Layout constants ──
const BAR_WIDTH = 1200;
const BAR_LEFT = (1920 - BAR_WIDTH) / 2;
const SECTION_SIDE = 460;
const SECTION_CENTER = BAR_WIDTH - SECTION_SIDE * 2; // 320px
const CONTENT_HEIGHT = 120;
const ACCENT_STRIP_HEIGHT = 28;

const FONT = "'Instrument Sans', 'Helvetica Neue', sans-serif";

export default function CommentaryBraunDarkOverlay({
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
      {/* Bar container — anchored to bottom edge */}
      <div
        style={{
          position: "absolute",
          left: BAR_LEFT,
          bottom: 40,
          width: BAR_WIDTH,
          border: `1px solid ${theme.frameBorder}`,
          background: theme.surface,
          boxShadow:
            "0 4px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        {/* Main content row */}
        <div style={{ display: "flex", height: CONTENT_HEIGHT }}>
          {/* Left commentator */}
          <div
            style={{
              width: SECTION_SIDE,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              paddingLeft: 24,
              paddingRight: 24,
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: 40,
                fontWeight: 500,
                color: theme.text,
                letterSpacing: "-0.01em",
                lineHeight: 1.15,
              }}
            >
              {commentatorLeft || "Commentator"}
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 20,
                fontWeight: 400,
                color: theme.muted,
                letterSpacing: "0.02em",
                marginTop: 4,
                minHeight: 24,
                visibility: commentatorLeftSubText ? "visible" : "hidden",
              }}
            >
              <span style={{ color: theme.accent }}>
                {(commentatorLeftSubText || "\u00A0").charAt(0)}
              </span>
              {(commentatorLeftSubText || "").slice(1)}
            </div>
          </div>

          {/* Center divider — logo / accent space */}
          <div
            style={{
              width: SECTION_CENTER,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderLeft: `1px solid ${theme.rule}`,
              borderRight: `1px solid ${theme.rule}`,
              gap: 6,
            }}
          >
            <Image
              src="/images/logos/swamp-logo-no-worcester.svg"
              alt="DxC Logo"
              width={723}
              height={426}
              style={{
                height: "110px",
                width: "auto",
                objectFit: "contain",
              }}
            />
          </div>

          {/* Right commentator */}
          <div
            style={{
              width: SECTION_SIDE,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              paddingLeft: 24,
              paddingRight: 24,
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: 40,
                fontWeight: 500,
                color: theme.text,
                letterSpacing: "-0.01em",
                lineHeight: 1.15,
                textAlign: "center",
              }}
            >
              {commentatorRight || "Commentator"}
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 20,
                fontWeight: 400,
                color: theme.muted,
                letterSpacing: "0.02em",
                marginTop: 4,
                textAlign: "center",
                minHeight: 24,
                visibility: commentatorRightSubText ? "visible" : "hidden",
              }}
            >
              <span style={{ color: theme.accent }}>
                {(commentatorRightSubText || "\u00A0").charAt(0)}
              </span>
              {(commentatorRightSubText || "").slice(1)}
            </div>
          </div>
        </div>

        {/* Bottom accent strip — product label bar */}
        <div
          style={{
            height: ACCENT_STRIP_HEIGHT,
            display: "flex",
            alignItems: "center",
            borderTop: `1px solid ${theme.rule}`,
            background: theme.surfaceRaised,
          }}
        >
          {/* Round name */}
          <div
            style={{
              marginLeft: 36,
              fontFamily: FONT,
              fontSize: 10,
              fontWeight: 500,
              color: theme.muted,
              letterSpacing: "0.25em",
              textTransform: "uppercase" as const,
            }}
          >
            {tournamentInfo?.currentRoundDisplayName || ""}
          </div>
          {/* Product label — Braun model number style */}
          <div
            style={{
              marginLeft: "auto",
              marginRight: 36,
              fontFamily: FONT,
              fontSize: 10,
              fontWeight: 500,
              color: theme.muted,
              letterSpacing: "0.25em",
              textTransform: "uppercase" as const,
            }}
          >
            {tournamentInfo?.eventName ?? "EVENT"}{" "}
            <span style={{ color: theme.accent }}>|</span> PREMODERN
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
}
