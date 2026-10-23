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
  validateRosterLocation,
  validateRosterName,
  validateRosterTime,
} from "@/lib/rosters";
import { ROSTER_CAPACITY_MAX, ROSTER_CAPACITY_MIN } from "@/lib/roster-config";

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
    const location = validateRosterLocation(body.location);
    const scheduledDate = validateRosterDate(body.date);
    const scheduledTime = validateRosterTime(body.startTime ?? body.time);
    const scheduledEndTime = validateRosterTime(body.endTime);
    const capacity = normalizeRosterCapacity(body.capacity);

    if (!name) {
      return jsonError("Roster name must be 2–60 characters and include a letter or number.");
    }
    if (!location) {
      return jsonError("Location must be 2–100 characters and include a letter or number.");
    }
    if (!scheduledDate) {
      return jsonError("Choose a valid scheduled date.");
    }
    if (!scheduledTime) {
      return jsonError("Choose a valid start time.");
    }
    if (!scheduledEndTime) {
      return jsonError("Choose a valid end time.");
    }
    if (scheduledEndTime <= scheduledTime) {
      return jsonError("End time must be later than the start time.");
    }
    if (!capacity) {
      return jsonError(
        `Player capacity must be a whole number from ${ROSTER_CAPACITY_MIN} to ${ROSTER_CAPACITY_MAX}.`,
      );
    }

    const now = new Date();
    const doc: Omit<RosterDoc, "_id"> = {
      ownerId: ownerObjectId(admin),
      name,
      location,
      scheduledDate,
      scheduledTime,
      scheduledEndTime,
      capacity,
      joinedCount: 0,
      endedAt: null,
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
        location,
        date: scheduledDate,
        startTime: scheduledTime,
        endTime: scheduledEndTime,
        capacity,
        joinedCount: 0,
        remaining: capacity,
        full: false,
        ended: false,
        endedAt: null,
        joined: false,
        joinedAt: null,
        ownerAlias: admin.alias,
        createdAt: now.toISOString(),
        members: [],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/rosters failed", error);
    return jsonError("Could not create the roster. Try again.", 500);
  }
}
