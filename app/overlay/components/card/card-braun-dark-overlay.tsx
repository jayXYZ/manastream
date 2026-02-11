import { CardOverlay as CardOverlayType } from "@/convex/types";
import Image from "next/image";

const BEZEL_BORDER = 1;
const BEZEL_PAD = 5;
const FRAME_BORDER_COLOR = "#8A8378";

function CardBraunDarkOverlay({ data }: { data: CardOverlayType }) {
  return (
    <div
      style={{
        display: "inline-block",
        padding: BEZEL_PAD,
        border: `${BEZEL_BORDER}px solid ${FRAME_BORDER_COLOR}`,
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
