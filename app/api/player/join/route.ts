import { MongoServerError, ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { jsonError, nameKey } from "@/lib/api";
import { playerAccessRequiredResponse, requirePlayer } from "@/lib/auth";
import { getDb, type PlayerDoc, type UserDoc } from "@/lib/db";
import { latestGameOwnerId } from "@/lib/games";
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

    const players = db.collection<PlayerDoc>("players");
    const existingAccountPlayer = await players.findOne({ userId });
    if (existingAccountPlayer) {
      return NextResponse.json({
        ok: true,
        alreadyJoined: true,
        player: serializePlayer(existingAccountPlayer),
      });
    }

    const ownerId = await latestGameOwnerId(db);
    if (!ownerId) {
      return jsonError(
        "No game is open to join yet. Wait for an admin to start the court board.",
        404,
      );
    }

    const now = new Date();
    const key = nameKey(userDoc.alias);
    const sameName = await players.findOne({ ownerId, nameKey: key });

    if (sameName) {
      if (sameName.userId && !sameName.userId.equals(userId)) {
        return jsonError("That player name is already linked to another account.", 409);
      }

      const updated = await players.findOneAndUpdate(
        { _id: sameName._id, ownerId },
        {
          $set: {
            userId,
            rating: userDoc.rating,
            gender: userDoc.gender,
            updatedAt: now,
          },
        },
        { returnDocument: "after" },
      );

      if (!updated) return jsonError("Could not join the game. Try again.", 500);

      return NextResponse.json({
        ok: true,
        alreadyJoined: false,
        player: serializePlayer(updated),
      });
    }

    const doc: Omit<PlayerDoc, "_id"> = {
      ownerId,
      userId,
      name: userDoc.alias,
      nameKey: key,
      rating: userDoc.rating,
      gender: userDoc.gender,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      lastPlayedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await players.insertOne(doc as PlayerDoc);
      return NextResponse.json(
        {
          ok: true,
          alreadyJoined: false,
          player: serializePlayer({ ...doc, _id: result.insertedId }),
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        const joined = await players.findOne({ userId });
        const nameMatch = joined ?? (await players.findOne({ ownerId, nameKey: key }));
        if (nameMatch) {
          return NextResponse.json({
            ok: true,
            alreadyJoined: true,
            player: serializePlayer(nameMatch),
          });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("POST /api/player/join failed", error);
    return jsonError("Could not join the game. Try again.", 500);
  }
}
