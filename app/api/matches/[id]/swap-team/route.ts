import { NextResponse } from "next/server";
import { getSessionUser, ownerObjectId, signInRequiredResponse } from "@/lib/auth";
import { getDb, type MatchDoc } from "@/lib/db";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return signInRequiredResponse();
    const { id } = await params;
    const matchId = new ObjectId(id);

    const body = await request.json();
    const playerId = body.playerId;

    if (!playerId) {
      return NextResponse.json({ error: "Player ID is required." }, { status: 400 });
    }

    const db = await getDb();
    const match = await db.collection<MatchDoc>("matches").findOne({ _id: matchId });

    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    if (match.status === "completed") {
      return NextResponse.json({ error: "Cannot swap teams in a completed match." }, { status: 400 });
    }

    const team1Player = match.team1.find((p) => p.playerId === playerId);
    const team2Player = match.team2.find((p) => p.playerId === playerId);

    if (!team1Player && !team2Player) {
      return NextResponse.json({ error: "Player not found in this match." }, { status: 400 });
    }

    let newTeam1 = [...match.team1];
    let newTeam2 = [...match.team2];

    if (team1Player) {
      const index = match.team1.findIndex((p) => p.playerId === playerId);
      const swapPlayer = match.team2[index];
      
      if (!swapPlayer) {
        return NextResponse.json({ error: "No matching teammate to swap with." }, { status: 400 });
      }

      newTeam1[index] = swapPlayer;
      newTeam2[index] = team1Player;
    } else if (team2Player) {
      const index = match.team2.findIndex((p) => p.playerId === playerId);
      const swapPlayer = match.team1[index];

      if (!swapPlayer) {
        return NextResponse.json({ error: "No matching teammate to swap with." }, { status: 400 });
      }

      newTeam2[index] = swapPlayer;
      newTeam1[index] = team2Player;
    }

    await db.collection("matches").updateOne(
      { _id: matchId },
      { 
        $set: { 
          team1: newTeam1, 
          team2: newTeam2, 
          updatedAt: new Date() 
        } 
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/matches/[id]/swap-team failed", error);
    return NextResponse.json({ error: "Could not swap teams. Try again." }, { status: 500 });
  }
}
