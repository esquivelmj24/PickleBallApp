import { NextResponse } from "next/server";
import { jsonError, readBody } from "@/lib/api";
import {
  getSessionUser,
  ownerObjectId,
  requireAdmin,
  signInRequiredResponse,
  unauthorizedResponse,
} from "@/lib/auth";
import { getDb, type RosterDoc } from "@/lib/db";
import {
  loadRosterSummaries,
  normalizeRosterCapacity,
  validateRosterDate,
  validateRosterName,
  validateRosterTime,
} from "@/lib/rosters";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return signInRequiredResponse();

    const db = await getDb();
    return NextResponse.json(await loadRosterSummaries(db, user));
  } catch (error) {
    console.error("GET /api/rosters failed", error);
    return jsonError("Could not load game rosters.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();

    const body = await readBody(request);
    const name = validateRosterName(body.name);
    const scheduledDate = validateRosterDate(body.date);
    const scheduledTime = validateRosterTime(body.time);
    const capacity = normalizeRosterCapacity(body.capacity);

    if (!name) {
      return jsonError("Roster name must be 2–60 characters and include a letter or number.");
    }
    if (!scheduledDate) {
      return jsonError("Choose a valid scheduled date.");
    }
    if (!scheduledTime) {
      return jsonError("Choose a valid scheduled time.");
    }
    if (!capacity) {
      return jsonError("Player capacity must be 10, 20, 30, 40, 50, or 60.");
    }

    const now = new Date();
    const doc: Omit<RosterDoc, "_id"> = {
      ownerId: ownerObjectId(admin),
      name,
      scheduledDate,
      scheduledTime,
      capacity,
      joinedCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDb();
    const result = await db.collection<RosterDoc>("rosters").insertOne(doc as RosterDoc);
    const rosters = await loadRosterSummaries(db, admin);
    const created = rosters.find((roster) => roster.id === result.insertedId.toString());

    return NextResponse.json(
      created ?? {
        id: result.insertedId.toString(),
        name,
        date: scheduledDate,
        time: scheduledTime,
        capacity,
        joinedCount: 0,
        remaining: capacity,
        full: false,
        joined: false,
        ownerAlias: admin.alias,
        createdAt: now.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/rosters failed", error);
    return jsonError("Could not create the roster. Try again.", 500);
  }
}
