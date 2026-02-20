import { CardOverlay as CardOverlayType } from "@/convex/types";
import Image from "next/image";

function CardDefaultOverlay({ data }: { data: CardOverlayType }) {
  return (
    <>
      <Image
        src={data.cardUrl}
        alt={"Card Image"}
        width={745}
        height={1040}
        className="w-full h-full object-contain"
        priority
      />
    </>
  );
}

export default CardDefaultOverlay;
