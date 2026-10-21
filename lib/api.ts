import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40) return null;
  if (!/[a-zA-Z]/.test(name)) return null;

  return name;
}

export function nameKey(name: string): string {
  return name.normalize("NFKC").toLowerCase();
}

export function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 99;
}

export function readBody(request: Request): Promise<Record<string, unknown>> {
  return request.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}
