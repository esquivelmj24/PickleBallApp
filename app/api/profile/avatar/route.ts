import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { jsonError, readBody } from "@/lib/api";
import { getSessionUser, signInRequiredResponse } from "@/lib/auth";
import { getDb, type UserDoc } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_ENCODED_LENGTH = 3_000_000;
const IMAGE_DATA_URL = /^data:image\/(?:png|jpe?g|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

function getDecodedImage(image: string): Buffer | null {
  if (image.length > MAX_ENCODED_LENGTH) return null;

  const match = IMAGE_DATA_URL.exec(image);
  if (!match) return null;

  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;

  return buffer;
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return signInRequiredResponse();

    const db = await getDb();
    const account = await db.collection<UserDoc>("users").findOne(
      { _id: new ObjectId(user.id) },
      { projection: { avatarUrl: 1 } },
    );

    return NextResponse.json(
      { avatarUrl: account?.avatarUrl ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("GET /api/profile/avatar failed", error);
    return jsonError("Could not load the profile image.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return signInRequiredResponse();

    const body = await readBody(request);
    const image = body.image;

    if (typeof image !== "string" || !getDecodedImage(image)) {
      return jsonError("Upload a PNG, JPG, or WebP image smaller than 2 MB.", 400);
    }

    const db = await getDb();
    const result = await db.collection<UserDoc>("users").updateOne(
      { _id: new ObjectId(user.id) },
      { $set: { avatarUrl: image, updatedAt: new Date() } },
    );

    if (!result.matchedCount) {
      return jsonError("Account not found.", 404);
    }

    return NextResponse.json({ avatarUrl: image });
  } catch (error) {
    console.error("POST /api/profile/avatar failed", error);
    return jsonError("Could not save the profile image. Try again.", 500);
  }
}

export async function DELETE() {
  try {
    const user = await getSessionUser();
    if (!user) return signInRequiredResponse();

    const db = await getDb();
    const result = await db.collection<UserDoc>("users").updateOne(
      { _id: new ObjectId(user.id) },
      { $set: { avatarUrl: null, updatedAt: new Date() } },
    );

    if (!result.matchedCount) {
      return jsonError("Account not found.", 404);
    }

    return NextResponse.json({ avatarUrl: null });
  } catch (error) {
    console.error("DELETE /api/profile/avatar failed", error);
    return jsonError("Could not remove the profile image. Try again.", 500);
  }
}
