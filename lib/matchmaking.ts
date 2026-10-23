import { randomUUID } from "crypto";
import type { MatchDoc, PlayerDoc } from "./db";
import { playerRestTime } from "./format";
import { ALL_LEVELS, getLevel, type LevelKey } from "./levels";
import type { MatchMode } from "./types";

type CourtPairing = {
  court: number;
  team1: PlayerDoc[];
  team2: PlayerDoc[];
};

type TeamSplit = {
  team1: PlayerDoc[];
  team2: PlayerDoc[];
  difference: number;
};

/**
 * History for one unordered pair of players. A meeting is either shared as
 * teammates or as opponents, and both kinds are counted so the shuffle can
 * rotate every pair through both relationships over time.
 */
export type PairHistoryEntry = {
  teammates: number;
  opponents: number;
};

export type PairHistory = Map<string, PairHistoryEntry>;

// Repeated meetings matter, but repeating the exact same relationship matters
// more. A pair that has only ever been teammates is therefore pushed apart,
// while a pair that has only ever been opponents is pulled together.
const PAIR_MEETING_WEIGHT = 6;
const SAME_SIDE_REPEAT_WEIGHT = 8;
const OTHER_SIDE_WEIGHT = 2;
const RATING_BALANCE_WEIGHT = 6;
const COST_EPSILON = 1e-9;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

// Not Rated players have an unknown rate. For Open Rate team balance, use the
// middle of the rating scale instead of their hidden numeric value.
const NR_BALANCE_RATING = 3.0;

function balanceRating(player: PlayerDoc): number {
  return player.isNR ? NR_BALANCE_RATING : player.rating;
}

function ratingTotal(team: PlayerDoc[]): number {
  return team.reduce((total, player) => total + balanceRating(player), 0);
}

