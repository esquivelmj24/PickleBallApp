import type { Gender } from "./constants";
import type { LevelKey } from "./levels";

export type Player = {
  id: string;
  name: string;
  rating: number;
  level: LevelKey;
  levelLabel: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  winRate: number;
  lastPlayedAt: string | null;
  createdAt: string;
};

export type MatchPlayer = {
  playerId: string;
  name: string;
  rating: number;
};

export type MatchMode = "level" | "open";

export type CourtLayout = "single" | "multiple";

export type Match = {
  id: string;
  roundId: string;
  court: number;
  mode: MatchMode;
  queuePosition: number;
  status: "scheduled" | "completed";
  team1: MatchPlayer[];
  team2: MatchPlayer[];
  team1Score: number | null;
  team2Score: number | null;
  winner: 1 | 2 | null;
  createdAt: string;
  completedAt: string | null;
};

export type Roster = {
  id: string;
  name: string;
  date: string;
  time: string;
  capacity: number;
  joinedCount: number;
  remaining: number;
  full: boolean;
  joined: boolean;
  ownerAlias: string;
  createdAt: string;
};

export type TierCount = {
  key: LevelKey;
  label: string;
  count: number;
};

export type Viewer = {
  role: "admin" | "player";
  alias: string;
  rating?: number;
  gender?: Gender;
  joined: boolean;
  canJoin: boolean;
  playerId?: string;
  boardOwnerAlias?: string;
  message?: string;
};

export type AppState = {
  viewer: Viewer;
  players: Player[];
  rosters: Roster[];
  activeRound: {
    roundId: string;
    mode: MatchMode;
    matches: Match[];
    scheduled: number;
    completed: number;
  } | null;
  recentMatches: Match[];
  topPlayers: Player[];
  tiers: TierCount[];
  stats: {
    totalPlayers: number;
    completedMatches: number;
    playersYetToPlay: number;
    averageRating: number;
    gamesAvailable: number;
  };
};

export type ApiError = {
  error: string;
};
