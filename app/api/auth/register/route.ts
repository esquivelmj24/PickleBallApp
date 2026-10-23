import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";
import { jsonError, readBody } from "@/lib/api";
import {
  aliasKey,
  hashPassword,
  setSessionCookie,
  validateAlias,
  validateGender,
  validatePassword,
  type UserRole,
} from "@/lib/auth";
import { claimLegacyData, getDb, type UserDoc } from "@/lib/db";
import { normalizeRating } from "@/lib/levels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const alias = validateAlias(body.alias);
    const password = validatePassword(body.password);
    const role: UserRole | null =
      body.role === "player"
        ? "player"
        : body.role === "admin" || body.admin === true
          ? "admin"
          : null;

    if (!alias) {
      return jsonError(
        "Alias must be 3–30 characters using letters, numbers, spaces, dots, dashes, or underscores.",
      );
    }
    if (!password) {
      return jsonError("Password must be between 8 and 128 characters.");
    }
    if (!role) {
      return jsonError("Choose Admin user or Player user to create an account.");
    }

    let rating: number | undefined;
    let isNR: boolean | undefined;
    let gender: UserDoc["gender"];

    if (role === "player") {
      const normalizedRating = normalizeRating(body.rating);
      const normalizedGender = validateGender(body.gender);

      if (normalizedRating === null) {
        return jsonError("Rate must be between 2.0 and 4.0.");
      }
      if (!normalizedGender) {
        return jsonError("Choose a gender for the player account.");
      }

      rating = normalizedRating;
      isNR = body.isNR === true;
      gender = normalizedGender;
    }

    const db = await getDb();
    const now = new Date();
    const doc: Omit<UserDoc, "_id"> = {
      alias,
      aliasKey: aliasKey(alias),
      passwordHash: hashPassword(password),
      role,
      ...(role === "player" ? { rating, isNR, gender } : {}),
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
      role,
    });

    return NextResponse.json(
      {
        user: {
          id: result.insertedId.toString(),
          alias,
          role,
          ...(role === "player" ? { rating, isNR, gender } : {}),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return jsonError("That alias is already registered. Choose another one.", 409);
    }
    console.error("POST /api/auth/register failed", error);
    return jsonError("Could not create the account.", 500);
  }
}
