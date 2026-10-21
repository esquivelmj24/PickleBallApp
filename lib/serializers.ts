import type { MatchDoc, PlayerDoc } from "./db";
import { getLevel, LEVELS, type LevelKey } from "./levels";
import type { Match, MatchPlayer, Player } from "./types";

export function serializePlayer(doc: PlayerDoc): Player {
  const level = getLevel(doc.rating);
  const gamesPlayed = doc.gamesPlayed || 0;
  const wins = doc.wins || 0;
  const losses = doc.losses || 0;
  const pointsFor = doc.pointsFor || 0;
  const pointsAgainst = doc.pointsAgainst || 0;

  return {
    id: doc._id.toString(),
    name: doc.name,
    rating: doc.rating,
    level: level.key,
    levelLabel: level.label,
    gamesPlayed,
    wins,
    losses,
    pointsFor,
    pointsAgainst,
    pointDiff: pointsFor - pointsAgainst,
    winRate: gamesPlayed ? Math.round((wins / gamesPlayed) * 100) : 0,
    lastPlayedAt: doc.lastPlayedAt ? doc.lastPlayedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

function serializeMatchPlayer(player: {
  playerId: { toString(): string };
  name: string;
  rating: number;
}): MatchPlayer {
  return {
    playerId: player.playerId.toString(),
    name: player.name,
    rating: player.rating,
  };
}

export function serializeMatch(doc: MatchDoc): Match {
  return {
    id: doc._id.toString(),
    roundId: doc.roundId,
    court: doc.court,
    mode: doc.mode ?? "level",
    queuePosition: doc.queuePosition ?? 1,
    status: doc.status,
    team1: doc.team1.map(serializeMatchPlayer),
    team2: doc.team2.map(serializeMatchPlayer),
    team1Score: doc.team1Score ?? null,
    team2Score: doc.team2Score ?? null,
    winner: doc.winner ?? null,
    createdAt: doc.createdAt.toISOString(),
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
  };
}

export function levelCounts(players: Player[]) {
  const keys: LevelKey[] = ["beginner", "low-intermediate", "high-intermediate"];

  return keys.map((key) => ({
    key,
    label: LEVELS.find((level) => level.key === key)?.label ?? key,
    count: players.filter((player) => player.level === key).length,
  }));
}

export function rankPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const aHasPlayed = a.gamesPlayed > 0;
    const bHasPlayed = b.gamesPlayed > 0;

    if (aHasPlayed !== bHasPlayed) return aHasPlayed ? -1 : 1;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.rating !== a.rating) return b.rating - a.rating;
    return a.name.localeCompare(b.name);
  });
}
