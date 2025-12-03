import { api } from "@/convex/_generated/api";
import { MatchOverlayWithPlayers, TournamentInfo } from "@/convex/types";
import { useQuery } from "convex/react";
import Timer from "@/components/timer";
import { MicIcon } from "lucide-react";

export default function MatchDefaultOverlay({
  data,
}: {
  data: MatchOverlayWithPlayers;
}) {
  const tournamentInfo = useQuery(api.tournaments.getTournamentInfo, {
    tournamentId: data.tournamentId,
  });
  if (!tournamentInfo) {
    return null;
  }
  return (
    <div className="w-[1920px] h-[1080px]">
      <MatchDefaultOverlayHeader data={data} tournamentInfo={tournamentInfo} />
      <MatchDefaultOverlayFooter tournamentInfo={tournamentInfo} />
    </div>
  );
}

export function MatchDefaultOverlayHeader({
  data,
  tournamentInfo,
}: {
  data: MatchOverlayWithPlayers;
  tournamentInfo: TournamentInfo;
}) {
  return (
    <div className="w-full h-[130px] absolute top-0">
      {/* Player 1 Life Total */}
      <div className="absolute left-[40px] mt-[-25px] text-center text-[110px] font-bold">
        {data.player1Life}
      </div>

      {/* Player 1 Info */}
      <div className="absolute left-[15%] flex h-full gap-4">
        <div className="flex h-full flex-col justify-between py-5">
          <div
            className={`size-10 rounded-full border-2 border-white ${
              data.player1GamesWon && data.player1GamesWon >= 1
                ? "bg-white"
                : "bg-transparent"
            }`}
          />
          <div
            className={`size-10 rounded-full border-2 border-white ${
              data.player1GamesWon && data.player1GamesWon >= 2
                ? "bg-white"
                : "bg-transparent"
            }`}
          />
        </div>
        <div className="flex flex-col">
          <div className="text-left text-[48px] font-semibold">
            {data.player1DisplayName || data.player1Data?.name || "Player 1"}
          </div>
          <div className="mt-[-16px] text-left flex text-[36px]">
            <span>
              {data.player1DisplayDeck ||
                data.player1Data?.deckName ||
                "Deck 1"}
            </span>
            <span className="ml-[24px] text-white/60">
              {data.player1TournamentRecord || "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Center Text */}
      <div className="absolute left-0 right-0 text-center text-[24px] pt-[8px]">
        {tournamentInfo?.currentRoundDisplayName || "N/A"}
      </div>
      <div className="absolute left-0 right-0 mt-auto mb-auto text-center font-bold text-[60px] pt-[28px]">
        <Timer tournamentInfo={tournamentInfo} />
      </div>

      {/* Player 2 Info */}
      <div className="absolute right-[15%] flex h-full gap-4">
        <div className="flex flex-col">
          <div className="text-right text-[48px] font-semibold">
            {data.player2DisplayName || data.player2Data?.name || "Player 2"}
          </div>
          <div className="mt-[-16px] text-right flex text-[36px]">
            <span className="mr-[24px] text-white/60">
              {data.player2TournamentRecord || "N/A"}
            </span>
            <span>
              {data.player2DisplayDeck ||
                data.player2Data?.deckName ||
                "Deck 2"}
            </span>
          </div>
        </div>

        <div className="flex h-full flex-col justify-between py-5">
          <div
            className={`size-10 rounded-full border-2 border-white ${
              data.player2GamesWon && data.player2GamesWon >= 1
                ? "bg-white"
                : "bg-transparent"
            }`}
          />
          <div
            className={`size-10 rounded-full border-2 border-white ${
              data.player2GamesWon && data.player2GamesWon >= 2
                ? "bg-white"
                : "bg-transparent"
            }`}
          />
        </div>
      </div>

      {/* Player 2 Life Total */}
      <div className="absolute right-[40px] mt-[-25px] text-center text-[110px] font-bold">
        {data.player2Life}
      </div>
    </div>
  );
}

function MatchDefaultOverlayFooter({
  tournamentInfo,
}: {
  tournamentInfo: TournamentInfo;
}) {
  return (
    <div className="w-full h-[70px] items-center flex absolute bottom-0 z-10">
      {/* Commentators */}
      {(tournamentInfo.commentatorLeft || tournamentInfo.commentatorRight) && (
        <div className="flex items-center gap-2 text-[24px] text-white/80 ml-[40px]">
          <span>
            <MicIcon className="size-6" />
          </span>
          {tournamentInfo.commentatorLeft && (
            <span>{tournamentInfo.commentatorLeft}</span>
          )}
          {tournamentInfo.commentatorLeft &&
            tournamentInfo.commentatorRight && (
              <span className="text-white/40">&</span>
            )}
          {tournamentInfo.commentatorRight && (
            <span>{tournamentInfo.commentatorRight}</span>
          )}
        </div>
      )}
    </div>
  );
}
