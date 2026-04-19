import { api } from "@/convex/_generated/api";
import { MatchOverlayWithPlayers } from "@/convex/types";
import { useQuery } from "convex/react";
import Timer from "@/components/timer";
import Image from "next/image";

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

export default function MatchLC26Overlay({
  data,
}: {
  data: MatchOverlayWithPlayers;
}) {
  const tournamentInfo = useQuery(api.tournaments.getTournamentInfo, {
    tournamentId: data.tournamentId,
  });
  if (!tournamentInfo) return null;

  return (
    <div>
      <Image
        src="/images/overlays/lc26/blue.png"
        alt="LC26 Overlay Background"
        width={1920}
        height={1080}
      />
    </div>
  );
}
