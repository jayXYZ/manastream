import Image from "next/image";
import type { JSX } from "react";
import { DeckTemplateProps } from "./deck-types";

export default function DeckDuressCrewOverlay({
  parsedDecklist,
  playerData,
}: DeckTemplateProps) {
  return (
    <div className="w-[1920px] h-[1080px] text-white p-4 overflow-hidden">
      <div className="h-full">
        <div className="mx-2">
          <span className="text-[48px] font-bold">{playerData.name}</span>
          <span className="text-[36px] font-thin px-2 text-white/80">
            {playerData.deckName}
          </span>
        </div>

        <div className="flex gap-4 h-[calc(1080px-100px)]">
          <div className="flex-1 h-full">
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
                  <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 bg-black bg-opacity-75 px-3 py-1 text-white font-bold text-2xl rounded">
                    {card.count}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {parsedDecklist.sideboard.length > 0 && (
            <div className="w-[200px]">
              <div className="flex flex-col">
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
          )}
        </div>
      </div>
    </div>
  );
}
