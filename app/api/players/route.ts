import { MongoServerError, ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { cleanName, jsonError, nameKey, readBody } from "@/lib/api";
import { ownerObjectId, requireAdmin, unauthorizedResponse } from "@/lib/auth";
import { getDb, type PlayerDoc, type RosterDoc, type RosterEntryDoc } from "@/lib/db";
import { normalizeRating } from "@/lib/levels";
import { serializePlayer } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const ownerId = ownerObjectId(admin);

    const db = await getDb();
    const docs = await db
      .collection<PlayerDoc>("players")
      .find({ ownerId })
      .sort({ name: 1 })
      .toArray();
    return NextResponse.json(docs.map(serializePlayer));
  } catch (error) {
    console.error("GET /api/players failed", error);
    return jsonError("Could not load players.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const ownerId = ownerObjectId(admin);

    const body = await readBody(request);
    const name = cleanName(body.name);
    const rating = normalizeRating(body.rating);
    const isNR = body.isNR === true;

    if (!name) {
      return jsonError("Enter a player name between 2 and 40 characters.");
    }
    if (rating === null) {
      return jsonError("Rating must be between 2.0 and 4.0.");
    }

    const db = await getDb();
    const rosters = db.collection<RosterDoc>("rosters");
    const entries = db.collection<RosterEntryDoc>("rosterEntries");
    let roster: RosterDoc | null = null;

    if (body.rosterId !== undefined && body.rosterId !== null) {
      if (typeof body.rosterId !== "string" || !ObjectId.isValid(body.rosterId)) {
        return jsonError("Invalid roster id.", 400);
      }

      roster = await rosters.findOne({
        _id: new ObjectId(body.rosterId),
        ownerId,
        endedAt: null,
      });

      if (!roster) {
        return jsonError(
          "That roster has ended or is no longer available for new players.",
          409,
        );
      }
    }

    const now = new Date();
    let reserved: RosterDoc | null = null;

    if (roster) {
      reserved = await rosters.findOneAndUpdate(
        {
          _id: roster._id,
          ownerId,
          endedAt: null,
          $expr: {
            $lt: [{ $ifNull: ["$joinedCount", 0] }, "$capacity"],
          },
        },
        {
          $inc: { joinedCount: 1 },
          $set: { updatedAt: now },
        },
        { returnDocument: "after" },
      );

      if (!reserved) {
        const latest = await rosters.findOne({ _id: roster._id });
        if (!latest || latest.endedAt) {
          return jsonError(
            "That roster has ended or is no longer available for new players.",
            409,
          );
        }
        return jsonError(
          "This roster is full. Increase the player capacity before adding more players.",
          409,
        );
      }
    }

    const doc: Omit<PlayerDoc, "_id"> = {
      ownerId,
      name,
      nameKey: nameKey(name),
      rating,
      isNR,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      lastPlayedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    let insertedPlayerId: ObjectId | null = null;

    try {
      const result = await db.collection<PlayerDoc>("players").insertOne(doc as PlayerDoc);
      insertedPlayerId = result.insertedId;

      if (roster && reserved) {
        await entries.insertOne({
          _id: new ObjectId(),
          rosterId: roster._id,
          ownerId,
          playerId: result.insertedId,
          name,
          rating,
          isNR,
          createdAt: now,
        });
      }

      return NextResponse.json(
        serializePlayer({ ...doc, _id: result.insertedId }),
        { status: 201 },
      );
    } catch (error) {
      if (reserved) {
        await rosters
          .updateOne({ _id: reserved._id }, { $inc: { joinedCount: -1 } })
          .catch(() => undefined);
      }

      if (insertedPlayerId) {
        if (reserved) {
          await entries
            .deleteOne({ rosterId: reserved._id, playerId: insertedPlayerId })
            .catch(() => undefined);
        }
        await db
          .collection<PlayerDoc>("players")
          .deleteOne({ _id: insertedPlayerId, ownerId })
          .catch(() => undefined);
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return jsonError("A player with that name is already on the roster.", 409);
    }
    console.error("POST /api/players failed", error);
    return jsonError("Could not add the player.", 500);
  }
}
