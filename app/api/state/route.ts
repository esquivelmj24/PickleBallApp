import { ObjectId, type Db } from "mongodb";
import { NextResponse } from "next/server";
import {
  getSessionUser,
  ownerObjectId,
  signInRequiredResponse,
  type SessionUser,
} from "@/lib/auth";
import { getDb, type MatchDoc, type PlayerDoc, type UserDoc } from "@/lib/db";
import { latestGameOwnerId } from "@/lib/games";
import { advanceRoundIfComplete } from "@/lib/rounds";
import { levelCounts, rankPlayers, serializeMatch, serializePlayer } from "@/lib/serializers";
import type { AppState, Viewer } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function buildBoardState(db: Db, ownerId: ObjectId, viewer: Viewer): Promise<AppState> {
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

  return {
    viewer,
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
}

function emptyBoardState(viewer: Viewer): AppState {
  return {
    viewer,
    players: [],
    activeRound: null,
    recentMatches: [],
    topPlayers: [],
    tiers: levelCounts([]),
    stats: {
      totalPlayers: 0,
      completedMatches: 0,
      playersYetToPlay: 0,
      averageRating: 0,
      gamesAvailable: 0,
    },
  };
}

async function buildPlayerState(db: Db, user: SessionUser): Promise<AppState> {
  const userId = new ObjectId(user.id);
  const [userDoc, playerDoc] = await Promise.all([
    db.collection<UserDoc>("users").findOne({ _id: userId }),
    db.collection<PlayerDoc>("players").findOne({ userId }),
  ]);

  const ownerId = playerDoc?.ownerId ?? (await latestGameOwnerId(db));

  if (!ownerId) {
    return emptyBoardState({
      role: "player",
      alias: user.alias,
      rating: userDoc?.rating,
      gender: userDoc?.gender,
      joined: false,
      canJoin: false,
      message: "No game is open yet. Wait for an admin to start the court board.",
    });
  }

  const owner = await db.collection<UserDoc>("users").findOne({ _id: ownerId });
  const joined = Boolean(playerDoc && playerDoc.ownerId.equals(ownerId));
  const hasProfile = Boolean(userDoc?.rating && userDoc.gender);

  const viewer: Viewer = {
    role: "player",
    alias: user.alias,
    rating: userDoc?.rating,
    gender: userDoc?.gender,
    joined,
    canJoin: !joined && hasProfile,
    playerId: joined ? playerDoc!._id.toString() : undefined,
    boardOwnerAlias: owner?.alias,
    message: joined
      ? "You are on the roster. The admin manages teams, scores, and game settings."
      : hasProfile
        ? "Join to add your registered alias and rate to the player pool."
        : "Your player profile is incomplete. Register again to add a rate and gender.",
  };

  return buildBoardState(db, ownerId, viewer);
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return signInRequiredResponse();

    const db = await getDb();

    if (user.role === "player") {
      return NextResponse.json(await buildPlayerState(db, user));
    }

    const ownerId = ownerObjectId(user);

    // Only the owner's visit may advance their queue. Other admins can never
    // see or change this session.
    try {
      await advanceRoundIfComplete(db, ownerId);
    } catch (error) {
      console.error("GET /api/state auto-advance failed", error);
    }

    const state = await buildBoardState(db, ownerId, {
      role: "admin",
      alias: user.alias,
      joined: false,
      canJoin: false,
    });

    return NextResponse.json(state);
  } catch (error) {
    console.error("GET /api/state failed", error);
    return NextResponse.json(
      { error: "Could not load the court board. Check the MongoDB connection and try again." },
      { status: 500 },
    );
  }
}
