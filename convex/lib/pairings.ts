import { Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import {
  parseCurrentSpicerackRound,
  parsePlayerSeed,
  parsePlayerTournamentRecord,
} from "../models/spicerack";
import { SpicerackEventResponse, SpicerackMatch } from "../types/spicerack";
import { createPendingPlayerEntry, createPlayer } from "./players";
import { getPlayerData } from "./playerData";

type SnapshotCurrentRoundPairingsArgs = {
  tournamentId: Id<"tournaments">;
  spicerackTournamentId: number;
  jsonData: SpicerackEventResponse;
};

type CurrentRoundPairingsFilter = {
  spicerackRoundId?: number;
  roundNumber?: number;
};

export async function getCurrentRoundPairingsWithPlayerData(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
  filter: CurrentRoundPairingsFilter,
) {
  const pairings =
    filter.spicerackRoundId != null
      ? (
          await ctx.db
            .query("pairings")
            .withIndex("by_spicerack_round", (q) =>
              q.eq("spicerackRoundId", filter.spicerackRoundId!),
            )
            .collect()
        ).filter((pairing) => pairing.tournamentId === tournamentId)
      : filter.roundNumber != null
        ? await ctx.db
            .query("pairings")
            .withIndex("by_tournament_and_round", (q) =>
              q
                .eq("tournamentId", tournamentId)
                .eq("roundNumber", filter.roundNumber!),
            )
            .collect()
        : [];

  return await Promise.all(
    pairings.map(async (pairing) => {
      const [player1Data, player2Data] = await Promise.all([
        ctx.db.get(pairing.player1),
        ctx.db.get(pairing.player2),
      ]);
      return {
        ...pairing,
        player1Data: player1Data
          ? await getPlayerData(ctx, player1Data)
          : undefined,
        player2Data: player2Data
          ? await getPlayerData(ctx, player2Data)
          : undefined,
      };
    }),
  );
}

export async function snapshotCurrentRoundPairings(
  ctx: MutationCtx,
  args: SnapshotCurrentRoundPairingsArgs,
): Promise<void> {
  const currentRound = parseCurrentSpicerackRound(args.jsonData);
  if (!currentRound || currentRound.matches.length === 0) {
    return;
  }

  for (const match of currentRound.matches) {
    const relationships = getOrderedPlayerRelationships(match);
    if (relationships.length !== 2) {
      continue;
    }

    const externalId = generatePairingExternalId({
      spicerackTournamentId: args.spicerackTournamentId,
      spicerackRoundId: currentRound.id,
      spicerackMatchId: match.id,
    });
    const existingPairing = await ctx.db
      .query("pairings")
      .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
      .first();
    if (existingPairing) {
      continue;
    }

    const [player1Relationship, player2Relationship] = relationships;
    const [player1, player2] = await Promise.all([
      getOrCreatePairingPlayer(ctx, {
        spicerackTournamentId: args.spicerackTournamentId,
        relationship: player1Relationship,
      }),
      getOrCreatePairingPlayer(ctx, {
        spicerackTournamentId: args.spicerackTournamentId,
        relationship: player2Relationship,
      }),
    ]);

    await ctx.db.insert("pairings", {
      externalId,
      spicerackTournamentId: args.spicerackTournamentId,
      tournamentId: args.tournamentId,
      spicerackRoundId: currentRound.id,
      roundNumber: currentRound.round_number,
      spicerackMatchId: match.id,
      player1,
      player2,
      player1TournamentRecord: parsePlayerTournamentRecord(
        args.jsonData,
        player1Relationship.user_event_status,
      ),
      player2TournamentRecord: parsePlayerTournamentRecord(
        args.jsonData,
        player2Relationship.user_event_status,
      ),
      player1Seed: parsePlayerSeed(player1Relationship.user_event_status),
      player2Seed: parsePlayerSeed(player2Relationship.user_event_status),
      player1TotalMatchPoints:
        player1Relationship.user_event_status.total_match_points,
      player2TotalMatchPoints:
        player2Relationship.user_event_status.total_match_points,
      tableNumber: match.table_number > 0 ? match.table_number : undefined,
      status: match.status,
      createdAt: Date.now(),
    });
  }
}

function generatePairingExternalId(args: {
  spicerackTournamentId: number;
  spicerackRoundId: number;
  spicerackMatchId: number;
}): string {
  return `pairing:${args.spicerackTournamentId}:${args.spicerackRoundId}:${args.spicerackMatchId}`;
}

async function getOrCreatePairingPlayer(
  ctx: MutationCtx,
  args: {
    spicerackTournamentId: number;
    relationship: SpicerackMatch["player_match_relationships"][number];
  },
): Promise<Id<"players">> {
  const spicerackPlayerId = args.relationship.user_event_status.id;
  const existingPlayer = await ctx.db
    .query("players")
    .withIndex("by_spicerack_player_id", (q) =>
      q.eq("spicerackPlayerId", spicerackPlayerId),
    )
    .first();

  if (existingPlayer) {
    return existingPlayer._id;
  }

  return await createPlayer(
    ctx,
    args.spicerackTournamentId,
    createPendingPlayerEntry(
      spicerackPlayerId,
      args.relationship.user_event_status.user.best_identifier,
      args.spicerackTournamentId,
      args.relationship.user_event_status.decklist,
    ),
  );
}

function getOrderedPlayerRelationships(match: SpicerackMatch) {
  return [...match.player_match_relationships].sort((a, b) => {
    if (a.player_order < 0 || b.player_order < 0) {
      return 0;
    }
    return a.player_order - b.player_order;
  });
}
