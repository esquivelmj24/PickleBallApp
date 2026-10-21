import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { isValidScore, jsonError, readBody } from "@/lib/api";
import { getDb, getMongoClient, type MatchDoc, type MatchPlayerDoc, type PlayerDoc } from "@/lib/db";
import { advanceRoundIfComplete } from "@/lib/rounds";
import { serializeMatch } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type ScoreSnapshot = {
  team1: MatchPlayerDoc[];
  team2: MatchPlayerDoc[];
  team1Score: number;
  team2Score: number;
};

function scoreIncrements(
  snapshot: ScoreSnapshot,
  multiplier: 1 | -1,
  touchLastPlayed: boolean,
  now: Date,
) {
  const team1Won = snapshot.team1Score > snapshot.team2Score;

  return [...snapshot.team1, ...snapshot.team2].map((player) => {
    const isTeam1 = snapshot.team1.some(
      (teammate) => teammate.playerId.toString() === player.playerId.toString(),
    );
    const won = isTeam1 ? team1Won : !team1Won;
    const ownScore = isTeam1 ? snapshot.team1Score : snapshot.team2Score;
    const opponentScore = isTeam1 ? snapshot.team2Score : snapshot.team1Score;

    return {
      updateOne: {
        filter: { _id: player.playerId },
        update: {
          $inc: {
            gamesPlayed: multiplier,
            wins: (won ? 1 : 0) * multiplier,
            losses: (won ? 0 : 1) * multiplier,
            pointsFor: ownScore * multiplier,
            pointsAgainst: opponentScore * multiplier,
          },
          ...(touchLastPlayed ? { $set: { lastPlayedAt: now } } : {}),
        },
      },
    };
  });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid match id.");

    const body = await readBody(request);
    if (!isValidScore(body.team1Score) || !isValidScore(body.team2Score)) {
      return jsonError("Enter a whole-number score between 0 and 99 for both teams.");
    }
    if (body.team1Score === body.team2Score) {
      return jsonError("A completed pickleball match needs a winner — tied scores are not allowed.");
    }

    const matchId = new ObjectId(id);
    const team1Score = body.team1Score;
    const team2Score = body.team2Score;
    const client = await getMongoClient();
    const db = await getDb();
    const session = client.startSession();
    let updatedMatch: MatchDoc | null = null;

    try {
      await session.withTransaction(async () => {
        const matches = db.collection<MatchDoc>("matches");
        const players = db.collection<PlayerDoc>("players");
        const match = await matches.findOne({ _id: matchId }, { session });
        if (!match) throw new Error("NOT_FOUND");

        if (match.status === "scheduled") {
          const earlierScheduled = await matches.findOne(
            {
              roundId: match.roundId,
              court: match.court,
              status: "scheduled",
              queuePosition: { $lt: match.queuePosition ?? 1 },
            },
            { session },
          );
          if (earlierScheduled) throw new Error("QUEUED");
        }

        const now = new Date();

        if (match.status === "completed" && match.team1Score !== null && match.team2Score !== null) {
          await players.bulkWrite(
            scoreIncrements(
              {
                team1: match.team1,
                team2: match.team2,
                team1Score: match.team1Score,
                team2Score: match.team2Score,
              },
              -1,
              false,
              now,
            ),
            { session },
          );
        }

        await players.bulkWrite(
          scoreIncrements(
            { team1: match.team1, team2: match.team2, team1Score, team2Score },
            1,
            true,
            now,
          ),
          { session },
        );

        updatedMatch = await matches.findOneAndUpdate(
          { _id: matchId },
          {
            $set: {
              status: "completed",
              team1Score,
              team2Score,
              winner: team1Score > team2Score ? 1 : 2,
              completedAt: match.completedAt ?? now,
              updatedAt: now,
            },
          },
          { returnDocument: "after", session },
        );
      });
    } finally {
      await session.endSession();
    }

    if (!updatedMatch) return jsonError("Match not found.", 404);

    // Once the last court is scored, the next queue is built automatically.
    // The score is already committed, so an advance failure must not fail it.
    try {
      await advanceRoundIfComplete(db);
    } catch (error) {
      console.error("POST /api/matches/[id]/score auto-advance failed", error);
    }

    return NextResponse.json(serializeMatch(updatedMatch));
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Match not found.", 404);
    }
    if (error instanceof Error && error.message === "QUEUED") {
      return jsonError(
        "Finish the current court before scoring the Next Player group.",
        409,
      );
    }
    console.error("POST /api/matches/[id]/score failed", error);
    return jsonError("Could not save the score.", 500);
  }
}
