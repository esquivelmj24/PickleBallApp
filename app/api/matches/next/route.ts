import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { MAX_COURTS } from "@/lib/constants";
import { getDb, type MatchDoc, type PlayerDoc } from "@/lib/db";
import { buildRound, finishOrderPriority } from "@/lib/matchmaking";
import { serializeMatch } from "@/lib/serializers";
import type { MatchMode } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const db = await getDb();
    const matches = db.collection<MatchDoc>("matches");
    const latestMatch = await matches.find({}).sort({ createdAt: -1 }).limit(1).next();

    if (!latestMatch) {
      return jsonError("Build a rotation first before adding the next players.", 404);
    }

    const roundMatches = await matches.find({ roundId: latestMatch.roundId }).toArray();
    const uniqueCourts = new Set(roundMatches.map((match) => match.court));
    const singleCourtRound = uniqueCourts.size === 1;

    let targetCourt = 1;
    let queuePosition = 1;
    let queued = false;

    if (singleCourtRound) {
      targetCourt = [...uniqueCourts][0] ?? 1;
      const highestQueuePosition = roundMatches.reduce(
        (highest, match) => Math.max(highest, match.queuePosition ?? 1),
        0,
      );
      queuePosition = highestQueuePosition + 1;
      queued = true;
    } else {
      const nextCourt = Array.from({ length: MAX_COURTS }, (_, index) => index + 1).find(
        (court) => !uniqueCourts.has(court),
      );

      if (!nextCourt) {
        return jsonError(
          `This round already shows the maximum of ${MAX_COURTS} courts. Shuffle a new round to continue.`,
          409,
        );
      }

      targetCourt = nextCourt;
    }

    const mode: MatchMode = latestMatch.mode ?? "level";
    const lockedPlayerIds = new Set(
      roundMatches
        .filter((match) => match.status === "scheduled")
        .flatMap((match) => [...match.team1, ...match.team2])
        .map((player) => player.playerId.toString()),
    );

    const players = await db.collection<PlayerDoc>("players").find({}).toArray();
    const available = players.filter((player) => !lockedPlayerIds.has(player._id.toString()));

    if (available.length < 4) {
      return jsonError(
        `At least four available players are needed. ${available.length} ${
          available.length === 1 ? "player is" : "players are"
        } not already on an active court.`,
        409,
      );
    }

    // In multiple-court mode the next court also favors players who finished
    // first, then the waiting list. Single-court mode keeps its fair queue.
    const priorityOrder = singleCourtRound
      ? null
      : finishOrderPriority(roundMatches);
    const round = buildRound(available, 1, mode, priorityOrder);
    if (round.pairings.length === 0) {
      return jsonError(
        mode === "level"
          ? "No available rating band has four players. Finish the current court, then shuffle a new Open Rate round to mix levels."
          : "The next player group could not be built from the available players.",
        409,
      );
    }

    const now = new Date();
    const pairing = round.pairings[0];

    type NewMatchDoc = Omit<MatchDoc, "_id">;
    const doc: NewMatchDoc = {
      roundId: latestMatch.roundId,
      court: targetCourt,
      mode,
      queuePosition,
      status: "scheduled",
      team1: pairing.team1.map((player) => ({
        playerId: player._id,
        name: player.name,
        rating: player.rating,
      })),
      team2: pairing.team2.map((player) => ({
        playerId: player._id,
        name: player.name,
        rating: player.rating,
      })),
      team1Score: null,
      team2Score: null,
      winner: null,
      createdAt: now,
      completedAt: null,
      updatedAt: now,
    };

    const result = await matches.insertOne(doc as MatchDoc);
    const saved: MatchDoc = { ...doc, _id: result.insertedId };

    return NextResponse.json({
      match: serializeMatch(saved),
      court: targetCourt,
      queuePosition,
      queued,
      waiting: available.length - 4,
      mode,
    });
  } catch (error) {
    console.error("POST /api/matches/next failed", error);
    return jsonError("Could not add the next players.", 500);
  }
}
