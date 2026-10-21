export function timeAgo(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function averageRating(players: { rating: number }[]): string {
  if (!players.length) return "—";
  const total = players.reduce((sum, player) => sum + player.rating, 0);
  return (total / players.length).toFixed(1);
}

/**
 * New players start with zero recorded games. For rotation priority, treat them
 * as if they already have the lowest positive play count so they do not jump
 * ahead of players who have already been waiting their turn.
 */
export function minimumPositiveGames(players: { gamesPlayed: number }[]): number {
  return players.reduce((minimum, player) => {
    if (player.gamesPlayed > 0 && player.gamesPlayed < minimum) {
      return player.gamesPlayed;
    }
    return minimum;
  }, Number.POSITIVE_INFINITY);
}

export function effectiveGamesPlayed(gamesPlayed: number, minimumPositive: number): number {
  if (gamesPlayed > 0) return gamesPlayed;
  return Number.isFinite(minimumPositive) ? minimumPositive : 0;
}

export function playerRestTime(player: {
  lastPlayedAt: string | Date | null;
  createdAt: string | Date;
}): number {
  const value = player.lastPlayedAt ?? player.createdAt;
  return new Date(value).getTime();
}
