import { api } from "@/convex/_generated/api";
import { MatchOverlayWithPlayers } from "@/convex/types";
import { useQuery } from "convex/react";
import Timer from "@/components/timer";

export default function MatchLobsterconOverlay({
  data,
}: {
  data: MatchOverlayWithPlayers;
}) {
  const tournamentInfo = useQuery(api.tournaments.getTournamentInfo, {
    tournamentId: data.tournamentId,
  });
  return (
    <div className="text-[#fff] font-sans">
      <div className="h-[100px] absolute top-0 min-w-full">
        <div className="absolute left-[40px] text-[80px] text-center font-bold mt-[-20px]">
          {data.player1Life}
        </div>

        <div className="absolute right-[1285px]">
          <div className="text-[36px] text-right">
            {data.player1DisplayName || data.player1Data?.name || "Player 1"}
          </div>
          <div className="mt-[-16px] text-right">
            {(data.player1DisplayDeck || data.player1Data?.deckName) && (
              <>
                <span className="text-[24px] text-white/80">
                  {data.player1DisplayDeck || data.player1Data?.deckName}
                </span>
              </>
            )}
            {(data.player1DisplayDeck || data.player1Data?.deckName) &&
              (data.player1TournamentRecord || data.player1Data?.record) && (
                <>
                  <span className="text-[24px] font-bold text-[#1417c4] mx-[4px]">
                    {(data.player1DisplayDeck || data.player1Data?.deckName) &&
                    (data.player1TournamentRecord || data.player1Data?.record)
                      ? "|"
                      : ""}
                  </span>
                </>
              )}
            {(data.player1TournamentRecord || data.player1Data?.record) && (
              <>
                <span className="text-[24px] text-white/80">
                  {data.player1TournamentRecord ||
                    data.player1Data?.record ||
                    "0-0"}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="absolute left-[690px] top-[15px]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            width="84.5px"
            height="28.5px"
            transform="matrix(-1,0,0,1,0,0)"
          >
            <path
              fillRule="evenodd"
              stroke="rgb(255, 255, 255)"
              strokeWidth="2px"
              strokeLinecap="butt"
              strokeLinejoin="miter"
              fill={data.player1GamesWon >= 1 ? "rgb(0, 40, 255)" : "none"}
              d="M37.162,0.996 L82.289,0.996 L66.94,17.266 C60.984,22.401 52.696,26.563 47.584,26.563 L2.457,26.563 L18.651,10.293 C23.762,5.158 32.49,0.996 37.162,0.996 Z"
            />
          </svg>
        </div>
        <div className="absolute left-[725px] top-[50px]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            width="84.5px"
            height="28.5px"
            transform="matrix(-1,0,0,1,0,0)"
          >
            <path
              fillRule="evenodd"
              stroke="rgb(255, 255, 255)"
              strokeWidth="2px"
              strokeLinecap="butt"
              strokeLinejoin="miter"
              fill={data.player1GamesWon >= 2 ? "rgb(0, 40, 255)" : "none"}
              d="M37.162,0.996 L82.289,0.996 L66.94,17.266 C60.984,22.401 52.696,26.563 47.584,26.563 L2.457,26.563 L18.651,10.293 C23.762,5.158 32.49,0.996 37.162,0.996 Z"
            />
          </svg>
        </div>

        <div className="absolute left-0 right-0 text-center text-[24px]">
          {tournamentInfo?.currentRound || "Round 1"}
        </div>

        <div className="absolute left-0 right-0 mt-auto mb-auto text-center font-bold text-[56px] pt-[20px]">
          <Timer />
        </div>

        <div className="absolute right-[690px] top-[15px]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            width="84.5px"
            height="28.5px"
          >
            <path
              fillRule="evenodd"
              stroke="rgb(255, 255, 255)"
              strokeWidth="2px"
              strokeLinecap="butt"
              strokeLinejoin="miter"
              fill={data.player2GamesWon >= 1 ? "rgb(0, 40, 255)" : "none"}
              d="M37.162,0.996 L82.289,0.996 L66.94,17.266 C60.984,22.401 52.696,26.563 47.584,26.563 L2.457,26.563 L18.651,10.293 C23.762,5.158 32.49,0.996 37.162,0.996 Z"
            />
          </svg>
        </div>

        <div className="absolute right-[725px] top-[50px]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            width="84.5px"
            height="28.5px"
          >
            <path
              fillRule="evenodd"
              stroke="rgb(255, 255, 255)"
              strokeWidth="2px"
              strokeLinecap="butt"
              strokeLinejoin="miter"
              fill={data.player2GamesWon >= 2 ? "rgb(0, 40, 255)" : "none"}
              d="M37.162,0.996 L82.289,0.996 L66.94,17.266 C60.984,22.401 52.696,26.563 47.584,26.563 L2.457,26.563 L18.651,10.293 C23.762,5.158 32.49,0.996 37.162,0.996 Z"
            />
          </svg>
        </div>

        <div className="absolute left-[1285px]">
          <div className="text-[36px] text-left">
            {data.player2DisplayName || data.player2Data?.name || "Player 2"}
          </div>
          <div className="mt-[-16px]">
            {(data.player2DisplayDeck || data.player2Data?.deckName) && (
              <>
                <span className="text-[24px] text-white/80">
                  {data.player2DisplayDeck || data.player2Data?.deckName}
                </span>
              </>
            )}
            {(data.player2DisplayDeck || data.player2Data?.deckName) &&
              (data.player2TournamentRecord || data.player2Data?.record) && (
                <>
                  <span className="text-[24px] font-bold text-[#1417c4] mx-[4px]">
                    {(data.player2DisplayDeck || data.player2Data?.deckName) &&
                    (data.player2TournamentRecord || data.player2Data?.record)
                      ? "|"
                      : ""}
                  </span>
                </>
              )}
            {(data.player2TournamentRecord || data.player2Data?.record) && (
              <>
                <span className="text-[24px] text-white/80">
                  {data.player2TournamentRecord ||
                    data.player2Data?.record ||
                    "0-0"}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="text-[80px] text-center font-bold absolute right-[40px] mt-[-20px]">
          {data.player2Life}
        </div>
      </div>
    </div>
  );
}
