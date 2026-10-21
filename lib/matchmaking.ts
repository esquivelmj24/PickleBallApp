import { randomUUID } from "crypto";
import type { MatchDoc, PlayerDoc } from "./db";
import { playerRestTime } from "./format";
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

function fairOrder(
  players: PlayerDoc[],
  priorityOrder?: Map<string, number> | null,
): PlayerDoc[] {
  return shuffle(players).sort((a, b) => {
    // Catch-up priority: players who missed games (especially late arrivals
    // with 0 games) go before players with more games.
    const aGames = Math.max(0, a.gamesPlayed || 0);
    const bGames = Math.max(0, b.gamesPlayed || 0);
    if (aGames !== bGames) return aGames - bGames;

    // Within the same play count, players who finished their previous match
    // first are ranked first.
    if (priorityOrder) {
      const aRank = priorityOrder.get(a._id.toString());
      const bRank = priorityOrder.get(b._id.toString());
      if (aRank !== undefined || bRank !== undefined) {
        const safeARank = aRank ?? Number.MAX_SAFE_INTEGER;
        const safeBRank = bRank ?? Number.MAX_SAFE_INTEGER;
        if (safeARank !== safeBRank) return safeARank - safeBRank;
      }
    }

    const aRest = playerRestTime(a);
    const bRest = playerRestTime(b);
    if (aRest !== bRest) return aRest - bRest;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Rank the players who just finished a match by completion time. The rank map
 * is used as a tie-breaker inside the same play-count group, so late arrivals
 * and low-game players still get their catch-up priority first.
 */
export function finishOrderPriority(previousMatches: MatchDoc[]): Map<string, number> | null {
  const completed = previousMatches
    .filter((match) => match.status === "completed")
    .sort((a, b) => {
      const aCompleted =
        a.completedAt?.getTime() ?? a.updatedAt?.getTime() ?? a.createdAt.getTime();
      const bCompleted =
        b.completedAt?.getTime() ?? b.updatedAt?.getTime() ?? b.createdAt.getTime();
      return (
        aCompleted - bCompleted ||
        a.court - b.court ||
        (a.queuePosition ?? 1) - (b.queuePosition ?? 1)
      );
    });

  if (completed.length === 0) return null;

  const priority = new Map<string, number>();
  let rank = 0;

  for (const match of completed) {
    for (const player of [...match.team1, ...match.team2]) {
      const playerId = player.playerId.toString();
      if (!priority.has(playerId)) {
        priority.set(playerId, rank);
        rank += 1;
      }
    }
  }

  return priority;
}

export function levelCourtCapacity(players: PlayerDoc[]): number {
  return LEVELS.reduce((total, level) => {
    const count = players.filter((player) => getLevel(player.rating).key === level.key).length;
    return total + Math.floor(count / 4);
  }, 0);
}

function buildLevelPairings(
  players: PlayerDoc[],
  lineupCount: number,
  priorityOrder?: Map<string, number> | null,
): CourtPairing[] {
  const pools = new Map<LevelKey, PlayerDoc[]>();

  for (const level of LEVELS) {
    pools.set(
      level.key,
      fairOrder(
        players.filter((player) => getLevel(player.rating).key === level.key),
        priorityOrder,
      ),
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

function buildOpenPairings(
  players: PlayerDoc[],
  lineupCount: number,
  priorityOrder?: Map<string, number> | null,
): CourtPairing[] {
  const selected = fairOrder(players, priorityOrder).slice(0, lineupCount * 4);
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
  priorityOrder?: Map<string, number> | null,
) {
  const safeLineupCount = Math.max(0, Math.floor(lineupCount));
  const pairings =
    mode === "open"
      ? buildOpenPairings(players, safeLineupCount, priorityOrder)
      : buildLevelPairings(players, safeLineupCount, priorityOrder);

  return {
    roundId: randomUUID(),
    pairings,
    waiting: Math.max(0, players.length - pairings.length * 4),
  };
}
