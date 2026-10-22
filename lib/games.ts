import type { Db, ObjectId } from "mongodb";
import type { MatchDoc, PlayerDoc } from "./db";

/**
 * Player users do not own a board. They watch the board they already joined,
 * or the most recently active admin board before joining. This keeps player
 * access deterministic while admin management remains owner-scoped.
 */
export async function latestGameOwnerId(db: Db): Promise<ObjectId | null> {
  const matches = db.collection<MatchDoc>("matches");

  const scheduled = await matches
    .find({ status: "scheduled" })
    .sort({ createdAt: -1, _id: -1 })
    .limit(1)
    .next();
  if (scheduled) return scheduled.ownerId;

  const latestMatch = await matches
    .find({})
    .sort({ createdAt: -1, _id: -1 })
    .limit(1)
    .next();
  if (latestMatch) return latestMatch.ownerId;

  const latestPlayer = await db
    .collection<PlayerDoc>("players")
    .find({})
    .sort({ createdAt: -1, _id: -1 })
    .limit(1)
    .next();

  return latestPlayer?.ownerId ?? null;
}
