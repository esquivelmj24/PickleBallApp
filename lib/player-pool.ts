import { MongoServerError, type Db, type ObjectId } from "mongodb";
import { nameKey } from "./api";
import type { PlayerDoc, UserDoc } from "./db";

type JoinResult = {
  player: PlayerDoc;
  alreadyJoined: boolean;
};

/**
 * Add a player account to one admin's matchmaking pool. A player account can
 * appear once per admin board, and repeated joins are idempotent. This shared
 * helper is used by both the legacy board Join action and scheduled rosters.
 */
export async function joinOwnerBoard(
  db: Db,
  userDoc: UserDoc,
  ownerId: ObjectId,
): Promise<JoinResult> {
  if (!userDoc.rating || !userDoc.gender) {
    throw new Error("INCOMPLETE_PROFILE");
  }

  const players = db.collection<PlayerDoc>("players");
  const userId = userDoc._id;

  const existingAccountPlayer = await players.findOne({ ownerId, userId });
  if (existingAccountPlayer) {
    return { player: existingAccountPlayer, alreadyJoined: true };
  }

  const now = new Date();
  const key = nameKey(userDoc.alias);
  const sameName = await players.findOne({ ownerId, nameKey: key });

  if (sameName) {
    if (sameName.userId && !sameName.userId.equals(userId)) {
      throw new Error("NAME_TAKEN");
    }

    const updated = await players.findOneAndUpdate(
      { _id: sameName._id, ownerId },
      {
        $set: {
          userId,
          rating: userDoc.rating,
          gender: userDoc.gender,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );

    if (!updated) throw new Error("JOIN_FAILED");
    return { player: updated, alreadyJoined: false };
  }

  const doc: Omit<PlayerDoc, "_id"> = {
    ownerId,
    userId,
    name: userDoc.alias,
    nameKey: key,
    rating: userDoc.rating,
    gender: userDoc.gender,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    lastPlayedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await players.insertOne(doc as PlayerDoc);
    return {
      player: { ...doc, _id: result.insertedId },
      alreadyJoined: false,
    };
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      const joined = await players.findOne({ ownerId, userId });
      if (joined) return { player: joined, alreadyJoined: true };

      const nameMatch = await players.findOne({ ownerId, nameKey: key });
      if (nameMatch) {
        if (nameMatch.userId && !nameMatch.userId.equals(userId)) {
          throw new Error("NAME_TAKEN");
        }
        return { player: nameMatch, alreadyJoined: false };
      }
    }
    throw error;
  }
}
