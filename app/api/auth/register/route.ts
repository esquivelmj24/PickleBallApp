import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";
import { jsonError, readBody } from "@/lib/api";
import {
  aliasKey,
  hashPassword,
  setSessionCookie,
  validateAlias,
  validatePassword,
} from "@/lib/auth";
import { claimLegacyData, getDb, type UserDoc } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const alias = validateAlias(body.alias);
    const password = validatePassword(body.password);

    if (!alias) {
      return jsonError("Alias must be 3–30 characters using letters, numbers, spaces, dots, dashes, or underscores.");
    }
    if (!password) {
      return jsonError("Password must be between 8 and 128 characters.");
    }
    if (body.admin !== true) {
      return jsonError("Confirm the admin user checkbox to create an admin account.");
    }

    const db = await getDb();
    const now = new Date();
    const doc = {
      alias,
      aliasKey: aliasKey(alias),
      passwordHash: hashPassword(password),
      role: "admin" as const,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection<UserDoc>("users").insertOne(doc as UserDoc);

    await claimLegacyData(db).catch((error) => {
      console.error("Legacy data migration failed", error);
    });

    await setSessionCookie({
      id: result.insertedId.toString(),
      alias,
      role: "admin",
    });

    return NextResponse.json(
      { user: { id: result.insertedId.toString(), alias, role: "admin" } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return jsonError("That alias is already registered. Choose another one.", 409);
    }
    console.error("POST /api/auth/register failed", error);
    return jsonError("Could not create the admin account.", 500);
  }
}
