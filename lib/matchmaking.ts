import { randomUUID } from "crypto";
import type { PlayerDoc } from "./db";
import { getLevel, LEVELS, type LevelKey } from "./levels";
import type { MatchMode } from "./types";

type CourtPairing = {
  court: number;
  team1: PlayerDoc[];
  team2: PlayerDoc[];
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function ratingTotal(team: PlayerDoc[]): number {
  return team.reduce((total, player) => total + player.rating, 0);
}

function splitTeams(group: PlayerDoc[]): { team1: PlayerDoc[]; team2: PlayerDoc[] } {
  const splits = [
    [0, 1],
    [0, 2],
    [0, 3],
  ].map((teamAIndexes) => {
    const teamA = teamAIndexes.map((index) => group[index]);
    const teamB = group.filter((_, index) => !teamAIndexes.includes(index));
    return {
      team1: teamA,
      team2: teamB,
      difference: Math.abs(ratingTotal(teamA) - ratingTotal(teamB)),
    };
  });

  const lowestDifference = Math.min(...splits.map((split) => split.difference));
  const bestSplits = splits.filter((split) => split.difference === lowestDifference);
  const chosen = bestSplits[Math.floor(Math.random() * bestSplits.length)];

  const flipSides = Math.random() > 0.5;
  return {
    team1: flipSides ? chosen.team1 : chosen.team2,
    team2: flipSides ? chosen.team2 : chosen.team1,
  };
}

function fairOrder(players: PlayerDoc[]): PlayerDoc[] {
  return shuffle(players).sort((a, b) => {
    if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
    const aLastPlayed = a.lastPlayedAt?.getTime() ?? 0;
    const bLastPlayed = b.lastPlayedAt?.getTime() ?? 0;
    return aLastPlayed - bLastPlayed;
  });
}

export function levelCourtCapacity(players: PlayerDoc[]): number {
  return LEVELS.reduce((total, level) => {
    const count = players.filter((player) => getLevel(player.rating).key === level.key).length;
    return total + Math.floor(count / 4);
  }, 0);
}

function buildLevelPairings(players: PlayerDoc[], lineupCount: number): CourtPairing[] {
  const pools = new Map<LevelKey, PlayerDoc[]>();

  for (const level of LEVELS) {
    pools.set(
      level.key,
      fairOrder(players.filter((player) => getLevel(player.rating).key === level.key)),
    );
  }

  const tiers = LEVELS.map((level) => {
    const pool = pools.get(level.key) ?? [];
    return {
      ...level,
      pool,
      capacity: Math.floor(pool.length / 4),
    };
  }).filter((tier) => tier.capacity > 0);

  if (tiers.length === 0) return [];

  const totalCapacity = tiers.reduce((total, tier) => total + tier.capacity, 0);
  const slotsToFill = Math.min(lineupCount, totalCapacity);
  const allocation = new Map<LevelKey, number>(tiers.map((tier) => [tier.key, 0]));

  // Give tiers one court at a time until the requested lineup count is reached.
  // The starting tier is randomized so a reduced lineup count does not always
  // favor the same level.
  const allocationOrder = shuffle(tiers);
  let remaining = slotsToFill;
  while (remaining > 0) {
    let allocatedThisPass = false;
    for (const tier of allocationOrder) {
      if (remaining <= 0) break;
      const assigned = allocation.get(tier.key) ?? 0;
      if (assigned >= tier.capacity) continue;
      allocation.set(tier.key, assigned + 1);
      remaining -= 1;
      allocatedThisPass = true;
    }
    if (!allocatedThisPass) break;
  }

  const pairings: CourtPairing[] = [];
  for (const tier of tiers) {
    const courtsForTier = allocation.get(tier.key) ?? 0;
    if (!courtsForTier) continue;

    const selected = tier.pool.slice(0, courtsForTier * 4);
    const seeded = shuffle(selected).sort((a, b) => a.rating - b.rating);

    for (let index = 0; index < courtsForTier; index += 1) {
      const group = seeded.slice(index * 4, index * 4 + 4);
      const { team1, team2 } = splitTeams(group);
      pairings.push({
        court: pairings.length + 1,
        team1,
        team2,
      });
    }
  }

  return pairings;
}

function buildOpenPairings(players: PlayerDoc[], lineupCount: number): CourtPairing[] {
  const selected = fairOrder(players).slice(0, lineupCount * 4);
  const pairings: CourtPairing[] = [];

  for (let index = 0; index < selected.length; index += 4) {
    const group = selected.slice(index, index + 4);
    if (group.length < 4) break;
    const { team1, team2 } = splitTeams(group);
    pairings.push({
      court: pairings.length + 1,
      team1,
      team2,
    });
  }

  return pairings;
}

/**
 * Automatic matchmaking has two modes:
 *
 * Level mode:
 * 1. Split the roster into the three rating bands.
 * 2. A court can only be built from four players in the SAME band.
 * 3. Within each band, prioritize the fewest games played and longest rest.
 *
 * Open rate mode:
 * 1. Ignore rating bands and build courts from the full roster.
 * 2. Still prioritize the fewest games played and longest rest.
 * 3. Split each foursome into the most evenly rated teams possible.
 *
 * The committee can still override a lineup manually after generation; manual
 * edits deliberately do not enforce rating bands.
 */
export function buildRound(
  players: PlayerDoc[],
  lineupCount: number,
  mode: MatchMode = "level",
) {
  const safeLineupCount = Math.max(0, Math.floor(lineupCount));
  const pairings =
    mode === "open"
      ? buildOpenPairings(players, safeLineupCount)
      : buildLevelPairings(players, safeLineupCount);

  return {
    roundId: randomUUID(),
    pairings,
    waiting: Math.max(0, players.length - pairings.length * 4),
  };
}
