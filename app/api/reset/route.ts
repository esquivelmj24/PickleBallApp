import { NextResponse } from "next/server";
import { jsonError, readBody } from "@/lib/api";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONFIRMATION = "CLEAR ALL";

export async function DELETE(request: Request) {
  try {
    const body = await readBody(request);
    if (body.confirm !== CONFIRMATION) {
      return jsonError(`Type ${CONFIRMATION} to confirm clearing the board.`);
    }

    const db = await getDb();
    const [players, matches] = await Promise.all([
      db.collection("players").deleteMany({}),
      db.collection("matches").deleteMany({}),
    ]);

    return NextResponse.json({
      ok: true,
      players: players.deletedCount,
      matches: matches.deletedCount,
    });
  } catch (error) {
    console.error("DELETE /api/reset failed", error);
    return jsonError("Could not clear the board. Try again.", 500);
  }
}