function pairKey(a: { toString(): string }, b: { toString(): string }): string {
  const left = a.toString();
  const right = b.toString();
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

/**
 * Build a lookup of every teammate/opponent relationship from completed
 * matches. Scheduled matches are ignored because they have not happened yet.
 */
export function buildPairHistory(matches: MatchDoc[]): PairHistory {
  const history: PairHistory = new Map();

  const record = (
    a: { toString(): string },
    b: { toString(): string },
    side: keyof PairHistoryEntry,
  ) => {
    if (a.toString() === b.toString()) return;

    const key = pairKey(a, b);
    const entry = history.get(key) ?? { teammates: 0, opponents: 0 };
    entry[side] += 1;
    history.set(key, entry);
  };

  for (const match of matches) {
    if (match.status !== "completed") continue;

    for (const team of [match.team1, match.team2]) {
      for (let first = 0; first < team.length; first += 1) {
        for (let second = first + 1; second < team.length; second += 1) {
          record(team[first].playerId, team[second].playerId, "teammates");
        }
      }
    }

    for (const player of match.team1) {
      for (const opponent of match.team2) {
        record(player.playerId, opponent.playerId, "opponents");
      }
    }
  }

  return history;
}

function relationshipCost(
  history: PairHistory,
  a: PlayerDoc,
  b: PlayerDoc,
  side: keyof PairHistoryEntry,
): number {
  const entry = history.get(pairKey(a._id, b._id));
  if (!entry) return 0;

  const meetings = entry.teammates + entry.opponents;
  const sameSide = side === "teammates" ? entry.teammates : entry.opponents;
  const otherSide = side === "teammates" ? entry.opponents : entry.teammates;

  return (
    meetings * PAIR_MEETING_WEIGHT +
    sameSide * SAME_SIDE_REPEAT_WEIGHT +
    otherSide * OTHER_SIDE_WEIGHT
  );
}

function candidateSplits(group: PlayerDoc[]): TeamSplit[] {
  return [
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
}

function splitCost(split: TeamSplit, history: PairHistory): number {
  let cost = split.difference * RATING_BALANCE_WEIGHT;

  for (const team of [split.team1, split.team2]) {
    for (let first = 0; first < team.length; first += 1) {
      for (let second = first + 1; second < team.length; second += 1) {
        cost += relationshipCost(history, team[first], team[second], "teammates");
      }
    }
  }

  for (const player of split.team1) {
    for (const opponent of split.team2) {
      cost += relationshipCost(history, player, opponent, "opponents");
    }
  }

  return cost;
}

function splitTeams(group: PlayerDoc[], history: PairHistory): TeamSplit {
  const splits = candidateSplits(group).map((split) => ({
    split,
    cost: splitCost(split, history),
  }));
  const lowestCost = Math.min(...splits.map((entry) => entry.cost));
  const bestSplits = splits.filter(
    (entry) => Math.abs(entry.cost - lowestCost) <= COST_EPSILON,
  );
  const chosen = bestSplits[Math.floor(Math.random() * bestSplits.length)].split;

  const flipSides = Math.random() > 0.5;
  return flipSides
    ? { ...chosen, team1: chosen.team2, team2: chosen.team1 }
    : chosen;
}

function combinations<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  const current: T[] = [];

  const walk = (start: number) => {
    if (current.length === size) {
      result.push([...current]);
      return;
    }

    const remainingSlots = size - current.length;
    for (let index = start; index <= items.length - remainingSlots; index += 1) {
      current.push(items[index]);
      walk(index + 1);
      current.pop();
    }
  };

  walk(0);
  return result;
}

function bestSplitCost(group: PlayerDoc[], history: PairHistory): number {
  return Math.min(
    ...candidateSplits(group).map((split) => splitCost(split, history)),
  );
}

/**
 * Pick the next foursome that adds the least repeated relationships. All
 * candidates are compared, and equally fresh foursomes are chosen randomly so
 * the rotation still feels shuffled rather than scripted.
 */
function chooseGroup(players: PlayerDoc[], history: PairHistory): PlayerDoc[] {
  if (players.length <= 4) return [...players];

  let lowestCost = Number.POSITIVE_INFINITY;
  let bestGroups: PlayerDoc[][] = [];

  for (const group of combinations(players, 4)) {
    const cost = bestSplitCost(group, history);
    if (cost < lowestCost - COST_EPSILON) {
      lowestCost = cost;
      bestGroups = [group];
    } else if (Math.abs(cost - lowestCost) <= COST_EPSILON) {
      bestGroups.push(group);
    }
  }

  return bestGroups[Math.floor(Math.random() * bestGroups.length)] ?? players.slice(0, 4);
}

function buildGroups(players: PlayerDoc[], history: PairHistory): PlayerDoc[][] {
  const remaining = [...players];
  const groups: PlayerDoc[][] = [];

  while (remaining.length >= 4) {
    const group = chooseGroup(remaining, history);
    groups.push(group);

    const chosenIds = new Set(group.map((player) => player._id.toString()));
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (chosenIds.has(remaining[index]._id.toString())) {
        remaining.splice(index, 1);
      }
    }
  }

  // Who plays was already decided by fair play order. Keep the most overdue
  // players on the first court / active Court rather than letting the history
  // shuffle change which group waits in the Next Player queue.
  const priorityRank = new Map(
    players.map((player, index) => [player._id.toString(), index]),
  );

  return groups
    .map((group, index) => ({
      group,
      index,
      rank:
        group.reduce(
          (total, player) =>
            total + (priorityRank.get(player._id.toString()) ?? Number.MAX_SAFE_INTEGER),
          0,
        ) / group.length,
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.group);
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
  return ALL_LEVELS.reduce((total, level) => {
    const count = players.filter(
      (player) => getLevel(player.rating, player.isNR).key === level.key,
    ).length;
    return total + Math.floor(count / 4);
  }, 0);
}

function buildLevelPairings(
  players: PlayerDoc[],
  lineupCount: number,
  history: PairHistory,
  priorityOrder?: Map<string, number> | null,
): CourtPairing[] {
  const pools = new Map<LevelKey, PlayerDoc[]>();

  for (const level of ALL_LEVELS) {
    pools.set(
      level.key,
      fairOrder(
        players.filter(
          (player) => getLevel(player.rating, player.isNR).key === level.key,
        ),
        priorityOrder,
      ),
    );
  }

  const tiers = ALL_LEVELS.map((level) => {
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

    // Who plays is still decided by fair play counts, rest, and finish order.
    // History only changes how those selected players are grouped and split.
    const selected = tier.pool.slice(0, courtsForTier * 4);

    for (const group of buildGroups(selected, history)) {
      const { team1, team2 } = splitTeams(group, history);
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
  history: PairHistory,
  priorityOrder?: Map<string, number> | null,
): CourtPairing[] {
  const selected = fairOrder(players, priorityOrder).slice(0, lineupCount * 4);
  const pairings: CourtPairing[] = [];

  for (const group of buildGroups(selected, history)) {
    const { team1, team2 } = splitTeams(group, history);
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
 * 1. Split the roster into rating groups: Beginner, Low Intermediate, High
 *    Intermediate, and Not Rated.
 * 2. A court can only be built from four players in the SAME group.
 * 3. Within each group, prioritize the fewest games played and longest rest.
 *
 * Open rate mode:
 * 1. Ignore rating bands and build courts from the full roster.
 * 2. Still prioritize the fewest games played and longest rest.
 * 3. Split each foursome into the most evenly rated teams possible.
 *
 * Both modes then look at completed-match history before choosing the groups
 * and teams. Fresh combinations are preferred, repeated opponents are avoided,
 * and pairs that were teammates are rotated into opposing teams over time.
 *
 * The committee can still override a lineup manually after generation; manual
 * edits deliberately do not enforce rating bands.
 */
export function buildRound(
  players: PlayerDoc[],
  lineupCount: number,
  mode: MatchMode = "level",
  priorityOrder?: Map<string, number> | null,
  matchHistory: MatchDoc[] = [],
) {
  const safeLineupCount = Math.max(0, Math.floor(lineupCount));
  const history = buildPairHistory(matchHistory);
  const pairings =
    mode === "open"
      ? buildOpenPairings(players, safeLineupCount, history, priorityOrder)
      : buildLevelPairings(players, safeLineupCount, history, priorityOrder);

  return {
    roundId: randomUUID(),
    pairings,
    waiting: Math.max(0, players.length - pairings.length * 4),
  };
}
