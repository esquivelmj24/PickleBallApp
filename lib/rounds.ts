import type { Db, ObjectId } from "mongodb";
import { MAX_COURTS } from "./constants";
import { type MatchDoc, type PlayerDoc } from "./db";
import { buildRound, finishOrderPriority, levelCourtCapacity } from "./matchmaking";
import type { CourtLayout, MatchMode } from "./types";

export type AdvanceRoundResult = {
  advanced: boolean;
  reason?:
    | "no-matches"
    | "in-progress"
    | "not-enough-players"
    | "no-capacity"
    | "no-pairings";
  roundId?: string;
  mode?: MatchMode;
  layout?: CourtLayout;
  courts?: number;
  matches?: number;
  waiting?: number;
};

// Serialize auto-advance per admin so two nearly simultaneous score saves for
// the same owner cannot create two next rounds. Different admins advance
// independently.
const advanceInFlight = new Map<string, Promise<AdvanceRoundResult>>();

export function advanceRoundIfComplete(
  db: Db,
  ownerId: ObjectId,
): Promise<AdvanceRoundResult> {
  const key = ownerId.toString();
  const existing = advanceInFlight.get(key);
  if (existing) return existing;

  const pending = advanceRoundIfCompleteUnlocked(db, ownerId).finally(() => {
    advanceInFlight.delete(key);
  });
  advanceInFlight.set(key, pending);
  return pending;
}

async function advanceRoundIfCompleteUnlocked(
  db: Db,
  ownerId: ObjectId,
): Promise<AdvanceRoundResult> {
  const matches = db.collection<MatchDoc>("matches");
  const latestMatch = await matches
    .find({ ownerId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(1)
    .next();

  if (!latestMatch) return { advanced: false, reason: "no-matches" };

  const roundMatches = await matches.find({ ownerId, roundId: latestMatch.roundId }).toArray();
  if (roundMatches.length === 0) return { advanced: false, reason: "no-matches" };

  // A round is only advanced when every court and queued group has a result.
  if (roundMatches.some((match) => match.status === "scheduled")) {
    return { advanced: false, reason: "in-progress" };
  }

  const players = await db.collection<PlayerDoc>("players").find({ ownerId }).toArray();
  if (players.length < 4) {
    return { advanced: false, reason: "not-enough-players" };
  }

  const mode: MatchMode = latestMatch.mode ?? "level";
  const capacity =
    mode === "open" ? Math.floor(players.length / 4) : levelCourtCapacity(players);
  if (capacity < 1) return { advanced: false, reason: "no-capacity" };

  const uniqueCourts = new Set(roundMatches.map((match) => match.court));
  const layout: CourtLayout = uniqueCourts.size > 1 ? "multiple" : "single";
  const requestedCourts = layout === "single" ? 1 : uniqueCourts.size;
  const courtCount = Math.min(Math.max(1, requestedCourts), capacity, MAX_COURTS);
  const lineupCount = layout === "single" ? Math.min(capacity, 2) : courtCount;

  // The next round keeps the same format and court layout. Players who just
  // finished still get finish-order preference, but only inside the same
  // games-played group so late arrivals can catch up.
  const priorityOrder = layout === "single" ? null : finishOrderPriority(roundMatches);
  const round = buildRound(players, lineupCount, mode, priorityOrder);
  if (round.pairings.length === 0) {
    return { advanced: false, reason: "no-pairings" };
  }

  const now = new Date();
  type NewMatchDoc = Omit<MatchDoc, "_id">;
  const docs: NewMatchDoc[] = round.pairings.map((pairing, index) => ({
    ownerId,
    roundId: round.roundId,
    court: layout === "single" ? 1 : pairing.court,
    mode,
    queuePosition: layout === "single" ? index + 1 : 1,
    status: "scheduled",
    team1: pairing.team1.map((player) => ({
      playerId: player._id,
      name: player.name,
      rating: player.rating,
    })),
    team2: pairing.team2.map((player) => ({
      playerId: player._id,
      name: player.name,
      rating: player.rating,
    })),
    team1Score: null,
    team2Score: null,
    winner: null,
    createdAt: now,
    completedAt: null,
    updatedAt: now,
  }));

  await db.collection<NewMatchDoc>("matches").insertMany(docs);

  return {
    advanced: true,
    roundId: round.roundId,
    mode,
    layout,
    courts: courtCount,
    matches: docs.length,
    waiting: Math.max(0, players.length - docs.length * 4),
  };
}
