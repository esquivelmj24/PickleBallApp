import { NextResponse } from "next/server";
import { jsonError, readBody } from "@/lib/api";
import { getDb, getMongoClient, type PlayerDoc } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONFIRMATION = "RESET";

/**
 * Resets the current game session without touching the roster or ratings.
 * Every saved match is removed and each player's session stats are zeroed so
 * the next setup starts a clean, fair queue.
 */
export async function DELETE(request: Request) {
  try {
    const body = await readBody(request);
    if (body.confirm !== CONFIRMATION) {
      return jsonError(`Type ${CONFIRMATION} to confirm resetting the game.`, 400);
    }

    const db = await getDb();
    const client = await getMongoClient();
    const session = client.startSession();
    const now = new Date();
    let deletedMatches = 0;
    let resetPlayers = 0;

    try {
      await session.withTransaction(async () => {
        const matches = await db
          .collection("matches")
          .deleteMany({}, { session });
        const players = await db.collection<PlayerDoc>("players").updateMany(
          {},
          {
            $set: {
              gamesPlayed: 0,
              wins: 0,
              losses: 0,
              pointsFor: 0,
              pointsAgainst: 0,
              lastPlayedAt: null,
              updatedAt: now,
            },
          },
          { session },
        );

        deletedMatches = matches.deletedCount ?? 0;
        resetPlayers = players.modifiedCount ?? 0;
      });
    } finally {
      await session.endSession();
    }

    return NextResponse.json({
      ok: true,
      players: resetPlayers,
      matches: deletedMatches,
    });
  } catch (error) {
    console.error("DELETE /api/reset/session failed", error);
    return jsonError("Could not reset the game. Try again.", 500);
  }
}
