export const LEVELS = [
  {
    key: "beginner",
    label: "Beginner",
    shortLabel: "BEG",
    min: 2.0,
    max: 2.5,
    color: "#4BA3FF",
    soft: "#E8F3FF",
    description: "Building the fundamentals",
  },
  {
    key: "low-intermediate",
    label: "Low Intermediate",
    shortLabel: "LOW",
    min: 2.6,
    max: 3.2,
    color: "#E8A21B",
    soft: "#FFF5DA",
    description: "Consistent rallies, growing control",
  },
  {
    key: "high-intermediate",
    label: "High Intermediate",
    shortLabel: "HIGH",
    min: 3.3,
    max: 4.0,
    color: "#E86545",
    soft: "#FFEDE7",
    description: "Strategy, pace and placement",
  },
] as const;

/**
 * Not Rated is a level of its own. A player marked NR has an unknown rate even
 * if a numeric value is still stored on their record, so the numeric value is
 * ignored for display, level grouping, and team balancing.
 */
export const NR_LEVEL = {
  key: "not-rated",
  label: "Not Rated",
  shortLabel: "NR",
  min: 0,
  max: 0,
  color: "#64748B",
  soft: "#EEF2F6",
  description: "Waiting for a committee rating",
} as const;

export const ALL_LEVELS = [...LEVELS, NR_LEVEL] as const;

export type LevelKey = (typeof ALL_LEVELS)[number]["key"];

export type RatedLevelKey = (typeof LEVELS)[number]["key"];

export type Level = (typeof ALL_LEVELS)[number];

export const MIN_RATING = 2.0;
export const MAX_RATING = 4.0;

export function normalizeRating(value: unknown): number | null {
  const rating = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    return null;
  }

  return Math.round(rating * 10) / 10;
}

export function getLevel(rating: number, isNR = false): Level {
  if (isNR) return NR_LEVEL;
  if (rating <= 2.5) return LEVELS[0];
  if (rating <= 3.2) return LEVELS[1];
  return LEVELS[2];
}

export function ratingLabel(rating: number, isNR = false): string {
  return isNR ? "NR" : rating.toFixed(1);
}
