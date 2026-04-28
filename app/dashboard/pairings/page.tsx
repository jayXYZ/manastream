"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { filterPairingsByMinimumMatchPoints } from "@/convex/lib/pairingRankings";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/player-table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const emptyStateCopy = {
  no_tournament: {
    title: "No tournament found",
    body: "Create or load a tournament before reviewing pairings.",
  },
  no_spicerack_tournament: {
    title: "No Spicerack tournament linked",
    body: "Link a Spicerack tournament in settings to capture round pairings.",
  },
  no_current_round: {
    title: "No current round detected",
    body: "Pairings will appear after Spicerack publishes the next round.",
  },
  no_pairings: {
    title: "No pairings captured",
    body: "The current round is known, but no pairing snapshot has been captured yet.",
  },
} as const;

export default function PairingsPage() {
  const result = useQuery(api.pairings.getCurrentRoundPairings);
  const [minimumPointsInput, setMinimumPointsInput] = useState("");
  const minimumPointsThreshold = parseMinimumPointsInput(minimumPointsInput);
  const visiblePairings = useMemo(
    () =>
      filterPairingsByMinimumMatchPoints(
        result?.pairings ?? [],
        minimumPointsThreshold,
      ),
    [result?.pairings, minimumPointsThreshold],
  );

  if (result === undefined) {
    return <PairingsLoading />;
  }

  const roundLabel =
    result.roundName ?? (result.roundNumber ? `Round ${result.roundNumber}` : "");

  return (
    <div className="m-8 flex flex-col gap-4">
      <div className="flex flex-col gap-2 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Pairings</h1>
          <p className="text-sm text-muted-foreground">
            {roundLabel
              ? `${roundLabel} ranked by macro-archetype uniqueness.`
              : "Current round pairings ranked by macro-archetype uniqueness."}
          </p>
        </div>
        <div className="flex gap-6 text-sm">
          <Stat label="Captured" value={String(result.pairingCount)} />
          <Stat label="Showing" value={String(visiblePairings.length)} />
          <Stat label="Round" value={roundLabel || "N/A"} />
        </div>
      </div>

      {result.status === "ready" ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex flex-col gap-3 border-b border-border bg-background p-3 md:flex-row md:items-end md:justify-between">
            <div>
              <label
                htmlFor="minimum-points-threshold"
                className="text-sm font-medium"
              >
                Minimum points threshold
              </label>
              <p className="text-xs text-muted-foreground">
                Shows pairings where either player meets the threshold.
              </p>
            </div>
            <Input
              id="minimum-points-threshold"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="w-full md:w-36"
              placeholder="Any"
              value={minimumPointsInput}
              onChange={(event) => setMinimumPointsInput(event.target.value)}
            />
          </div>
          <div className="border-b border-border bg-background">
            <Table>
              <TableHeader className="[&_tr]:border-0">
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead className="w-16">Table</TableHead>
                  <TableHead>Player 1</TableHead>
                  <TableHead>Player 2</TableHead>
                  <TableHead>Macro Matchup</TableHead>
                  <TableHead className="w-24 text-right">Score</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>
          <ScrollArea className="h-[calc(100vh-396px)] rounded-b-lg">
            {visiblePairings.length > 0 ? (
              <Table>
                <TableBody>
                  {visiblePairings.map((pairing) => (
                    <TableRow key={pairing._id} className="hover:bg-muted/30">
                      <TableCell className="w-16 font-mono text-muted-foreground">
                        {pairing.rank}
                      </TableCell>
                      <TableCell className="w-16 font-mono">
                        {pairing.tableNumber ?? "N/A"}
                      </TableCell>
                      <TableCell>
                        <PlayerCell
                          name={pairing.player1Data?.name}
                          deck={pairing.player1Data?.deckName}
                          record={pairing.player1TournamentRecord}
                          points={pairing.player1TotalMatchPoints}
                        />
                      </TableCell>
                      <TableCell>
                        <PlayerCell
                          name={pairing.player2Data?.name}
                          deck={pairing.player2Data?.deckName}
                          record={pairing.player2TournamentRecord}
                          points={pairing.player2TotalMatchPoints}
                        />
                      </TableCell>
                      <TableCell>
                        <div
                          className={cn(
                            "max-w-[24rem] truncate text-sm",
                            !pairing.hasKnownDecks && "text-muted-foreground",
                          )}
                        >
                          {pairing.player1MacroArchetype &&
                          pairing.player2MacroArchetype
                            ? `${pairing.player1MacroArchetype} vs ${pairing.player2MacroArchetype}`
                            : "Unknown matchup"}
                        </div>
                      </TableCell>
                      <TableCell className="w-24 text-right font-mono">
                        {pairing.uniquenessScore ?? "N/A"}
                      </TableCell>
                      <TableCell className="w-28">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          {pairing.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">
                No pairings match the current points threshold.
              </div>
            )}
          </ScrollArea>
        </div>
      ) : (
        <PairingsEmptyState status={result.status} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function PlayerCell({
  name,
  deck,
  record,
  points,
}: {
  name?: string;
  deck?: string;
  record: string;
  points?: number;
}) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">{name ?? "Unknown player"}</div>
      <div className="truncate text-sm text-muted-foreground">
        {deck ?? "Unknown deck"}
        <span className="ml-2 font-mono">{record}</span>
        <span className="ml-2 font-mono">{points ?? "?"} pts</span>
      </div>
    </div>
  );
}

function parseMinimumPointsInput(value: string): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.max(0, Math.floor(parsed));
}

function PairingsLoading() {
  return (
    <div className="m-8 flex flex-col gap-4">
      <div className="flex items-end justify-between border-b border-border pb-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-96 max-w-[70vw]" />
        </div>
        <Skeleton className="h-12 w-48" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border p-4">
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

function PairingsEmptyState({
  status,
}: {
  status: keyof typeof emptyStateCopy;
}) {
  const copy = emptyStateCopy[status];

  return (
    <div className="rounded-lg border border-dashed border-border p-8">
      <div className="max-w-xl">
        <h2 className="text-lg font-semibold">{copy.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
      </div>
    </div>
  );
}
