import { ObjectId, type Db } from "mongodb";
import type { SessionUser } from "./auth";
import { type RosterDoc, type RosterEntryDoc, type UserDoc } from "./db";
import { ROSTER_CAPACITIES, type RosterCapacity } from "./roster-config";
import type { Roster } from "./types";

export function validateRosterName(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) return null;
  if (!/[a-zA-Z0-9]/.test(name)) return null;

  return name;
}

export function validateRosterDate(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function validateRosterTime(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const time = value.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : null;
}

export function normalizeRosterCapacity(value: unknown): RosterCapacity | null {
  const capacity = typeof value === "number" ? value : Number(value);
  return ROSTER_CAPACITIES.includes(capacity as RosterCapacity)
    ? (capacity as RosterCapacity)
    : null;
}

/**
 * Roster ratios are derived from membership entries on read, so both the admin
 * and player views always see the same joined/capacity number.
 */
export async function loadRosterSummaries(
  db: Db,
  user: SessionUser,
): Promise<Roster[]> {
  const rostersCollection = db.collection<RosterDoc>("rosters");
  const entriesCollection = db.collection<RosterEntryDoc>("rosterEntries");

  const query = user.role === "admin" ? { ownerId: new ObjectId(user.id) } : {};
  const rosterDocs = await rostersCollection
    .find(query)
    .sort({ scheduledDate: 1, scheduledTime: 1, createdAt: 1 })
    .toArray();

  if (rosterDocs.length === 0) return [];

  const rosterIds = rosterDocs.map((roster) => roster._id);
  const ownerIds = [
    ...new Map(
      rosterDocs.map((roster) => [roster.ownerId.toString(), roster.ownerId]),
    ).values(),
  ];
  const viewerId = user.role === "player" ? new ObjectId(user.id) : null;

  const [owners, entryDocs] = await Promise.all([
    db
      .collection<UserDoc>("users")
      .find({ _id: { $in: ownerIds } })
      .toArray(),
    entriesCollection
      .find({ rosterId: { $in: rosterIds } })
      .sort({ createdAt: 1, name: 1 })
      .toArray(),
  ]);

  const ownerAliases = new Map(
    owners.map((owner) => [owner._id.toString(), owner.alias]),
  );
  const entriesByRoster = new Map<string, RosterEntryDoc[]>();
  for (const entry of entryDocs) {
    const key = entry.rosterId.toString();
    const current = entriesByRoster.get(key) ?? [];
    current.push(entry);
    entriesByRoster.set(key, current);
  }

  return rosterDocs.map((roster) => {
    const entries = entriesByRoster.get(roster._id.toString()) ?? [];
    const viewerEntry = viewerId
      ? entries.find((entry) => entry.userId.equals(viewerId))
      : undefined;
    const joinedCount = Math.min(entries.length, roster.capacity);
    const members = entries.map((entry) => ({
      playerId: entry.playerId.toString(),
      name: entry.name,
      rating: entry.rating,
      isViewer: Boolean(viewerId && entry.userId.equals(viewerId)),
      joinedAt: entry.createdAt.toISOString(),
    }));

    return {
      id: roster._id.toString(),
      name: roster.name,
      date: roster.scheduledDate,
      time: roster.scheduledTime,
      capacity: roster.capacity,
      joinedCount,
      remaining: Math.max(0, roster.capacity - joinedCount),
      full: joinedCount >= roster.capacity,
      joined: Boolean(viewerEntry),
      joinedAt: viewerEntry ? viewerEntry.createdAt.toISOString() : null,
      ownerAlias: ownerAliases.get(roster.ownerId.toString()) ?? "Admin",
      createdAt: roster.createdAt.toISOString(),
      members,
    };
  });
}
