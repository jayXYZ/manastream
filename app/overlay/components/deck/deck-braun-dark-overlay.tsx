import Image from "next/image";
import type { JSX } from "react";
import { Mic } from "lucide-react";
import { DeckTemplateProps } from "./deck-types";
import { getBraunDarkPalette } from "@/lib/braun-dark-palettes";

const FONT = "'Instrument Sans', 'Helvetica Neue', sans-serif";
const BOTTOM_BAR = 48;
const HEADER_HEIGHT = 94;

export default function DeckBraunDarkOverlay({
  parsedDecklist,
  playerData,
  tournamentInfo,
  braunDarkPalette,
}: DeckTemplateProps) {
  const theme = getBraunDarkPalette(braunDarkPalette);
  const commentators = [
    tournamentInfo?.commentatorLeft,
    tournamentInfo?.commentatorRight,
  ]
    .filter(Boolean)
    .join(" & ");

  return (
    <div
      className="w-[1920px] h-[1080px] overflow-hidden"
      style={{
        fontFamily: FONT,
        color: theme.text,
        background: theme.surface,
      }}
    >
      <div className="relative h-full">
        <div
          className="overflow-hidden"
          style={{
            height: `calc(100% - ${BOTTOM_BAR}px)`,
            background: theme.surface,
          }}
        >
          <div
            className="mx-6 h-[94px] flex items-baseline gap-4"
            style={{
              borderBottom: `1px solid ${theme.rule}`,
              paddingTop: 24,
            }}
          >
            <span
              style={{
                fontSize: 52,
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                color: theme.text,
              }}
            >
              {playerData.name}
            </span>
            <span
              style={{
                fontSize: 36,
                fontWeight: 400,
                color: theme.accent,
                letterSpacing: "0.01em",
                lineHeight: 1,
              }}
            >
              {playerData.deckName}
            </span>
          </div>

          <div
            className="px-6 pt-4 pb-4 flex gap-4"
            style={{ height: `calc(100% - ${HEADER_HEIGHT}px)` }}
          >
            <div className="flex-1 h-full">
              <div
                className="h-full p-2"
                style={{
                  border: `1px solid ${theme.frameBorder}`,
                  background: theme.surfaceRaised,
                }}
              >
                <div
                  className="grid gap-2 justify-items-center h-full"
                  style={{
                    gridTemplateColumns: `repeat(${
                      (parsedDecklist.mainboard.length >= 22 &&
                        parsedDecklist.mainboard.length <= 24) ||
                      parsedDecklist.mainboard.length > 28
                        ? 8
                        : 7
                    }, 1fr)`,
                    gridTemplateRows: `repeat(${parsedDecklist.mainboard.length > 24 ? 4 : 3}, 1fr)`,
                    gridAutoRows: "1fr",
                  }}
                >
                  {parsedDecklist.mainboard.map((card, index) => (
                    <div
                      key={`${card.name}-${index}`}
                      className="relative w-full h-full"
                    >
                      {card.imageUrl && (
                        <Image
                          src={card.imageUrl}
                          alt={card.name}
                          fill
                          className={`object-contain ${
                            card.legality === "legal"
                              ? ""
                              : "border-4 border-red-500"
                          }`}
                        />
                      )}
                      <div
                        className="absolute bottom-[5%] left-1/2 -translate-x-1/2 px-3 py-1 rounded-sm text-2xl"
                        style={{
                          background: theme.counterBg,
                          color: theme.text,
                          border: `1px solid ${theme.rule}`,
                          fontWeight: 700,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                        }}
                      >
                        {card.count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {parsedDecklist.sideboard.length > 0 && (
              <div className="w-[200px]">
                <div
                  className="h-full p-2 overflow-hidden"
                  style={{
                    border: `1px solid ${theme.frameBorder}`,
                    background: theme.surfaceRaised,
                  }}
                >
                  <div className="flex h-full flex-col overflow-hidden">
                    {parsedDecklist.sideboard.reduce((acc, card) => {
                      const startIndex = acc.length;
                      return [
                        ...acc,
                        ...Array(card.count)
                          .fill(null)
                          .map((_, i) => (
                            <div
                              key={`sb-${card.name}-${startIndex + i}`}
                              className="relative first:mt-0 -mt-[115%] w-full aspect-[63/88]"
                              style={{ zIndex: startIndex + i }}
                            >
                              {card.imageUrl && (
                                <Image
                                  src={card.imageUrl}
                                  alt={card.name}
                                  fill
                                  className="object-contain"
                                />
                              )}
                            </div>
                          )),
                      ];
                    }, [] as JSX.Element[])}
                  </div>
                </div>
              </div>
            )}
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

          <div
            className="ml-auto"
            style={{
              fontFamily: FONT,
              fontSize: 10,
              fontWeight: 500,
              color: theme.muted,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
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
