import { MongoClient, type Db, type ObjectId } from "mongodb";
import type { Gender } from "./constants";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not set. Add it to .env.local.");
}

const globalForMongo = globalThis as unknown as {
  mongoClientPromise?: Promise<MongoClient>;
  mongoIndexesPromise?: Promise<void>;
};

function createClient() {
  return new MongoClient(uri!, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
    maxPoolSize: 10,
  });
}

export function getMongoClient(): Promise<MongoClient> {
  if (!globalForMongo.mongoClientPromise) {
    globalForMongo.mongoClientPromise = createClient().connect();
  }
  return globalForMongo.mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  const db = client.db(process.env.MONGODB_DB || "dinkboard");

  if (!globalForMongo.mongoIndexesPromise) {
    globalForMongo.mongoIndexesPromise = (async () => {
      // Before per-admin isolation, player names were globally unique. Names
      // are now unique per admin, so remove the old index before creating the
      // owner-scoped one. Missing indexes are safe to ignore.
      await db.collection("players").dropIndex("nameKey_1").catch(() => undefined);

      // Players can now join scheduled rosters from more than one admin, so a
      // player account is unique per admin board rather than globally unique.
      await db.collection("players").dropIndex("userId_1").catch(() => undefined);

      await Promise.all([
        db.collection("players").createIndex({ ownerId: 1, nameKey: 1 }, { unique: true }),
        db.collection("players").createIndex({ ownerId: 1, name: 1 }),
        db.collection("players").createIndex(
          { ownerId: 1, userId: 1 },
          {
            unique: true,
            partialFilterExpression: { userId: { $exists: true } },
          },
        ),
        db.collection("users").createIndex({ aliasKey: 1 }, { unique: true }),
        db.collection("matches").createIndex({ ownerId: 1, createdAt: -1 }),
        db.collection("matches").createIndex({ ownerId: 1, status: 1, createdAt: -1 }),
        db.collection("matches").createIndex({ ownerId: 1, roundId: 1 }),
        db.collection("matches").createIndex({ ownerId: 1, "team1.playerId": 1 }),
        db.collection("matches").createIndex({ ownerId: 1, "team2.playerId": 1 }),
        db.collection("rosters").createIndex({
          ownerId: 1,
          endedAt: 1,
          scheduledDate: 1,
          scheduledTime: 1,
        }),
        db.collection("rosters").createIndex({
          endedAt: 1,
          scheduledDate: 1,
          scheduledTime: 1,
        }),
        db.collection("rosterEntries").createIndex(
          { rosterId: 1, userId: 1 },
          { unique: true },
        ),
        db.collection("rosterEntries").createIndex({ ownerId: 1, userId: 1 }),
        db.collection("rosterEntries").createIndex({ userId: 1, createdAt: -1 }),
      ]);

      // Boards created before per-admin isolation have no ownerId. Assign that
      // legacy data to the earliest admin so it is not stranded. New admins
      // never inherit another admin's games.
      await claimLegacyData(db).catch((error) => {
        console.error("Legacy data migration failed", error);
      });
    })().catch((error) => {
      globalForMongo.mongoIndexesPromise = undefined;
      throw error;
    });
  }

  await globalForMongo.mongoIndexesPromise;
  return db;
}

export type UserDoc = {
  _id: ObjectId;
  alias: string;
  aliasKey: string;
  passwordHash: string;
  role: "admin" | "player";
  rating?: number;
  gender?: Gender;
  createdAt: Date;
  updatedAt: Date;
};

export type PlayerDoc = {
  _id: ObjectId;
  ownerId: ObjectId;
  userId?: ObjectId;
  name: string;
  gender?: Gender;
  nameKey: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  lastPlayedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MatchPlayerDoc = {
  playerId: ObjectId;
  name: string;
  rating: number;
};

export type MatchDoc = {
  _id: ObjectId;
  ownerId: ObjectId;
  roundId: string;
  court: number;
  mode?: "level" | "open";
  queuePosition?: number;
  status: "scheduled" | "completed";
  team1: MatchPlayerDoc[];
  team2: MatchPlayerDoc[];
  team1Score: number | null;
  team2Score: number | null;
  winner: 1 | 2 | null;
  createdAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
};

/**
 * A scheduled game created by an admin. The joined count is the number of
 * player accounts that selected and joined this roster; capacity is the
 * advertised number of available slots.
 */
export type RosterDoc = {
  _id: ObjectId;
  ownerId: ObjectId;
  name: string;
  scheduledDate: string;
  scheduledTime: string;
  scheduledEndTime?: string;
  capacity: number;
  joinedCount: number;
  endedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RosterEntryDoc = {
  _id: ObjectId;
  rosterId: ObjectId;
  ownerId: ObjectId;
  userId: ObjectId;
  playerId: ObjectId;
  name: string;
  rating: number;
  createdAt: Date;
};

/**
 * Claims players and matches created before owner scoping was introduced.
 * The earliest admin account gets the old shared board; all later admins start
 * with their own empty board.
 */
export async function claimLegacyData(db: Db): Promise<void> {
  const firstAdmin = await db
    .collection<UserDoc>("users")
    .find({ role: "admin" })
    .sort({ createdAt: 1, _id: 1 })
    .limit(1)
    .next();

  if (!firstAdmin) return;

  await Promise.all([
    db.collection("players").updateMany(
      { ownerId: null },
      { $set: { ownerId: firstAdmin._id } },
    ),
    db.collection("matches").updateMany(
      { ownerId: null },
      { $set: { ownerId: firstAdmin._id } },
    ),
  ]);
}
