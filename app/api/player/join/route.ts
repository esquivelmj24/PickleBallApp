import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { playerAccessRequiredResponse, requirePlayer } from "@/lib/auth";
import { getDb, type UserDoc } from "@/lib/db";
import { latestGameOwnerId } from "@/lib/games";
import { joinOwnerBoard } from "@/lib/player-pool";
import { serializePlayer } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await requirePlayer();
    if (!user) return playerAccessRequiredResponse();

    const db = await getDb();
    const userId = new ObjectId(user.id);
    const userDoc = await db.collection<UserDoc>("users").findOne({ _id: userId });

    if (!userDoc || userDoc.role !== "player" || !userDoc.rating || !userDoc.gender) {
      return jsonError(
        "Your player profile is incomplete. Register again with a rate and gender.",
        400,
      );
    }

    const ownerId = await latestGameOwnerId(db);
    if (!ownerId) {
      return jsonError(
        "No game is open to join yet. Wait for an admin to start the court board.",
        404,
      );
    }

    try {
      const result = await joinOwnerBoard(db, userDoc, ownerId);
      return NextResponse.json({
        ok: true,
        alreadyJoined: result.alreadyJoined,
        player: serializePlayer(result.player),
      });
    } catch (error) {
      if (error instanceof Error && error.message === "NAME_TAKEN") {
        return jsonError("That player name is already linked to another account.", 409);
      }
      throw error;
    }
  } catch (error) {
    console.error("POST /api/player/join failed", error);
    return jsonError("Could not join the game. Try again.", 500);
  }
}
