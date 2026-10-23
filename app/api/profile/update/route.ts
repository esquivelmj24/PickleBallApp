import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { jsonError, readBody } from "@/lib/api";
import { getSessionUser, signInRequiredResponse } from "@/lib/auth";
import { getDb, type UserDoc } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return signInRequiredResponse();

    const body = await readBody(request);
    const { alias, rating, isNR, gender } = body;

    const db = await getDb();
    const userId = new ObjectId(user.id);

    const userUpdates: any = { updatedAt: new Date() };

    if (typeof alias === "string") {
      const trimmedAlias = alias.trim();
      if (trimmedAlias.length < 3 || trimmedAlias.length > 30) {
        return jsonError("Alias must be between 3 and 30 characters.", 400);
      }
      userUpdates.alias = trimmedAlias;
      userUpdates.aliasKey = trimmedAlias.toLowerCase();
    }

    if (typeof rating === "number") {
      if (rating < 2.0 || rating > 4.0) {
        return jsonError("Rating must be between 2.0 and 4.0.", 400);
      }
      userUpdates.rating = Math.round(rating * 10) / 10;
    }

    if (typeof isNR === "boolean") {
      userUpdates.isNR = isNR;
    }

    if (typeof gender === "string") {
      userUpdates.gender = gender;
    }

    if (Object.keys(userUpdates).length === 1) {
      return jsonError("No valid updates provided.", 400);
    }

    // Update User
    const result = await db.collection<UserDoc>("users").updateOne(
      { _id: userId },
      { $set: userUpdates }
    );

    if (!result.matchedCount) {
      return jsonError("Account not found.", 404);
    }

    // Propagate to all linked Player documents across all boards
    const playerUpdates: any = { updatedAt: new Date() };
    if (typeof alias === "string") playerUpdates.name = alias.trim();
    if (typeof rating === "number") playerUpdates.rating = Math.round(rating * 10) / 10;
    if (typeof isNR === "boolean") playerUpdates.isNR = isNR;
    if (typeof gender === "string") playerUpdates.gender = gender;
    if (typeof alias === "string") playerUpdates.nameKey = alias.trim().toLowerCase();

    await db.collection("players").updateMany(
      { userId },
      { $set: playerUpdates }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/profile/update failed", error);
    return jsonError("Could not update profile.", 500);
  }
}
