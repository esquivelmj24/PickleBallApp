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
 * Players who arrived late or have played fewer games are catch-up priorities.
 * Among players with the same play count, the longest rest comes first. For a
 * player who has not played yet, createdAt is used as the rest anchor so the
 * earliest-arriving zero-game player is served first.
 */
export function playerRestTime(player: {
  lastPlayedAt: string | Date | null;
  createdAt: string | Date;
}): number {
  const value = player.lastPlayedAt ?? player.createdAt;
  return new Date(value).getTime();
}
