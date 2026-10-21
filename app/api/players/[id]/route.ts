import { MongoServerError, ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { cleanName, jsonError, nameKey, readBody } from "@/lib/api";
import { getDb, type PlayerDoc } from "@/lib/db";
import { normalizeRating } from "@/lib/levels";
import { serializePlayer } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid player id.", 400);

    const playerId = new ObjectId(id);
    const body = await readBody(request);
    const db = await getDb();
    const existing = await db.collection<PlayerDoc>("players").findOne({ _id: playerId });
    if (!existing) return jsonError("Player not found.", 404);

    const name = body.name === undefined ? existing.name : cleanName(body.name);
    const rating =
      body.rating === undefined ? existing.rating : normalizeRating(body.rating);

    if (!name) return jsonError("Enter a player name between 2 and 40 characters.");
    if (rating === null) return jsonError("Rating must be between 2.0 and 4.0.");

    const now = new Date();
    const update: Record<string, unknown> = {
      name,
      nameKey: nameKey(name),
      rating,
      updatedAt: now,
    };

    await db.collection("players").updateOne({ _id: playerId }, { $set: update });

    const matches = db.collection("matches");
    const snapshotUpdate = {
      $set: {
        "team1.$[player].name": name,
        "team1.$[player].rating": rating,
        "team2.$[player].name": name,
        "team2.$[player].rating": rating,
        updatedAt: now,
      },
    };
    const arrayFilters = [{ "player.playerId": playerId }];

    await Promise.all([
      matches.updateMany(
        { status: "scheduled", "team1.playerId": playerId },
        snapshotUpdate,
        { arrayFilters },
      ),
      matches.updateMany(
        { status: "scheduled", "team2.playerId": playerId },
        snapshotUpdate,
        { arrayFilters },
      ),
    ]);

    return NextResponse.json(
      serializePlayer({
        ...existing,
        name,
        nameKey: nameKey(name),
        rating,
        updatedAt: now,
      }),
    );
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return jsonError("A player with that name is already on the roster.", 409);
    }
    console.error("PATCH /api/players/[id] failed", error);
    return jsonError("Could not update the player.", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid player id.", 400);

    const playerId = new ObjectId(id);
    const db = await getDb();
    const scheduledMatch = await db.collection("matches").findOne({
      status: "scheduled",
      $or: [{ "team1.playerId": playerId }, { "team2.playerId": playerId }],
    });

    if (scheduledMatch) {
      return jsonError(
        "This player is on a court in the current rotation. Change the lineup or start a new round first.",
        409,
      );
    }

    const result = await db.collection("players").deleteOne({ _id: playerId });
    if (!result.deletedCount) return jsonError("Player not found.", 404);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/players/[id] failed", error);
    return jsonError("Could not remove the player.", 500);
  }
}
