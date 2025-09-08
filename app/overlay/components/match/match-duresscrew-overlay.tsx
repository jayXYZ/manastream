import { api } from "@/convex/_generated/api";
import { MatchOverlayWithPlayers } from "@/convex/types";
import { useQuery } from "convex/react";
import Timer from "@/components/timer";

export default function MatchDuressCrewOverlay({
  data,
}: {
  data: MatchOverlayWithPlayers;
}) {
  const tournamentInfo = useQuery(api.tournaments.getTournamentInfo, {
    tournamentId: data.tournamentId,
  });
  return (
    <div className="text-[#fff]">
      <div className="h-[130px] absolute top-0 min-w-full">
        <div className="absolute left-[40px] text-[100px] text-center font-bold mt-[-20px]">
          {data.player1Life}
        </div>

        <div className="absolute right-[61%]">
          <div className="text-[48px] text-right">
            {data.player1DisplayName || data.player1Data?.name || "Player 1"}
          </div>
          <div className="mt-[-16px] text-right">
            <span className="text-[36px] text-white/60 mr-[24px]">
              {data.player1TournamentRecord ||
                data.player1Data?.record ||
                "0-0"}
            </span>
            <span className="text-[36px] text-[#C6AD65]">
              {data.player1DisplayDeck ||
                data.player1Data?.deckName ||
                "Deck 1"}
            </span>
          </div>
        </div>

        <div
          className={
            "absolute left-[778px] top-[7px] w-[54px] h-[50px] [clip-path:polygon(29px_50px,0px_0px,25px_0px,54px_50px)] " +
            (data.player1GamesWon >= 1 ? "bg-[#E0DDDD]" : "")
          }
        ></div>
        <div
          className={
            "absolute left-[811px] top-[63px] w-[54px] h-[50px] [clip-path:polygon(29px_50px,0px_0px,25px_0px,54px_50px)] " +
            (data.player1GamesWon >= 2 ? "bg-[#E0DDDD]" : "")
          }
        ></div>

        <div className="absolute left-0 right-0 text-center text-[24px] pt-[8px]">
          {tournamentInfo?.currentRound || "Round 1"}
        </div>
        <div className="absolute left-0 right-0 mt-auto mb-auto text-center font-bold text-[60px] pt-[28px]">
          <Timer />
        </div>

        <div
          className={
            "absolute left-[1087px] top-[7px] w-[54px] h-[50px] [clip-path:polygon(0px_50px,29px_0px,54px_0px,25px_50px)] " +
            (data.player2GamesWon >= 1 ? "bg-[#E0DDDD]" : "")
          }
        ></div>
        <div
          className={
            "absolute left-[1055px] top-[63px] w-[54px] h-[50px] [clip-path:polygon(0px_50px,29px_0px,54px_0px,25px_50px)] " +
            (data.player2GamesWon >= 2 ? "bg-[#E0DDDD]" : "")
          }
        ></div>

        <div className="absolute left-[61%]">
          <div className="text-[48px] text-left">
            {data.player2DisplayName || data.player2Data?.name || "Player 2"}
          </div>
          <div className="mt-[-16px]">
            <span className="text-[36px] text-[#C6AD65]">
              {data.player2DisplayDeck ||
                data.player2Data?.deckName ||
                "Deck 2"}
            </span>
            <span className="text-[36px] text-white/60 ml-[24px]">
              {data.player2TournamentRecord ||
                data.player2Data?.record ||
                "0-0"}
            </span>
          </div>
        </div>

        <div className="text-[100px] text-center font-bold absolute right-[40px] mt-[-20px]">
          {data.player2Life}
        </div>
      </div>

      <div className="h-[60px] absolute bottom-0 min-w-full">
        {/* <div className="absolute left-[20px] bottom-[15px] text-[32px]">
              Commentators:{" "}
              {typeof data.commentators === "string" ? data.commentators : "N/A"}
            </div> */}
        {/* <div className="absolute right-[20px] bottom-[15px] text-[32px] text-right">
              {typeof data.round === "string" ? data.round : "N/A"} |{" "}
              {typeof data.format === "string" ? data.format : "N/A"} |{" "}
              {typeof data.event === "string" ? data.event : "N/A"}
            </div> */}
      </div>
    </div>
  );
}
