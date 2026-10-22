import { NextResponse } from "next/server";
import { ownerObjectId, requireAdmin, unauthorizedResponse } from "@/lib/auth";
import { getDb, type MatchDoc, type PlayerDoc } from "@/lib/db";
import { advanceRoundIfComplete } from "@/lib/rounds";
import { levelCounts, rankPlayers, serializeMatch, serializePlayer } from "@/lib/serializers";
import type { AppState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const ownerId = ownerObjectId(admin);

    const db = await getDb();

    // Only the owner's visit may advance their queue. Other admins can never
    // see or change this session.
    try {
      await advanceRoundIfComplete(db, ownerId);
    } catch (error) {
      console.error("GET /api/state auto-advance failed", error);
    }

    const playersCollection = db.collection<PlayerDoc>("players");
    const matchesCollection = db.collection<MatchDoc>("matches");

    const [playerDocs, latestMatch, completedCount] = await Promise.all([
      playersCollection.find({ ownerId }).sort({ name: 1 }).toArray(),
      matchesCollection
        .find({ ownerId })
        .sort({ createdAt: -1 })
        .limit(1)
        .next(),
      matchesCollection.countDocuments({ ownerId, status: "completed" }),
    ]);

    const activeRoundMatches = latestMatch
      ? await matchesCollection
          .find({ ownerId, roundId: latestMatch.roundId })
          .sort({ court: 1, queuePosition: 1, createdAt: 1 })
          .toArray()
      : [];

    const recentDocs = latestMatch
      ? await matchesCollection
          .find({ ownerId, status: "completed", roundId: { $ne: latestMatch.roundId } })
          .sort({ completedAt: -1 })
          .limit(8)
          .toArray()
      : await matchesCollection
          .find({ ownerId, status: "completed" })
          .sort({ completedAt: -1 })
          .limit(8)
          .toArray();

    const players = playerDocs.map(serializePlayer);
    const tiers = levelCounts(players);
    const activeRound = latestMatch
      ? {
          roundId: latestMatch.roundId,
          mode: latestMatch.mode ?? "level",
          matches: activeRoundMatches.map(serializeMatch),
          scheduled: activeRoundMatches.filter((match) => match.status === "scheduled").length,
          completed: activeRoundMatches.filter((match) => match.status === "completed").length,
        }
      : null;

    const averageRating = players.length
      ? Math.round(
          (players.reduce((total, player) => total + player.rating, 0) / players.length) * 10,
        ) / 10
      : 0;

    const state: AppState = {
      players,
      activeRound,
      recentMatches: recentDocs.map(serializeMatch),
      topPlayers: rankPlayers(players).slice(0, 5),
      tiers,
      stats: {
        totalPlayers: players.length,
        completedMatches: completedCount,
        playersYetToPlay: players.filter((player) => player.gamesPlayed === 0).length,
        averageRating,
        gamesAvailable: tiers.reduce(
          (total, tier) => total + Math.floor(tier.count / 4),
          0,
        ),
      },
    };

    return NextResponse.json(state);
  } catch (error) {
    console.error("GET /api/state failed", error);
    return NextResponse.json(
      { error: "Could not load the court board. Check the MongoDB connection and try again." },
      { status: 500 },
    );
  }
}
