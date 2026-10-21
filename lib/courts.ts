/**
 * Court display names deliberately avoid numbers for now.
 * Single-court rounds use the generic "Court" label, while multiple-court
 * rounds use letters: Court A, Court B, Court C, ...
 */
export function courtLetter(court: number): string {
  const safeCourt = Math.max(1, Math.floor(court));
  return String.fromCharCode(64 + safeCourt);
}

export function courtDisplayName(court: number): string {
  return `Court ${courtLetter(court)}`;
}

export function courtName(court: number, singleCourt: boolean): string {
  return singleCourt ? "Court" : courtDisplayName(court);
}
