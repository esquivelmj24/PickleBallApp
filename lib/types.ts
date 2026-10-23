import type { Gender } from "./constants";
import type { LevelKey } from "./levels";

export type Player = {
  id: string;
  name: string;
  rating: number;
  isNR: boolean;
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
  isNR: boolean;
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

export type RosterMember = {
  playerId: string;
  name: string;
  rating: number;
  isNR: boolean;
  isViewer: boolean;
  joinedAt: string;
};

export type Roster = {
  id: string;
  name: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  joinedCount: number;
  remaining: number;
  full: boolean;
  ended: boolean;
  endedAt: string | null;
  joined: boolean;
  joinedAt: string | null;
  ownerAlias: string;
  createdAt: string;
  members: RosterMember[];
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
  isNR?: boolean;
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
