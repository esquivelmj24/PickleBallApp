import { NextResponse } from "next/server";
import { jsonError, readBody } from "@/lib/api";
import { aliasKey, setSessionCookie, verifyPassword } from "@/lib/auth";
import { claimLegacyData, getDb, type UserDoc } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const alias = typeof body.alias === "string" ? body.alias.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!alias || !password) {
      return jsonError("Enter your alias and password.", 400);
    }

    const db = await getDb();
    const user = await db.collection<UserDoc>("users").findOne({ aliasKey: aliasKey(alias) });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return jsonError("Invalid alias or password. Please try again.", 401);
    }

    await claimLegacyData(db).catch((error) => {
      console.error("Legacy data migration failed", error);
    });

    const role = user.role === "player" ? "player" : "admin";

    await setSessionCookie({
      id: user._id.toString(),
      alias: user.alias,
      role,
    });

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        alias: user.alias,
        role,
        ...(role === "player"
          ? { rating: user.rating, gender: user.gender }
          : {}),
      },
    });
  } catch (error) {
    console.error("POST /api/auth/login failed", error);
    return jsonError("Could not sign in. Check the database connection and try again.", 500);
  }
}
