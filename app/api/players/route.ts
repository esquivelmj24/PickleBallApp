import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";
import { cleanName, jsonError, nameKey, readBody } from "@/lib/api";
import { ownerObjectId, requireAdmin, unauthorizedResponse } from "@/lib/auth";
import { getDb, type PlayerDoc } from "@/lib/db";
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

    if (!name) {
      return jsonError("Enter a player name between 2 and 40 characters.");
    }
    if (rating === null) {
      return jsonError("Rating must be between 2.0 and 4.0.");
    }

    const db = await getDb();
    const now = new Date();
    const doc = {
      ownerId,
      name,
      nameKey: nameKey(name),
      rating,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      lastPlayedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("players").insertOne(doc);
    return NextResponse.json(
      serializePlayer({ ...doc, _id: result.insertedId }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return jsonError("A player with that name is already on the roster.", 409);
    }
    console.error("POST /api/players failed", error);
    return jsonError("Could not add the player.", 500);
  }
}
