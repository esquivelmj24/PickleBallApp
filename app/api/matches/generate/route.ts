import { NextResponse } from "next/server";
import { jsonError, readBody } from "@/lib/api";
import { ownerObjectId, requireAdmin, unauthorizedResponse } from "@/lib/auth";
import { MAX_COURTS } from "@/lib/constants";
import { getDb, type MatchDoc, type PlayerDoc } from "@/lib/db";
import { buildRound, finishOrderPriority, levelCourtCapacity } from "@/lib/matchmaking";
import { serializeMatch } from "@/lib/serializers";
import type { CourtLayout, MatchMode } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const ownerId = ownerObjectId(admin);

    const body = await readBody(request);
    const db = await getDb();
    const matchesCollection = db.collection<MatchDoc>("matches");
    const players = await db
      .collection<PlayerDoc>("players")
      .find({ ownerId })
      .toArray();

    if (players.length < 4) {
      return jsonError("Add at least four players before building a rotation.");
    }

    const pending = await matchesCollection.countDocuments({ ownerId, status: "scheduled" });
    if (pending > 0) {
      return jsonError(
        "Enter the result for the current court before shuffling. The next players are already waiting.",
        409,
      );
    }

    const mode: MatchMode = body.mode === "open" ? "open" : "level";
    const capacity = mode === "open" ? Math.floor(players.length / 4) : levelCourtCapacity(players);

    if (capacity < 1) {
      return jsonError(
        "No rating group has four players yet. Switch to the Open rate tab to shuffle players across levels.",
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

    const courtCount = Math.min(requestedCourts, capacity, MAX_COURTS);
    const layout: CourtLayout =
      body.layout === "multiple" || body.layout === "single"
        ? body.layout
        : courtCount === 1
          ? "single"
          : "multiple";

    // Single Court uses a short queue: the active lineup is shown as Court and
    // the next group as Next Player. Multiple Courts create one active lineup
    // per physical court instead.
    const usesQueue = layout === "single";
    const lineupCount = usesQueue ? Math.min(capacity, 2) : courtCount;

    // Multiple-court shuffle priority: players who finished their last game
    // first, then players who were waiting. Single-court mode keeps the normal
    // fair-play queue order.
    let priorityOrder: Map<string, number> | null = null;
    if (!usesQueue) {
      const latestMatch = await matchesCollection
        .find({ ownerId })
        .sort({ createdAt: -1 })
        .limit(1)
        .next();
      if (latestMatch) {
        const previousMatches = await matchesCollection
          .find({ ownerId, roundId: latestMatch.roundId })
          .toArray();
        priorityOrder = finishOrderPriority(previousMatches);
      }
    }

    // Completed matches teach the shuffle which partnerships and opponent
    // pairings have already happened, so the next round rotates away from them.
    const history = await matchesCollection
      .find({ ownerId, status: "completed" })
      .toArray();

    const round = buildRound(players, lineupCount, mode, priorityOrder, history);

    if (round.pairings.length === 0) {
      return jsonError(
        "No playable lineup could be built. Check the roster and try again.",
        409,
      );
    }

    const now = new Date();

    // Re-shuffling replaces the previous unplayed rotation. Completed matches
    // stay intact so player records and the leaderboard are never lost.
    await matchesCollection.deleteMany({ ownerId, status: "scheduled" });

    type NewMatchDoc = Omit<MatchDoc, "_id">;
    const docs: NewMatchDoc[] = round.pairings.map((pairing, index) => ({
      ownerId,
      roundId: round.roundId,
      court: usesQueue ? 1 : pairing.court,
      mode,
      queuePosition: usesQueue ? index + 1 : 1,
      status: "scheduled",
      team1: pairing.team1.map((player) => ({
        playerId: player._id,
        name: player.name,
        rating: player.rating,
        isNR: Boolean(player.isNR),
      })),
      team2: pairing.team2.map((player) => ({
        playerId: player._id,
        name: player.name,
        rating: player.rating,
        isNR: Boolean(player.isNR),
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
      layout,
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
