import { NextResponse } from "next/server";
import { ownerObjectId, requireAdmin, unauthorizedResponse } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEMO_PLAYERS = [
  { name: "Maya Chen", rating: 3.8 },
  { name: "Jordan Reyes", rating: 3.5 },
  { name: "Priya Shah", rating: 3.3 },
  { name: "Marcus Lee", rating: 3.1 },
  { name: "Sofia Alvarez", rating: 2.9 },
  { name: "Ben Carter", rating: 2.8 },
  { name: "Nia Brooks", rating: 2.7 },
  { name: "Ethan Park", rating: 2.5 },
  { name: "Grace Kim", rating: 2.4 },
  { name: "Leo Martinez", rating: 2.3 },
  { name: "Ava Thompson", rating: 2.2 },
  { name: "Sam Rivera", rating: 2.1 },
];

export async function POST() {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const ownerId = ownerObjectId(admin);

    const db = await getDb();
    const existing = await db.collection("players").countDocuments({ ownerId });
    if (existing > 0) {
      return NextResponse.json(
        { error: "The roster already has players. Sample data is only added to an empty board." },
        { status: 409 },
      );
    }

    const now = new Date();
    const docs = DEMO_PLAYERS.map((player) => ({
      ownerId,
      ...player,
      nameKey: player.name.toLowerCase(),
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      lastPlayedAt: null,
      createdAt: now,
      updatedAt: now,
    }));

    await db.collection("players").insertMany(docs);
    return NextResponse.json({ ok: true, added: docs.length }, { status: 201 });
  } catch (error) {
    console.error("POST /api/demo failed", error);
    return NextResponse.json({ error: "Could not add sample players." }, { status: 500 });
  }
}
