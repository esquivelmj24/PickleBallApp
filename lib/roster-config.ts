export const ROSTER_CAPACITIES = [10, 20, 30, 40, 50, 60] as const;

export type RosterCapacity = (typeof ROSTER_CAPACITIES)[number];

export function formatRosterDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRosterTime(value: string): string {
  const [hour, minute] = value.split(":").map(Number);
  if (hour === undefined || minute === undefined) return value;

  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
