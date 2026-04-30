import { CardOverlay as CardOverlayType } from "@/convex/types";
import { getBraunDarkPalette } from "@/lib/braun-dark-palettes";
import Image from "next/image";

const BEZEL_BORDER = 1;
const BEZEL_PAD = 5;

function CardBraunDarkOverlay({ data }: { data: CardOverlayType }) {
  const theme = getBraunDarkPalette(data.braunDarkPalette);

  return (
    <div
      style={{
        display: "inline-block",
        padding: BEZEL_PAD,
        border: `${BEZEL_BORDER}px solid ${theme.frameBorder}`,
        background: "transparent",
        boxSizing: "border-box",
      }}
    >
      <Image
        src={data.cardUrl}
        alt={"Card Image"}
        width={745}
        height={1040}
        className="w-full h-full object-contain"
        style={{ display: "block" }}
        priority
      />
    </div>
  );
}

export default CardBraunDarkOverlay;
