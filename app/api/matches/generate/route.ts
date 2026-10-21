import { NextResponse } from "next/server";
import { jsonError, readBody } from "@/lib/api";
import { getDb, type MatchDoc, type PlayerDoc } from "@/lib/db";
import { buildRound, levelCourtCapacity } from "@/lib/matchmaking";
import { serializeMatch } from "@/lib/serializers";
import type { MatchMode } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const db = await getDb();
    const players = await db
      .collection<PlayerDoc>("players")
      .find({})
      .toArray();

    if (players.length < 4) {
      return jsonError("Add at least four players before building a rotation.");
    }

    const mode: MatchMode = body.mode === "open" ? "open" : "level";
    const capacity = mode === "open" ? Math.floor(players.length / 4) : levelCourtCapacity(players);

    if (capacity < 1) {
      return jsonError(
        "No rating band has four players yet. Switch to the Open rate tab to shuffle players across levels.",
        409,
      );
    }

    let requestedCourts = 2;
    if (body.courts === "auto") {
      requestedCourts = capacity;
    } else if (typeof body.courts === "number") {
      requestedCourts = Math.floor(body.courts);
    }

    if (requestedCourts < 1) {
      return jsonError("Choose at least one court.");
    }

    const courtCount = Math.min(requestedCourts, capacity);

    // A single physical court uses a queue: every available lineup is scheduled
    // for Court 1 as "Next lineup" instead of inventing Court 2, Court 3, etc.
    const usesQueue = courtCount === 1;
    const lineupCount = usesQueue ? capacity : courtCount;
    const round = buildRound(players, lineupCount, mode);

    if (round.pairings.length === 0) {
      return jsonError(
        "No playable lineup could be built. Check the roster and try again.",
        409,
      );
    }

    const now = new Date();

    // Re-shuffling replaces the previous unplayed rotation. Completed matches
    // stay intact so player records and the leaderboard are never lost.
    await db.collection("matches").deleteMany({ status: "scheduled" });

    type NewMatchDoc = Omit<MatchDoc, "_id">;
    const docs: NewMatchDoc[] = round.pairings.map((pairing, index) => ({
      roundId: round.roundId,
      court: usesQueue ? 1 : pairing.court,
      mode,
      queuePosition: usesQueue ? index + 1 : 1,
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
    }));

    const result = await db.collection<NewMatchDoc>("matches").insertMany(docs);
    const saved: MatchDoc[] = docs.map((doc, index) => ({
      ...doc,
      _id: result.insertedIds[index],
    }));

    return NextResponse.json({
      roundId: round.roundId,
      mode,
      courts: courtCount,
      queued: usesQueue ? Math.max(0, docs.length - 1) : 0,
      matches: saved.map(serializeMatch),
      waiting: players.length - round.pairings.length * 4,
    });
  } catch (error) {
    console.error("POST /api/matches/generate failed", error);
    return jsonError("Could not build a new rotation.", 500);
  }
}
