import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { jsonError, readBody } from "@/lib/api";
import { ownerObjectId, requireAdmin, unauthorizedResponse } from "@/lib/auth";
import { getDb, type RosterDoc } from "@/lib/db";
import {
  validateRosterDate,
  validateRosterLocation,
  validateRosterName,
  validateRosterTime,
} from "@/lib/rosters";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid roster id.", 400);

    const body = await readBody(request);
    const name = validateRosterName(body.name);
    const location = validateRosterLocation(body.location);
    const scheduledDate = validateRosterDate(body.date);
    const scheduledTime = validateRosterTime(body.startTime);
    const scheduledEndTime = validateRosterTime(body.endTime);

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

    const db = await getDb();
    const roster = await db.collection<RosterDoc>("rosters").findOneAndUpdate(
      {
        _id: new ObjectId(id),
        ownerId: ownerObjectId(admin),
        endedAt: null,
      },
      {
        $set: {
          name,
          location,
          scheduledDate,
          scheduledTime,
          scheduledEndTime,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );

    if (!roster) {
      return jsonError("That roster no longer exists or has ended.", 404);
    }

    return NextResponse.json({
      ok: true,
      id: roster._id.toString(),
      name: roster.name,
      location: roster.location ?? location,
      date: roster.scheduledDate,
      startTime: roster.scheduledTime,
      endTime: roster.scheduledEndTime ?? scheduledEndTime,
    });
  } catch (error) {
    console.error("PATCH /api/rosters/[id] failed", error);
    return jsonError("Could not update that roster. Try again.", 500);
  }
}
