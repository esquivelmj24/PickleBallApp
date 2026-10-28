import { NextResponse } from "next/server";
import { jsonError, readBody } from "@/lib/api";
import { ownerObjectId, requireAdmin, unauthorizedResponse } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONFIRMATION = "RESET TOP 20";

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const ownerId = ownerObjectId(admin);

    const body = await readBody(request);
    if (body.confirm !== CONFIRMATION) {
      return jsonError(`Type ${CONFIRMATION} to confirm resetting the Top 20 win rates.`);
    }

    const db = await getDb();
    const players = await db.collection("players")
      .find({ ownerId })
      .toArray();

    if (players.length === 0) {
      return NextResponse.json({ ok: true, resetCount: 0 });
    }

    // Match the win-rate sorting logic from buildBoardState
    const sortedPlayers = [...players].sort((a, b) => {
      const aWR = a.gamesPlayed ? (a.wins / a.gamesPlayed) : 0;
      const bWR = b.gamesPlayed ? (b.wins / b.gamesPlayed) : 0;
      
      if (bWR !== aWR) return bWR - aWR;
      if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
      return a.name.localeCompare(b.name);
    });

    const top20 = sortedPlayers.slice(0, 20);
    const idsToReset = top20.map(p => p._id);

    const result = await db.collection("players").updateMany(
      { _id: { $in: idsToReset } },
      { 
        $set: { 
          wins: 0, 
          losses: 0, 
          gamesPlayed: 0, 
          pointsFor: 0, 
          pointsAgainst: 0, 
          updatedAt: new Date() 
        } 
      }
    );

    return NextResponse.json({
      ok: true,
      resetCount: result.modifiedCount,
      players: top20.map(p => p.name)
    });
  } catch (error) {
    console.error("DELETE /api/players/top-20/reset failed", error);
    return jsonError("Could not reset top 20 players. Try again.", 500);
  }
}
