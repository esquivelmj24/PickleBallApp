"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { genderLabel } from "@/lib/constants";
import { courtDisplayName } from "@/lib/courts";
import { formatRosterDate, formatRosterTimeRange } from "@/lib/roster-config";
import type { AppState, CourtLayout, Match, MatchMode, Player, Roster } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { LineupModal } from "./LineupModal";
import { MatchBoard } from "./MatchBoard";
import { PlayerModal } from "./PlayerModal";
import { PlayerRoster } from "./PlayerRoster";
import { RosterDetail } from "./RosterDetail";
import { RosterModal, type RosterFormValues } from "./RosterModal";
import { RosterPanel } from "./RosterPanel";
import { LevelGuide, RecentResults, TopFive } from "./SidePanels";
import { ThemeSwitcher } from "./ThemeSwitcher";
import {
  AlertIcon,
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  LogoBall,
  PlusIcon,
  SparklesIcon,
  TrophyIcon,
  UsersIcon,
} from "./icons";

type PlayerModalState = { mode: "add" } | { mode: "edit"; player: Player } | null;
type ToastState = { message: string; tone: "success" | "error" } | null;

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Something went wrong. Try again.");
  }
  return payload;
}

export function Dashboard({
  alias,
  role,
  rosterId,
}: {
  alias: string;
  role: "admin" | "player";
  rosterId?: string;
}) {
  const isAdmin = role === "admin";
  const isRosterView = Boolean(rosterId);
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [playerModal, setPlayerModal] = useState<PlayerModalState>(null);
  const [lineupMatch, setLineupMatch] = useState<Match | null>(null);
  const [deletePlayer, setDeletePlayer] = useState<Player | null>(null);
  const [resetGameOpen, setResetGameOpen] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [endRosterOpen, setEndRosterOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [joiningRosterId, setJoiningRosterId] = useState<string | null>(null);

  const loadState = useCallback(
    async (initial = false) => {
      if (initial) setLoading(true);
      try {
        const endpoint = rosterId
          ? `/api/state?rosterId=${encodeURIComponent(rosterId)}`
          : "/api/state";
        const nextState = await apiRequest<AppState>(endpoint, { cache: "no-store" });
        setState(nextState);
        setLoadError("");
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Could not load the court board.");
        if (initial) setState(null);
      } finally {
        if (initial) setLoading(false);
      }
    },
    [rosterId],
  );

  useEffect(() => {
    void loadState(true);
  }, [loadState]);

  // Keep joined/capacity ratios in sync for everyone viewing the page. Polling
  // only the roster summaries keeps this light while the full board stays put.
  useEffect(() => {
    let active = true;

    async function refreshRosters() {
      if (document.visibilityState !== "visible") return;
      try {
        const rosters = await apiRequest<Roster[]>("/api/rosters", { cache: "no-store" });
        if (!active) return;
        setState((current) => (current ? { ...current, rosters } : current));
      } catch {
        // A background refresh failure should not interrupt the current board.
      }
    }

    const timer = window.setInterval(() => void refreshRosters(), 15_000);
    const onFocus = () => void refreshRosters();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshRosters();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(message: string, tone: "success" | "error" = "success") {
    setToast({ message, tone });
  }

  async function handlePlayerSubmit(payload: { name: string; rating: number }) {
    const editing = playerModal?.mode === "edit" ? playerModal.player : null;
    await apiRequest(editing ? `/api/players/${editing.id}` : "/api/players", {
      method: editing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });

    setPlayerModal(null);
    showToast(editing ? `${payload.name} updated.` : `${payload.name} added to the roster.`);
    await loadState();
  }

  async function handleDeletePlayer() {
    if (!deletePlayer) return;
    await apiRequest(`/api/players/${deletePlayer.id}`, { method: "DELETE" });
    showToast(`${deletePlayer.name} removed from the roster.`);
    setDeletePlayer(null);
    await loadState();
  }

  async function handleResetGame() {
    const result = await apiRequest<{ players: number; matches: number }>(
      "/api/reset/session",
      {
        method: "DELETE",
        body: JSON.stringify({ confirm: "RESET" }),
      },
    );
    setResetGameOpen(false);
    await loadState();
    showToast(
      `Game reset. ${result.matches} match${result.matches === 1 ? "" : "es"} cleared; roster and ratings kept.`,
    );
    window.setTimeout(() => {
      document.getElementById("rotation")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  async function handleClearAll() {
    const result = await apiRequest<{ players: number; matches: number; rosters: number }>(
      "/api/reset",
      {
        method: "DELETE",
        body: JSON.stringify({ confirm: "CLEAR ALL" }),
      },
    );
    setClearAllOpen(false);
    await loadState();
    showToast(
      `Board cleared. ${result.players} player${result.players === 1 ? "" : "s"}, ${
        result.matches
      } match${result.matches === 1 ? "" : "es"}, and ${result.rosters} roster${
        result.rosters === 1 ? "" : "s"
      } removed.`,
    );
    if (isRosterView) {
      window.setTimeout(() => {
        window.location.href = "/#rosters";
      }, 650);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  async function handleGenerate(layout: CourtLayout, courts: number, mode: MatchMode) {
    const result = await apiRequest<{
      waiting: number;
      courts: number;
      queued: number;
      layout: CourtLayout;
    }>("/api/matches/generate", {
      method: "POST",
      body: JSON.stringify({ courts, mode, layout }),
    });
    await loadState();
    const label = mode === "open" ? "Open Rate" : "Level";
    const details: string[] = [];
    if (layout === "single") {
      details.push("Court + Next Player built");
    } else {
      details.push(
        `${result.courts} court${result.courts === 1 ? "" : "s"} built`,
      );
      details.push("First finishers ranked first");
    }
    if (result.waiting > 0) {
      details.push(
        `${result.waiting} player${result.waiting === 1 ? "" : "s"} waiting`,
      );
    }
    showToast(`${label} rotation — ${details.join(" · ")}.`);

    window.setTimeout(() => {
      document.getElementById("rotation")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  async function handleAddNextLineup() {
    const result = await apiRequest<{
      court: number;
      queuePosition: number;
      queued: boolean;
      waiting: number;
    }>("/api/matches/next", {
      method: "POST",
    });
    await loadState();
    showToast(
      result.queued
        ? `Next Player queued${
            result.waiting > 0 ? ` · ${result.waiting} still available` : ""
          }.`
        : `${courtDisplayName(result.court)} added${
            result.waiting > 0 ? ` · ${result.waiting} still available` : ""
          }.`,
    );
  }

  async function handleSaveScore(matchId: string, team1Score: number, team2Score: number) {
    await apiRequest(`/api/matches/${matchId}/score`, {
      method: "POST",
      body: JSON.stringify({ team1Score, team2Score }),
    });
    await loadState();
    showToast("Score saved. Leaderboard and play counts updated.");
  }

  async function handleLineupSubmit(team1: string[], team2: string[]) {
    if (!lineupMatch) return;
    await apiRequest(`/api/matches/${lineupMatch.id}`, {
      method: "PATCH",
      body: JSON.stringify({ team1, team2 }),
    });
    setLineupMatch(null);
    showToast(`${lineupCourtLabel} lineup updated.`);
    await loadState();
  }

  async function handleLoadSample() {
    setSampleLoading(true);
    try {
      const result = await apiRequest<{ added: number }>("/api/demo", { method: "POST" });
      await loadState();
      showToast(`${result.added} sample players added. Set their rates or start shuffling.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not load sample players.", "error");
    } finally {
      setSampleLoading(false);
    }
  }

  async function handleCreateRoster(payload: RosterFormValues) {
    const created = await apiRequest<Roster>("/api/rosters", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setRosterModalOpen(false);
    await loadState();
    showToast(
      `${created.name} scheduled for ${created.date} · 0/${created.capacity} joined.`,
    );
    window.setTimeout(() => {
      document.getElementById("rosters")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  async function handleEndRoster() {
    if (!activeRoster) return;

    await apiRequest(`/api/rosters/${activeRoster.id}/end`, { method: "POST" });
    setEndRosterOpen(false);
    await loadState();
    showToast(`${activeRoster.name} ended. It is no longer available to players.`);
  }

  async function handleJoinRoster(roster: Roster) {
    setJoiningRosterId(roster.id);
    try {
      const result = await apiRequest<{
        alreadyJoined: boolean;
        joinedCount: number;
        capacity: number;
      }>(`/api/rosters/${roster.id}/join`, { method: "POST" });
      await loadState();
      showToast(
        result.alreadyJoined
          ? `You already joined ${roster.name} · ${result.joinedCount}/${result.capacity} spots filled.`
          : `You joined ${roster.name} · ${result.joinedCount}/${result.capacity} spots filled.`,
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not join that roster.", "error");
    } finally {
      setJoiningRosterId(null);
    }
  }

  const occupiedByCourt = useMemo(() => {
    const occupied = new Map<string, number>();
    if (!lineupMatch || !state?.activeRound) return occupied;

    state.activeRound.matches.forEach((match) => {
      if (match.id === lineupMatch.id || match.status !== "scheduled") return;
      [...match.team1, ...match.team2].forEach((player) => {
        occupied.set(player.playerId, match.court);
      });
    });
    return occupied;
  }, [lineupMatch, state]);

  const lineupQueued = useMemo(() => {
    if (!lineupMatch || !state?.activeRound) return false;
    const nextScheduled = state.activeRound.matches
      .filter((match) => match.court === lineupMatch.court && match.status === "scheduled")
      .sort((a, b) => a.queuePosition - b.queuePosition)[0];
    return Boolean(nextScheduled && nextScheduled.id !== lineupMatch.id);
  }, [lineupMatch, state]);

  const lineupSingleCourt = useMemo(() => {
    if (!state?.activeRound) return true;
    return new Set(state.activeRound.matches.map((match) => match.court)).size <= 1;
  }, [state]);

  const lineupCourtLabel = useMemo(() => {
    if (!lineupMatch) return "Court";
    if (lineupQueued) return "Next Player";
    return lineupSingleCourt ? "Court" : courtDisplayName(lineupMatch.court);
  }, [lineupMatch, lineupQueued, lineupSingleCourt]);

  const activeRoster = useMemo(() => {
    if (!state || !rosterId) return null;
    return state.rosters.find((roster) => roster.id === rosterId) ?? null;
  }, [rosterId, state]);

  if (loading) return <LoadingScreen />;

  if (!state) {
    return (
      <div className="page-shell">
        <div className="load-error panel">
          <div className="load-error-icon">
            <AlertIcon size={26} />
          </div>
          <span className="eyebrow">Connection needed</span>
          <h1>We couldn&apos;t open the court board.</h1>
          <p>{loadError}</p>
          <button type="button" className="btn btn-primary" onClick={() => void loadState(true)}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { stats } = state;
  const playedPlayers = stats.totalPlayers - stats.playersYetToPlay;
  const playedPercent = stats.totalPlayers ? Math.round((playedPlayers / stats.totalPlayers) * 100) : 0;
  const openRosterCount = state.rosters.filter((roster) => !roster.full).length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Pickle & Chill home">
          <span className="brand-ball"><LogoBall size={38} /></span>
          <span className="brand-copy">
            <strong>PICKLE &amp; CHILL</strong>
            <small>{isAdmin ? "Committee console" : "Player console"}</small>
          </span>
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          {isRosterView ? (
            <>
              <a href="#roster-details">Roster details</a>
              <a href="#rotation">Live rotation</a>
              <a href="#players">Players</a>
              <a href="#top-five-title">Leaderboard</a>
            </>
          ) : (
            <a href="#rosters">Rosters</a>
          )}
        </nav>

        <div className="topbar-actions">
          <span className="live-indicator">
            <span />
            Court desk live
          </span>
          <ThemeSwitcher compact />
          <span
            className={`admin-chip ${isAdmin ? "" : "is-player"}`}
            title={isAdmin ? "Signed in as admin" : "Signed in as player"}
          >
            <span className="admin-dot" />
            {alias}
            <span className="role-label">{isAdmin ? "Admin" : "Player"}</span>
          </span>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => void handleLogout()}>
            Log out
          </button>
        </div>
      </header>

      <main className="page-shell" id="top">
        {!isRosterView ? (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow hero-eyebrow">
                  <span className="eyebrow-ball"><LogoBall size={17} /></span>
                  {isAdmin ? "Pickleball club · Leveling committee" : "Pickleball club · Player view"}
                </div>
                <h1>
                  Balanced courts.
                  <br />
                  <span>Better games.</span>
                </h1>
                <p className="hero-lede">
                  {isAdmin
                    ? "Rate every player, create scheduled game rosters, build level-matched or Open Rate courts, and keep the leaderboard honest. Everyone gets a game before anyone gets a repeat."
                    : "Browse the scheduled game rosters, reserve your spot, and follow the live rotation. Your registered rate is used automatically for balanced courts."}
                </p>
                <div className="hero-actions">
                  {isAdmin ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-large"
                      onClick={() => {
                        if (state.rosters.length === 0) {
                          setRosterModalOpen(true);
                        } else {
                          document
                            .getElementById("rosters")
                            ?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                    >
                      {state.rosters.length === 0 ? (
                        <PlusIcon size={18} />
                      ) : (
                        <CalendarIcon size={18} />
                      )}
                      {state.rosters.length === 0 ? "Create your first roster" : "Open a roster"}
                      <ArrowUpRightIcon size={17} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-large"
                      onClick={() => {
                        document
                          .getElementById("rosters")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      <CalendarIcon size={18} />
                      {openRosterCount > 0 ? "Choose a roster" : "View rosters"}
                      <ArrowUpRightIcon size={17} />
                    </button>
                  )}
                </div>
                <div className="hero-proof">
                  <span><CheckIcon size={14} /> No player on two active courts</span>
                  <span><CheckIcon size={14} /> Level or Open Rate courts</span>
                  <span><CheckIcon size={14} /> Fair play counts</span>
                </div>
              </div>

              <div className="night-card">
                <div className="night-lines" aria-hidden>
                  <span className="night-line-v" />
                  <span className="night-line-h" />
                  <span className="night-line-kitchen" />
                </div>
                <div className="night-card-head">
                  <div>
                    <span className="eyebrow eyebrow-light">Live board</span>
                    <h2>{state.activeRound?.scheduled ? "Rotation in play" : "Ready for first serve"}</h2>
                  </div>
                  <span className="live-chip"><span /> Live</span>
                </div>

                <div className="night-hero-number">
                  <strong>{stats.totalPlayers}</strong>
                  <span>
                    players
                    <br />
                    on the board
                  </span>
                </div>

                <div className="night-stat-grid">
                  <div>
                    <span>Average rate</span>
                    <strong>{stats.averageRating ? stats.averageRating.toFixed(1) : "—"}</strong>
                  </div>
                  <div>
                    <span>Courts</span>
                    <strong>{stats.gamesAvailable}</strong>
                  </div>
                  <div>
                    <span>Yet to play</span>
                    <strong>{stats.playersYetToPlay}</strong>
                  </div>
                </div>

                <div className="night-progress">
                  <div className="night-progress-copy">
                    <span>Roster has played</span>
                    <strong>{playedPlayers}/{stats.totalPlayers}</strong>
                  </div>
                  <div className="night-progress-track">
                    <span style={{ width: `${playedPercent}%` }} />
                  </div>
                </div>

                <div className="night-ball" aria-hidden>
                  <LogoBall size={96} />
                </div>
                <span className="night-tag">FAIR PLAY · GOOD GAMES</span>
              </div>
            </section>

            <div className="stat-strip">
              <div className="stat-card">
                <span className="stat-icon"><UsersIcon size={18} /></span>
                <div><strong>{stats.totalPlayers}</strong><span>Players rated</span></div>
              </div>
              <div className="stat-card">
                <span className="stat-icon"><TrophyIcon size={18} /></span>
                <div><strong>{stats.completedMatches}</strong><span>Matches completed</span></div>
              </div>
              <div className="stat-card">
                <span className="stat-icon"><SparklesIcon size={18} /></span>
                <div><strong>{stats.playersYetToPlay}</strong><span>Awaiting a game</span></div>
              </div>
              <div className="stat-card">
                <span className="stat-icon stat-icon-dark"><LogoBall size={21} /></span>
                <div><strong>{stats.gamesAvailable}</strong><span>Full level courts</span></div>
              </div>
            </div>

            <RosterPanel
              rosters={state.rosters}
              isAdmin={isAdmin}
              onCreate={() => setRosterModalOpen(true)}
            />
          </>
        ) : activeRoster ? (
          <>
            <RosterDetail
              roster={activeRoster}
              isAdmin={isAdmin}
              joiningId={joiningRosterId}
              onJoin={handleJoinRoster}
              onEndRoster={() => setEndRosterOpen(true)}
            />

            {!isAdmin ? (
              <section
                className={`player-banner ${activeRoster.joined ? "is-joined" : ""} has-roster`}
                aria-label="Player access"
              >
                <div className="player-banner-copy">
                  <span className="eyebrow">
                    {activeRoster.joined ? "Your joined roster" : "Roster review"}
                  </span>
                  <strong>
                    {activeRoster.joined
                      ? "You are on this game board"
                      : activeRoster.full
                        ? "This roster is full"
                        : "Review this roster before joining"}
                  </strong>
                  <div className="player-banner-roster-line">
                    <span className="player-banner-roster-name">{activeRoster.name}</span>
                    <span>
                      <CalendarIcon size={13} />
                      {formatRosterDate(activeRoster.date)}
                    </span>
                    <span>
                      <ClockIcon size={13} />
                      {formatRosterTimeRange(activeRoster.startTime, activeRoster.endTime)}
                    </span>
                    <span className="player-banner-roster-ratio">
                      {activeRoster.joinedCount}/{activeRoster.capacity} joined ·{" "}
                      {activeRoster.remaining} slot
                      {activeRoster.remaining === 1 ? "" : "s"} left
                    </span>
                  </div>
                  <span>
                    {activeRoster.joined
                      ? "Your registered rate is on this board. The admin manages teams, scores, and game settings."
                      : "Check the roster details above, then join when you are ready. Your registered rate is added to the board automatically."}
                  </span>
                  <div className="player-banner-meta">
                    <span>Registered rate {state.viewer.rating?.toFixed(1) ?? "—"}</span>
                    {state.viewer.gender ? (
                      <span>{genderLabel(state.viewer.gender)}</span>
                    ) : null}
                    <span>Board host: {activeRoster.ownerAlias}</span>
                    <span>{activeRoster.remaining} slots left</span>
                  </div>
                </div>
                <div className="player-banner-actions">
                  <span className="view-only-chip">
                    <LockIcon size={13} />
                    View-only board
                  </span>
                  <span className={`player-status ${activeRoster.joined ? "is-joined" : ""}`}>
                    {activeRoster.joined ? <CheckIcon size={14} /> : <UsersIcon size={14} />}
                    {activeRoster.joined
                      ? "Joined"
                      : activeRoster.full
                        ? "Roster full"
                        : "Not joined"}
                  </span>
                </div>
              </section>
            ) : null}

            <div className="content-grid">
              <div className="main-column">
                <MatchBoard
                  players={state.players}
                  activeRound={state.activeRound}
                  onGenerate={handleGenerate}
                  onAddNextLineup={handleAddNextLineup}
                  onSaveScore={handleSaveScore}
                  onEditLineup={setLineupMatch}
                  onAddPlayer={() => setPlayerModal({ mode: "add" })}
                  onReset={() => setResetGameOpen(true)}
                  readOnly={!isAdmin}
                />

                <PlayerRoster
                  players={state.players}
                  topPlayerIds={state.topPlayers.map((player) => player.id)}
                  onAdd={() => setPlayerModal({ mode: "add" })}
                  canAddPlayer={Boolean(state.activeRound)}
                  onEdit={(player) => setPlayerModal({ mode: "edit", player })}
                  onDelete={setDeletePlayer}
                  onClearAll={() => setClearAllOpen(true)}
                  canClearAll={
                    state.players.length > 0 ||
                    state.stats.completedMatches > 0 ||
                    Boolean(state.activeRound)
                  }
                  onLoadSample={handleLoadSample}
                  sampleLoading={sampleLoading}
                  readOnly={!isAdmin}
                  viewerPlayerId={state.viewer.playerId}
                />
              </div>

              <aside className="side-column">
                <TopFive players={state.topPlayers} />
                <LevelGuide tiers={state.tiers} total={stats.totalPlayers} />
                <RecentResults matches={state.recentMatches} />
              </aside>
            </div>
          </>
        ) : (
          <section className="panel roster-missing" aria-labelledby="roster-missing-title">
            <span className="eyebrow">Roster unavailable</span>
            <h1 id="roster-missing-title">Roster not found</h1>
            <p>
              This roster may have been removed, or it belongs to a different admin account.
              Return to the roster list and choose an available game.
            </p>
            <Link href="/#rosters" className="btn btn-primary">
              <ArrowLeftIcon size={16} />
              Back to rosters
            </Link>
          </section>
        )}

        <footer className="site-footer">
          <div className="footer-brand">
            <LogoBall size={28} />
            <span>Pickle &amp; Chill</span>
          </div>
          <p>Built for fair play, balanced courts, and more time dinking.</p>
          <div className="footer-meta">
            <span><span className="footer-dot" /> MongoDB connected</span>
            <span>Leveling console</span>
          </div>
        </footer>
      </main>

      {isAdmin && playerModal ? (
        <PlayerModal
          mode={playerModal.mode}
          player={playerModal.mode === "edit" ? playerModal.player : undefined}
          onClose={() => setPlayerModal(null)}
          onSubmit={handlePlayerSubmit}
        />
      ) : null}

      {isAdmin && lineupMatch ? (
        <LineupModal
          match={lineupMatch}
          players={state.players}
          courtLabel={lineupCourtLabel}
          occupiedByCourt={occupiedByCourt}
          onClose={() => setLineupMatch(null)}
          onSubmit={handleLineupSubmit}
        />
      ) : null}

      {isAdmin && deletePlayer ? (
        <ConfirmDialog
          title={`Remove ${deletePlayer.name}?`}
          message="They will leave the active roster and stop appearing in match rotations. Completed match history keeps its player snapshots."
          confirmLabel="Remove player"
          onClose={() => setDeletePlayer(null)}
          onConfirm={handleDeletePlayer}
        />
      ) : null}

      {isAdmin && resetGameOpen ? (
        <ConfirmDialog
          title="Reset the game?"
          message="This clears the current rotation, all saved matches, and the session W/L totals for every player. The roster and ratings are kept. You will return to setup to start a new game."
          confirmLabel="Reset game"
          cancelLabel="Keep playing"
          workingLabel="Resetting…"
          requirePhrase="RESET"
          onClose={() => setResetGameOpen(false)}
          onConfirm={handleResetGame}
        />
      ) : null}

      {isAdmin && clearAllOpen ? (
        <ConfirmDialog
          title="Clear the entire board?"
          message={`This permanently removes ${
            state.players.length > 0 ? `all ${state.players.length} players, ` : ""
          }every saved match, all game rosters, and the Top 5 leaderboard. This cannot be undone.`}
          confirmLabel="Clear all data"
          cancelLabel="Cancel"
          workingLabel="Clearing…"
          requirePhrase="CLEAR ALL"
          onClose={() => setClearAllOpen(false)}
          onConfirm={handleClearAll}
        />
      ) : null}

      {isAdmin && endRosterOpen && activeRoster ? (
        <ConfirmDialog
          title={`End ${activeRoster.name}?`}
          message="This ends the roster transaction and removes it from player roster lists. No one else can join, but the joined-player list, board, and history stay available to you."
          confirmLabel="End Transaction"
          cancelLabel="Keep roster open"
          workingLabel="Ending…"
          onClose={() => setEndRosterOpen(false)}
          onConfirm={handleEndRoster}
        />
      ) : null}

      {isAdmin && rosterModalOpen ? (
        <RosterModal
          onClose={() => setRosterModalOpen(false)}
          onSubmit={handleCreateRoster}
        />
      ) : null}

      {toast ? (
        <div className={`toast toast-${toast.tone}`} role="status">
          <span className="toast-icon">
            {toast.tone === "success" ? <CheckIcon size={16} /> : <AlertIcon size={16} />}
          </span>
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-ball"><LogoBall size={38} /></span>
          <span className="brand-copy">
            <strong>PICKLE &amp; CHILL</strong>
            <small>Committee console</small>
          </span>
        </div>
      </header>
      <main className="page-shell loading-shell">
        <div className="loading-hero">
          <span className="skeleton skeleton-eyebrow" />
          <span className="skeleton skeleton-title" />
          <span className="skeleton skeleton-title short" />
          <span className="skeleton skeleton-copy" />
          <span className="skeleton skeleton-copy short" />
          <div className="skeleton-actions">
            <span className="skeleton skeleton-button" />
            <span className="skeleton skeleton-button" />
          </div>
        </div>
        <div className="loading-card">
          <span className="loading-ball"><LogoBall size={42} /></span>
          <span>Opening the court board…</span>
        </div>
        <div className="loading-grid">
          <span className="skeleton skeleton-panel" />
          <span className="skeleton skeleton-panel" />
        </div>
      </main>
    </div>
  );
}
