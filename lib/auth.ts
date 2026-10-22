import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { GENDERS, type Gender } from "./constants";

export const SESSION_COOKIE = "pc_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export type UserRole = "admin" | "player";

export type SessionUser = {
  id: string;
  alias: string;
  role: UserRole;
};

type SessionPayload = SessionUser & {
  exp: number;
};

function sessionSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.MONGODB_URI ||
    "pickle-and-chill-development-secret"
  );
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}

export function createSessionToken(user: SessionUser): string {
  const payload: SessionPayload = { ...user, exp: Date.now() + SESSION_TTL_MS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;

  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = Buffer.from(sign(data));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionPayload;
    const validRole = payload.role === "admin" || payload.role === "player";
    if (!payload?.id || !validRole || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return { id: payload.id, alias: payload.alias, role: payload.role };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  return user?.role === "admin" ? user : null;
}

export async function requirePlayer(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  return user?.role === "player" ? user : null;
}

/**
 * Every player and match belongs to exactly one admin account. API routes use
 * this helper to scope every read and write to the signed-in admin.
 */
export function ownerObjectId(user: SessionUser): ObjectId {
  return new ObjectId(user.id);
}

export function unauthorizedResponse() {
  return Response.json(
    { error: "Admin access required. Sign in with an admin account." },
    { status: 401 },
  );
}

export function signInRequiredResponse() {
  return Response.json(
    { error: "Sign in to view the court board." },
    { status: 401 },
  );
}

export function playerAccessRequiredResponse() {
  return Response.json(
    { error: "Player access required. Sign in with a player account to join a game." },
    { status: 401 },
  );
}

export function validateAlias(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const alias = value.trim().replace(/\s+/g, " ");
  if (alias.length < 3 || alias.length > 30) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 ._-]*$/.test(alias)) return null;
  return alias;
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 8 || value.length > 128) return null;
  return value;
}

export function aliasKey(alias: string): string {
  return alias.normalize("NFKC").toLowerCase();
}

export function validateGender(value: unknown): Gender | null {
  if (typeof value !== "string") return null;
  return GENDERS.some((gender) => gender.value === value) ? (value as Gender) : null;
}
