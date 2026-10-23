import { MongoServerError, ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { playerAccessRequiredResponse, requirePlayer } from "@/lib/auth";
import { getDb, type RosterDoc, type RosterEntryDoc, type UserDoc } from "@/lib/db";
import { joinOwnerBoard } from "@/lib/player-pool";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requirePlayer();
    if (!user) return playerAccessRequiredResponse();

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid roster id.", 400);

    const userId = new ObjectId(user.id);
    const rosterId = new ObjectId(id);
    const db = await getDb();
    const [userDoc, roster] = await Promise.all([
      db.collection<UserDoc>("users").findOne({ _id: userId }),
      db.collection<RosterDoc>("rosters").findOne({ _id: rosterId }),
    ]);

    if (!userDoc || userDoc.role !== "player") {
      return playerAccessRequiredResponse();
    }
    if (!userDoc.rating || !userDoc.gender) {
      return jsonError(
        "Your player profile is incomplete. Register again with a rate and gender.",
        400,
      );
    }
    if (!roster) return jsonError("That roster no longer exists.", 404);
    if (roster.endedAt) {
      return jsonError("This roster has ended and is no longer accepting players.", 409);
    }

    const entries = db.collection<RosterEntryDoc>("rosterEntries");
    const existingEntry = await entries.findOne({ rosterId, userId });
    if (existingEntry) {
      const joinedCount = await entries.countDocuments({ rosterId });
      return NextResponse.json({
        ok: true,
        alreadyJoined: true,
        joinedCount: Math.min(joinedCount, roster.capacity),
        capacity: roster.capacity,
      });
    }

    // Reserve a slot in the roster document first. The conditional update is the
    // atomic capacity gate, so two players cannot both take the final slot.
    const reserved = await db.collection<RosterDoc>("rosters").findOneAndUpdate(
      {
        _id: rosterId,
        endedAt: null,
        $expr: {
          $lt: [{ $ifNull: ["$joinedCount", 0] }, "$capacity"],
        },
      },
      {
        $inc: { joinedCount: 1 },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: "after" },
    );

    if (!reserved) {
      const latest = await db.collection<RosterDoc>("rosters").findOne({ _id: rosterId });
      if (latest?.endedAt) {
        return jsonError("This roster has ended and is no longer accepting players.", 409);
      }
      return jsonError("This roster is full. Choose another scheduled game.", 409);
    }

    try {
      const { player } = await joinOwnerBoard(db, userDoc, roster.ownerId);

      await entries.insertOne({
        _id: new ObjectId(),
        rosterId,
        ownerId: roster.ownerId,
        userId,
        playerId: player._id,
        name: player.name,
        rating: player.rating,
        createdAt: new Date(),
      });

      return NextResponse.json(
        {
          ok: true,
          alreadyJoined: false,
          joinedCount: Math.min(reserved.joinedCount, roster.capacity),
          capacity: roster.capacity,
        },
        { status: 201 },
      );
    } catch (error) {
      await db
        .collection<RosterDoc>("rosters")
        .updateOne({ _id: rosterId }, { $inc: { joinedCount: -1 } })
        .catch(() => undefined);

      if (error instanceof MongoServerError && error.code === 11000) {
        const joinedCount = await entries.countDocuments({ rosterId });
        return NextResponse.json({
          ok: true,
          alreadyJoined: true,
          joinedCount: Math.min(joinedCount, roster.capacity),
          capacity: roster.capacity,
        });
      }

      if (error instanceof Error && error.message === "NAME_TAKEN") {
        return jsonError("That player name is already linked to another account.", 409);
      }
      if (error instanceof Error && error.message === "INCOMPLETE_PROFILE") {
        return jsonError(
          "Your player profile is incomplete. Register again with a rate and gender.",
          400,
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("POST /api/rosters/[id]/join failed", error);
    return jsonError("Could not join that roster. Try again.", 500);
  }
}
