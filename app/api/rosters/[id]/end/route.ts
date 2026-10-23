import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { ownerObjectId, requireAdmin, unauthorizedResponse } from "@/lib/auth";
import { getDb, type RosterDoc } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid roster id.", 400);

    const db = await getDb();
    const now = new Date();
    const roster = await db.collection<RosterDoc>("rosters").findOneAndUpdate(
      { _id: new ObjectId(id), ownerId: ownerObjectId(admin) },
      { $set: { endedAt: now, updatedAt: now } },
      { returnDocument: "after" },
    );

    if (!roster) return jsonError("That roster no longer exists.", 404);

    return NextResponse.json({
      ok: true,
      id: roster._id.toString(),
      endedAt: roster.endedAt?.toISOString() ?? now.toISOString(),
    });
  } catch (error) {
    console.error("POST /api/rosters/[id]/end failed", error);
    return jsonError("Could not end that roster. Try again.", 500);
  }
}
