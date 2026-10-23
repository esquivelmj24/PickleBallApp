import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { jsonError, readBody } from "@/lib/api";
import { ownerObjectId, requireAdmin, unauthorizedResponse } from "@/lib/auth";
import { getDb, type MatchDoc, type MatchPlayerDoc, type PlayerDoc } from "@/lib/db";
import { serializeMatch } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function parseLineup(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  if (!value.every((item) => typeof item === "string" && ObjectId.isValid(item))) return null;
  return value as string[];
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const ownerId = ownerObjectId(admin);

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid match id.");

    const body = await readBody(request);
    const team1Ids = parseLineup(body.team1);
    const team2Ids = parseLineup(body.team2);
    if (!team1Ids || !team2Ids) {
      return jsonError("Each team must have exactly two valid players.");
    }

    const allIds = [...team1Ids, ...team2Ids];
    if (new Set(allIds).size !== 4) {
      return jsonError("A player can only appear once on a court.");
    }

    const matchId = new ObjectId(id);
    const db = await getDb();
    const matches = db.collection<MatchDoc>("matches");
    const match = await matches.findOne({ _id: matchId, ownerId });
    if (!match) return jsonError("Match not found.", 404);
    if (match.status !== "scheduled") {
      return jsonError("Completed matches cannot be edited. Update the score instead.", 409);
    }

    const queuedAhead = await matches.findOne({
      ownerId,
      roundId: match.roundId,
      court: match.court,
      status: "scheduled",
      queuePosition: { $lt: match.queuePosition ?? 1 },
    });
    if (queuedAhead) {
      return jsonError(
        "The next lineup is locked until the current court result is saved.",
        409,
      );
    }

    const playerIds = allIds.map((playerId) => new ObjectId(playerId));
    const players = await db
      .collection<PlayerDoc>("players")
      .find({ _id: { $in: playerIds }, ownerId })
      .toArray();

    if (players.length !== 4) {
      return jsonError("One or more selected players are no longer on the roster.");
    }

    const conflict = await matches.findOne({
      ownerId,
      _id: { $ne: matchId },
      status: "scheduled",
      $or: [
        { "team1.playerId": { $in: playerIds } },
        { "team2.playerId": { $in: playerIds } },
      ],
    });
    if (conflict) {
      return jsonError("That player is already assigned to another lineup in this rotation.", 409);
    }

    const playerMap = new Map(players.map((player) => [player._id.toString(), player]));
    const toSnapshot = (playerId: string): MatchPlayerDoc => {
      const player = playerMap.get(playerId)!;
      return {
        playerId: player._id,
        name: player.name,
        rating: player.rating,
        isNR: Boolean(player.isNR),
      };
    };

    const updated = await matches.findOneAndUpdate(
      { _id: matchId, ownerId },
      {
        $set: {
          team1: team1Ids.map(toSnapshot),
          team2: team2Ids.map(toSnapshot),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );

    if (!updated) return jsonError("Could not update the lineup.", 500);
    return NextResponse.json(serializeMatch(updated));
  } catch (error) {
    console.error("PATCH /api/matches/[id] failed", error);
    return jsonError("Could not update the lineup.", 500);
  }
}
