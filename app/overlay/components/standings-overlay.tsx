import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { StandingsOverlay as StandingsOverlayType } from "@/convex/types";
import { useSearchParams } from "next/navigation";

const PAGE_SIZE = 16;

export default function StandingsOverlay({
  data,
}: {
  data: StandingsOverlayType;
}) {
  const standings = data.standingsDataWithPlayers ?? [];
  const searchParams = useSearchParams();
  const parsedPage = parseInt(searchParams.get("page") ?? "1", 10);
  const pageNumber =
    Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const startIndex = (pageNumber - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedStandings = standings.slice(startIndex, endIndex);

  const formatRecord = (wins: number, losses: number, draws: number) => {
    return `${wins}-${losses}${draws > 0 ? `-${draws}` : ""}`;
  };

  return (
    <div className="flex flex-col overflow-hidden text-white mt-[100px] mx-[15%]">
      <Table className="w-full h-full">
        <TableHeader>
          <TableRow className="h-12">
            <TableHead className="text-center text-3xl">Rank</TableHead>
            <TableHead className="text-center text-3xl">Name</TableHead>
            <TableHead className="text-center text-3xl">Deck</TableHead>
            <TableHead className="text-center text-3xl">Record</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedStandings.map((standing) => (
            <TableRow key={standing.player_id} className="h-10 border-0">
              <TableCell className="text-center text-3xl py-2">
                {standing.rank}
              </TableCell>
              <TableCell className="text-center text-3xl py-2">
                {standing.name}
              </TableCell>
              <TableCell className="text-center text-3xl py-2">
                {standing.playerData?.deckName ?? "N/A"}
              </TableCell>
              <TableCell className="text-center text-3xl py-2">
                {formatRecord(standing.wins, standing.losses, standing.draws)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
