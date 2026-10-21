import { MongoClient, type Db, type ObjectId } from "mongodb";

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
      await Promise.all([
        db.collection("players").createIndex({ nameKey: 1 }, { unique: true }),
        db.collection("players").createIndex({ name: 1 }),
        db.collection("matches").createIndex({ createdAt: -1 }),
        db.collection("matches").createIndex({ status: 1, createdAt: -1 }),
        db.collection("matches").createIndex({ roundId: 1 }),
        db.collection("matches").createIndex({ "team1.playerId": 1 }),
        db.collection("matches").createIndex({ "team2.playerId": 1 }),
      ]);
    })().catch((error) => {
      globalForMongo.mongoIndexesPromise = undefined;
      throw error;
    });
  }

  await globalForMongo.mongoIndexesPromise;
  return db;
}

export type PlayerDoc = {
  _id: ObjectId;
  name: string;
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
