"use client";

import { useEffect, useState } from "react";
import { MAX_COURTS } from "@/lib/constants";
import { courtLetter, courtName } from "@/lib/courts";
import { averageRating, playerRestTime } from "@/lib/format";
import { getLevel, LEVELS } from "@/lib/levels";
import type { AppState, CourtLayout, Match, MatchMode, Player } from "@/lib/types";
import { Avatar } from "./Avatar";
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  CourtIcon,
  LockIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  RotateIcon,
  ShuffleIcon,
  TrophyIcon,
} from "./icons";

type MatchBoardProps = {
  players: Player[];
  activeRound: AppState["activeRound"];
  onGenerate: (layout: CourtLayout, courts: number, mode: MatchMode) => Promise<void>;
  onAddNextLineup: () => Promise<void>;
  onSaveScore: (matchId: string, team1Score: number, team2Score: number) => Promise<void>;
  onEditLineup: (match: Match) => void;
  onAddPlayer: () => void;
  onReset: () => void;
  readOnly?: boolean;
};

type CourtCardProps = {
  match: Match;
  queued: boolean;
  singleCourt: boolean;
  saving: boolean;
  onSaveScore: (matchId: string, team1Score: number, team2Score: number) => Promise<void>;
  onEditLineup: (match: Match) => void;
  readOnly: boolean;
};

function CourtCard({
  match,
  queued,
  singleCourt,
  saving,
  onSaveScore,
  onEditLineup,
  readOnly,
}: CourtCardProps) {
  const [score1, setScore1] = useState(match.team1Score?.toString() ?? "");
  const [score2, setScore2] = useState(match.team2Score?.toString() ?? "");
  const [error, setError] = useState("");
  const completed = match.status === "completed";

  useEffect(() => {
    setScore1(match.team1Score?.toString() ?? "");
    setScore2(match.team2Score?.toString() ?? "");
    setError("");
  }, [match.id, match.team1Score, match.team2Score]);

  async function handleSave() {
    setError("");
    const team1Score = Number(score1);
    const team2Score = Number(score2);

    if (score1 === "" || score2 === "" || !Number.isInteger(team1Score) || !Number.isInteger(team2Score)) {
      setError("Enter both scores as whole numbers.");
      return;
    }
    if (team1Score < 0 || team1Score > 99 || team2Score < 0 || team2Score > 99) {
      setError("Scores must be between 0 and 99.");
      return;
    }
    if (team1Score === team2Score) {
      setError("Pickleball games cannot end in a tie.");
      return;
    }

    try {
      await onSaveScore(match.id, team1Score, team2Score);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the score.");
    }
  }

  const winningTeam = match.winner;
  const losingTeam = completed && winningTeam ? (winningTeam === 1 ? 2 : 1) : null;
  const isOpenRate = match.mode === "open";
  const courtPlayers = [...match.team1, ...match.team2];
  const courtLevels = Array.from(new Set(courtPlayers.map((player) => getLevel(player.rating).key)));
  const mixedLevels = courtLevels.length > 1;
  const courtLevel = getLevel(courtPlayers[0]?.rating ?? 2);
  const levelColor = isOpenRate ? "#21618C" : mixedLevels ? "#B06B18" : courtLevel.color;
  const levelSoft = isOpenRate ? "#EAF4FB" : mixedLevels ? "#FFF1DB" : courtLevel.soft;
  const activeCourtName = courtName(match.court, singleCourt);
  const cardName = queued ? "Next Player" : activeCourtName;

  return (
    <article className={`court-card ${completed ? "is-completed" : ""} ${queued ? "is-queued" : ""}`}>
      <div className="court-card-top">
        <div className="court-label">
          <CourtIcon size={16} />
          <span>{cardName}</span>
          {queued && !singleCourt ? (
            <span className="queue-court-tag">{activeCourtName}</span>
          ) : null}
        </div>
        <div className="court-top-tags">
          <span
            className={`court-band ${isOpenRate ? "is-open" : ""} ${mixedLevels ? "is-mixed" : ""}`}
            style={{ color: levelColor, background: levelSoft }}
            title={
              isOpenRate
                ? "Open Rate court — rating bands are intentionally mixed"
                : mixedLevels
                  ? "Mixed rating bands from a committee lineup override"
                  : "Automatic level-matched court"
            }
          >
            <span className="level-dot" style={{ background: levelColor }} />
            {isOpenRate ? "Open Rate" : mixedLevels ? "Mixed levels" : courtLevel.label}
          </span>
          <span className={`match-status ${completed ? "is-final" : ""} ${queued ? "is-queued" : ""}`}>
            {queued ? (
              <>
                <ClockIcon size={13} /> {singleCourt ? "Next up" : "Queued"}
              </>
            ) : completed ? (
              <>
                <CheckIcon size={13} /> Final
              </>
            ) : (
              <>
                <span className="status-pulse" /> Ready
              </>
            )}
          </span>
        </div>
      </div>

      <div className="court-surface">
        <div className="court-line court-line-top" aria-hidden />
        <div className="court-line court-line-bottom" aria-hidden />
        {[1, 2].map((teamNumber) => {
          const team = teamNumber === 1 ? match.team1 : match.team2;
          const isWinner = completed && winningTeam === teamNumber;
          const isLoser = completed && losingTeam === teamNumber;
          return (
            <div
              key={teamNumber}
              className={`match-team match-team-${teamNumber} ${isWinner ? "is-winner" : ""}`}
            >
              <div className="match-team-head">
                <span className="team-dot" />
                <span>Team {teamNumber === 1 ? "A" : "B"}</span>
                <span className="team-average">avg {averageRating(team)}</span>
                {isWinner ? (
                  <span className="winner-tag">
                    <TrophyIcon size={12} /> Win
                  </span>
                ) : isLoser ? (
                  <span className="loser-tag">Loss</span>
                ) : null}
              </div>
              <div className="match-team-players">
                {team.map((player) => (
                  <div className="match-player" key={player.playerId}>
                    <Avatar name={player.name} size="xs" />
                    <span className="match-player-name">{player.name}</span>
                    <span className="match-player-rating">{player.rating.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="versus-badge">VS</div>
      </div>

      <div className="court-card-foot">
        {queued ? (
          <>
            <span className="queue-note">
              <ClockIcon size={13} />
              {singleCourt ? "Next group on Court" : `Up next on ${activeCourtName}`}
            </span>
            <span className="queue-lock">
              <LockIcon size={13} />
              {singleCourt
                ? "Locked until Court is clear"
                : `Locked until ${activeCourtName} is clear`}
            </span>
          </>
        ) : readOnly ? (
          <>
            <div className="readonly-score">
              <span className="score-label">Score</span>
              <strong>{match.team1Score ?? "—"}</strong>
              <span className="score-colon">:</span>
              <strong>{match.team2Score ?? "—"}</strong>
              <span className="score-status">
                {completed ? "Final" : "Awaiting admin"}
              </span>
            </div>
            {completed ? (
              <span className="final-note result-note">
                <span className="result-win">Team {winningTeam === 1 ? "A" : "B"} won</span>
                <span className="result-loss">Team {losingTeam === 1 ? "A" : "B"} lost</span>
              </span>
            ) : (
              <span className="score-managed-note">
                <LockIcon size={13} />
                Scores are managed by the admin
              </span>
            )}
          </>
        ) : (
          <>
            <div className="score-entry">
              <span className="score-label">Score</span>
              <input
                className="score-input"
                type="number"
                min={0}
                max={99}
                inputMode="numeric"
                value={score1}
                onChange={(event) => setScore1(event.target.value)}
                aria-label={`${cardName} team A score`}
              />
              <span className="score-colon">:</span>
              <input
                className="score-input"
                type="number"
                min={0}
                max={99}
                inputMode="numeric"
                value={score2}
                onChange={(event) => setScore2(event.target.value)}
                aria-label={`${cardName} team B score`}
              />
              <button
                type="button"
                className="btn btn-dark btn-small"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <span className="spinner spinner-light" aria-hidden /> : <CheckIcon size={15} />}
                {saving ? "Saving…" : completed ? "Update" : "Save result"}
              </button>
            </div>
            {!completed ? (
              <button
                type="button"
                className="lineup-btn"
                onClick={() => onEditLineup(match)}
                title="Committee override — change players"
              >
                <PencilIcon size={14} />
                Change lineup
              </button>
            ) : (
              <span className="final-note result-note">
                <span className="result-win">Team {winningTeam === 1 ? "A" : "B"} won</span>
                <span className="result-loss">Team {losingTeam === 1 ? "A" : "B"} lost</span>
              </span>
            )}
          </>
        )}
      </div>

      {!readOnly && error ? (
        <div className="court-error" role="alert">
          <AlertIcon size={14} />
          <span>{error}</span>
        </div>
      ) : null}
    </article>
  );
}

export function MatchBoard({
  players,
  activeRound,
  onGenerate,
  onAddNextLineup,
  onSaveScore,
  onEditLineup,
  onAddPlayer,
  onReset,
  readOnly = false,
}: MatchBoardProps) {
  const [mode, setMode] = useState<MatchMode>("level");
  const [layout, setLayout] = useState<CourtLayout>("single");
  const tierSummary = LEVELS.map((level) => {
    const count = players.filter((player) => player.level === level.key).length;
    return {
      ...level,
      count,
      capacity: Math.floor(count / 4),
      shortage: count >= 4 ? 0 : 4 - count,
    };
  });
  const levelCapacity = tierSummary.reduce((total, tier) => total + tier.capacity, 0);
  const openCapacity = Math.floor(players.length / 4);
  const courtCapacity = mode === "open" ? openCapacity : levelCapacity;
  const maxCourts = Math.min(MAX_COURTS, Math.max(1, courtCapacity));
  const [courts, setCourts] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [addingNext, setAddingNext] = useState(false);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [boardError, setBoardError] = useState("");

  useEffect(() => {
    setCourts((current) => Math.min(Math.max(current, 1), maxCourts));
  }, [maxCourts]);

  useEffect(() => {
    if (!activeRound) return;
    setMode(activeRound.mode);
    const roundCourtCount = new Set(activeRound.matches.map((match) => match.court)).size;
    if (roundCourtCount > 1) {
      setLayout("multiple");
      setCourts(Math.min(roundCourtCount, MAX_COURTS));
    } else {
      setLayout("single");
      setCourts(1);
    }
  }, [activeRound?.roundId, activeRound?.mode]);

  const canAutoMatch = courtCapacity > 0;
  const minCourts = layout === "multiple" ? Math.min(2, maxCourts) : 1;
  const closestTier = [...tierSummary]
    .filter((tier) => tier.count > 0)
    .sort((a, b) => a.shortage - b.shortage)[0];
  const roundMatches = activeRound?.matches ?? [];
  const completed = activeRound?.completed ?? 0;
  const total = roundMatches.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  // Setup is the entry gate for the session. Once a round exists the queue
  // continues automatically, even after every court has been scored.
  const needsSetup = !activeRound;
  const setupCourts =
    layout === "single" ? Math.min(1, courtCapacity) : Math.min(courts, courtCapacity);
  const setupLineups =
    layout === "single" ? Math.min(courtCapacity, 2) : setupCourts;
  const setupPlayers = Math.max(0, setupLineups * 4);
  const setupWaiting = Math.max(0, players.length - setupPlayers);
  const setupCourtText =
    layout === "single"
      ? setupLineups > 0
        ? setupLineups >= 2
          ? "1 Court + Next Player"
          : "1 Court"
        : "No court available"
      : setupCourts > 0
        ? `${setupCourts} court${setupCourts === 1 ? "" : "s"}`
        : "No courts available";
  const startButtonLabel = generating ? "Starting…" : "Start game";

  const orderedMatches = [...roundMatches].sort(
    (a, b) =>
      a.court - b.court ||
      a.queuePosition - b.queuePosition ||
      a.createdAt.localeCompare(b.createdAt),
  );
  const scheduledMatches = orderedMatches.filter((match) => match.status === "scheduled");
  const activeByCourt = new Map<number, string>();
  for (const match of scheduledMatches) {
    if (!activeByCourt.has(match.court)) {
      activeByCourt.set(match.court, match.id);
    }
  }
  const activeMatchIds = new Set(activeByCourt.values());
  const activeCount = activeByCourt.size;
  const queuedCount = scheduledMatches.filter((match) => !activeMatchIds.has(match.id)).length;
  const roundCourtCount = new Set(roundMatches.map((match) => match.court)).size;
  const singleCourtBoard = Boolean(activeRound) && roundCourtCount === 1;
  const displayedMatches = singleCourtBoard ? scheduledMatches.slice(0, 2) : scheduledMatches;
  const hasPendingCourt = scheduledMatches.length > 0;
  const scheduledPlayerIds = new Set(
    scheduledMatches
      .flatMap((match) => [...match.team1, ...match.team2])
      .map((player) => player.playerId),
  );
  const availablePool = players.filter((player) => !scheduledPlayerIds.has(player.id));
  const finishedPriority = new Map<string, number>();
  if (!singleCourtBoard) {
    const completedMatches = roundMatches
      .filter((match) => match.status === "completed")
      .sort((a, b) => {
        const aCompleted = a.completedAt
          ? new Date(a.completedAt).getTime()
          : new Date(a.createdAt).getTime();
        const bCompleted = b.completedAt
          ? new Date(b.completedAt).getTime()
          : new Date(b.createdAt).getTime();
        return (
          aCompleted - bCompleted ||
          a.court - b.court ||
          a.queuePosition - b.queuePosition
        );
      });
    let rank = 0;
    for (const match of completedMatches) {
      for (const player of [...match.team1, ...match.team2]) {
        if (!finishedPriority.has(player.playerId)) {
          finishedPriority.set(player.playerId, rank);
          rank += 1;
        }
      }
    }
  }

  const availablePlayers = availablePool.sort((a, b) => {
    // Catch-up priority: late arrivals and players with fewer games go first.
    const aGames = Math.max(0, a.gamesPlayed || 0);
    const bGames = Math.max(0, b.gamesPlayed || 0);
    if (aGames !== bGames) return aGames - bGames;

    if (!singleCourtBoard) {
      const aRank = finishedPriority.get(a.id);
      const bRank = finishedPriority.get(b.id);
      if (aRank !== undefined || bRank !== undefined) {
        const safeARank = aRank ?? Number.MAX_SAFE_INTEGER;
        const safeBRank = bRank ?? Number.MAX_SAFE_INTEGER;
        if (safeARank !== safeBRank) return safeARank - safeBRank;
      }
    }

    const aRest = playerRestTime(a);
    const bRest = playerRestTime(b);
    if (aRest !== bRest) return aRest - bRest;
    return a.name.localeCompare(b.name);
  });
  const availableTier = LEVELS.map((level) => ({
    ...level,
    count: availablePlayers.filter((player) => player.level === level.key).length,
  }))
    .filter((tier) => tier.count >= 4)
    .sort((a, b) => b.count - a.count)[0];
  const usedCourtNumbers = new Set(roundMatches.map((match) => match.court));
  const nextCourtNumber =
    Array.from({ length: MAX_COURTS }, (_, index) => index + 1).find(
      (court) => !usedCourtNumbers.has(court),
    ) ?? null;
  const canAddNextLineup =
    Boolean(activeRound) &&
    hasPendingCourt &&
    availablePlayers.length >= 4 &&
    (activeRound?.mode === "open" || Boolean(availableTier)) &&
    (singleCourtBoard || nextCourtNumber !== null);
  const addNextNote = !activeRound
    ? ""
    : !hasPendingCourt
      ? "Save the current result, then build a new rotation."
      : singleCourtBoard
        ? availablePlayers.length < 4
          ? `${4 - availablePlayers.length} more available player${
              4 - availablePlayers.length === 1 ? "" : "s"
            } needed for the next group.`
          : activeRound.mode === "level" && !availableTier
            ? "No available rating band has four players right now."
            : `Queues another Next Player group · ${availablePlayers.length} available.`
        : nextCourtNumber === null
          ? `Maximum of ${MAX_COURTS} courts reached. The next rotation reuses the same courts.`
          : availablePlayers.length < 4
            ? `${4 - availablePlayers.length} more available player${
                4 - availablePlayers.length === 1 ? "" : "s"
              } needed for another court.`
            : activeRound.mode === "level" && !availableTier
              ? "No available rating band has four players right now."
              : `Adds ${courtName(nextCourtNumber, false)} · ${availablePlayers.length} available.`;

  function handleLayoutChange(nextLayout: CourtLayout) {
    setLayout(nextLayout);
    setCourts((current) => {
      if (nextLayout === "single") return 1;
      return Math.min(Math.max(2, Math.min(current, maxCourts)), maxCourts);
    });
  }

  async function handleGenerate() {
    setBoardError("");
    setGenerating(true);
    try {
      await onGenerate(layout, layout === "single" ? 1 : courts, mode);
    } catch (error) {
      setBoardError(error instanceof Error ? error.message : "Could not build a rotation.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddNextLineup() {
    setBoardError("");
    setAddingNext(true);
    try {
      await onAddNextLineup();
    } catch (error) {
      setBoardError(
        error instanceof Error ? error.message : "Could not add the next players.",
      );
    } finally {
      setAddingNext(false);
    }
  }

  async function handleScore(matchId: string, team1Score: number, team2Score: number) {
    setSavingMatchId(matchId);
    try {
      await onSaveScore(matchId, team1Score, team2Score);
    } finally {
      setSavingMatchId(null);
    }
  }

  return (
    <section className="panel rotation-panel" id="rotation" aria-labelledby="rotation-title">
      <div className="rotation-head">
        <div>
          <span className="eyebrow">
            {needsSetup ? (readOnly ? "Game board" : "Pre-game setup") : "Live rotation"}
          </span>
          <h2 id="rotation-title">
            {needsSetup ? (readOnly ? "Waiting for the first serve" : "Set up the game") : "Current rotation"}
          </h2>
          <p>
            {needsSetup
              ? readOnly
                ? "The admin is preparing the first rotation. Join now and your registered rate will be used when teams are built."
                : "Choose the match format, court layout, and number of courts before the first teams appear."
              : displayedMatches.length === 0
                ? "Round complete · the next rotation starts automatically"
                : singleCourtBoard
                  ? `Single court in play${
                      queuedCount
                        ? queuedCount === 1
                          ? " · Next Player ready"
                          : ` · Next Player + ${queuedCount - 1} more queued`
                        : ""
                    } · ${completed} of ${total} scored`
                  : `${activeCount} court${activeCount === 1 ? "" : "s"} in play${
                      queuedCount
                        ? ` · ${queuedCount} next lineup${queuedCount === 1 ? "" : "s"}`
                        : ""
                    } · ${completed} of ${total} scored`}
          </p>
        </div>

        <div className="rotation-controls">
          {!needsSetup ? (
            <>
              <span className="format-chip">
                {mode === "open" ? <ShuffleIcon size={13} /> : <CheckIcon size={13} />}
                {mode === "open" ? "Open Rate" : "Level match"}
              </span>
              <span className="format-chip">
                <CourtIcon size={13} />
                {singleCourtBoard
                  ? "Single court"
                  : `${roundCourtCount} court${roundCourtCount === 1 ? "" : "s"}`}
              </span>
            </>
          ) : null}
          {!readOnly ? (
            <button
              type="button"
              className="btn btn-clear btn-small rotation-reset"
              onClick={onReset}
              disabled={savingMatchId !== null || addingNext}
              title="Clear the current rotation and saved matches"
            >
              <RotateIcon size={15} />
              Reset
            </button>
          ) : null}
        </div>
      </div>

      {needsSetup && !readOnly ? (
        <>
          <div className="setup-step-label">
            <span>1</span>
            Match format
          </div>
          <div className="match-mode-row">
            <div className="mode-tabs" role="tablist" aria-label="Matchmaking mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "level"}
                className={`mode-tab ${mode === "level" ? "is-active" : ""}`}
                onClick={() => setMode("level")}
                disabled={generating}
              >
                <CheckIcon size={14} />
                Level match
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "open"}
                className={`mode-tab ${mode === "open" ? "is-active" : ""}`}
                onClick={() => setMode("open")}
                disabled={generating}
              >
                <ShuffleIcon size={14} />
                Open Rate
              </button>
            </div>
            <span className="mode-note">
              {mode === "level"
                ? "Rating bands stay separate"
                : "Any rating can share a court"}
            </span>
          </div>

          <div className="setup-step-label">
            <span>2</span>
            Court layout and count
          </div>
          <div className="match-mode-row layout-row">
            <div className="mode-tabs" role="tablist" aria-label="Court layout">
              <button
                type="button"
                role="tab"
                aria-selected={layout === "single"}
                className={`mode-tab ${layout === "single" ? "is-active" : ""}`}
                onClick={() => handleLayoutChange("single")}
                disabled={generating}
              >
                <CourtIcon size={14} />
                Single court
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={layout === "multiple"}
                className={`mode-tab ${layout === "multiple" ? "is-active" : ""}`}
                onClick={() => handleLayoutChange("multiple")}
                disabled={generating}
              >
                <ShuffleIcon size={14} />
                Multiple courts
              </button>
            </div>
            {layout === "multiple" ? (
              <div
                className="court-stepper"
                title={
                  mode === "level"
                    ? "Number of courts for the level-matched game"
                    : "Number of courts for the Open Rate game"
                }
              >
                <span className="stepper-label">Courts</span>
                <button
                  type="button"
                  className="step-btn step-btn-small"
                  onClick={() => setCourts((value) => Math.max(minCourts, value - 1))}
                  disabled={courts <= minCourts || generating}
                  aria-label="Fewer courts"
                >
                  <MinusIcon size={14} />
                </button>
                <strong>{Math.min(courts, courtCapacity)}</strong>
                <button
                  type="button"
                  className="step-btn step-btn-small"
                  onClick={() => setCourts((value) => Math.min(maxCourts, value + 1))}
                  disabled={courts >= maxCourts || generating}
                  aria-label="More courts"
                >
                  <PlusIcon size={14} />
                </button>
              </div>
            ) : (
              <span className="single-court-chip">
                <CourtIcon size={14} />
                {setupLineups >= 2 ? "1 Court + Next Player" : "1 Court"}
              </span>
            )}
          </div>
          <span className="mode-note setup-layout-note">
            {layout === "single"
              ? "Court + Next Player queue · the next group is locked until the current result is saved"
              : "Fewest games first · first finishers and longest rest break ties"}
          </span>

          <div className={`auto-level-rule ${mode === "open" ? "is-open" : ""}`}>
            <span className="auto-level-icon">
              {mode === "open" ? <ShuffleIcon size={14} /> : <CheckIcon size={14} />}
            </span>
            <p>
              {mode === "open" ? (
                <>
                  <strong>Open Rate is on.</strong> Automatic courts can mix Beginner, Low
                  Intermediate, and High Intermediate players.
                  <span>
                    {layout === "multiple"
                      ? " Multiple-court shuffle prioritizes the fewest games first, then first finishers."
                      : " Fewest games first so late arrivals can catch up."}
                  </span>
                </>
              ) : (
                <>
                  <strong>Automatic courts are level-locked.</strong> Beginner plays beginner, low
                  intermediate plays low intermediate, and high intermediate plays high intermediate.
                  <span>
                    {layout === "multiple"
                      ? " Fewest games first within each level; first finishers break ties."
                      : " Manual lineup changes are not rate-restricted."}
                  </span>
                </>
              )}
            </p>
          </div>
        </>
      ) : null}

      {!readOnly && activeRound && hasPendingCourt ? (
        <div className="queue-hint">
          <CourtIcon size={14} />
          <span>
            {singleCourtBoard ? (
              <>
                Court is the only table. Use <strong>Add next lineup</strong> to queue the{" "}
                <strong>Next Player</strong> group. Saving the current result moves the next
                group onto Court.
              </>
            ) : (
              <>
                Use <strong>Add next lineup</strong> to show another court, up to{" "}
                <strong>{MAX_COURTS} courts</strong>. The next rotation builds
                automatically after every active court has a score.
              </>
            )}
          </span>
        </div>
      ) : null}

      {!readOnly && activeRound && hasPendingCourt ? (
        <div className="queue-actions">
          <div className="queue-action-copy">
            <strong>{singleCourtBoard ? "Add next player" : "Add another court"}</strong>
            <span>{addNextNote}</span>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => void handleAddNextLineup()}
            disabled={!canAddNextLineup || addingNext}
            title={
              canAddNextLineup
                ? singleCourtBoard
                  ? "Queue the Next Player group"
                  : nextCourtNumber !== null
                    ? `Add ${courtName(nextCourtNumber, false)} with a new lineup`
                    : addNextNote
                : addNextNote
            }
          >
            {addingNext ? <span className="spinner" aria-hidden /> : <PlusIcon size={15} />}
            {addingNext ? "Adding…" : "Add next lineup"}
          </button>
        </div>
      ) : null}

      {!needsSetup && activeRound && total > 0 ? (
        <div className="round-meter">
          <div className="round-meter-copy">
            <span>Round progress</span>
            <strong>{completed}/{total}</strong>
          </div>
          <div className="round-meter-track">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {boardError ? (
        <div className="form-error board-error" role="alert">
          <AlertIcon size={17} />
          <span>{boardError}</span>
        </div>
      ) : null}

      {needsSetup && readOnly ? (
        <div className="rotation-empty read-only-empty">
          <div className="empty-court" aria-hidden>
            <span className="empty-net" />
            <span className="empty-ball" />
          </div>
          <h3>The first rotation is being prepared</h3>
          <p>
            There are {players.length} player{players.length === 1 ? "" : "s"} on the roster.
            The admin will start the first rotation when enough players are ready. Joining
            adds your registered alias and rate to the player pool.
          </p>
        </div>
      ) : needsSetup ? (
        <div className="game-setup">
          <div className="setup-summary">
            <div className="setup-summary-item">
              <span>Match format</span>
              <strong>{mode === "open" ? "Open Rate" : "Level match"}</strong>
            </div>
            <div className="setup-summary-item">
              <span>Court setup</span>
              <strong>{setupCourtText}</strong>
            </div>
            <div className="setup-summary-item">
              <span>Players</span>
              <strong>
                {setupPlayers} playing · {setupWaiting} waiting
              </strong>
            </div>
          </div>

          {!canAutoMatch ? (
            <div className="setup-warning" role="status">
              <AlertIcon size={17} />
              <span>
                {players.length < 4
                  ? `Add ${4 - players.length} more player${
                      4 - players.length === 1 ? "" : "s"
                    } to start.`
                  : mode === "level"
                    ? closestTier
                      ? `No rating band has four players yet. Add ${closestTier.shortage} more ${
                          closestTier.label
                        } player${
                          closestTier.shortage === 1 ? "" : "s"
                        }, or switch to Open Rate.`
                      : "No rating band has four players yet. Adjust a rating or switch to Open Rate."
                    : "Add at least four players to start."}
              </span>
            </div>
          ) : (
            <p className="setup-ready-note">
              <CheckIcon size={15} />
              Setup ready. The teams and courts will appear only after you start.
            </p>
          )}

          <div className="setup-actions">
            <span className="setup-note">
              Review the format and court count, then start the game. The queue continues
              automatically until you reset.
            </span>
            <div className="setup-buttons">
              <button type="button" className="btn btn-outline" onClick={onAddPlayer}>
                <PlusIcon size={17} />
                Add a player
              </button>
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={handleGenerate}
                disabled={!canAutoMatch || generating}
                title={
                  !canAutoMatch
                    ? mode === "level"
                      ? "Add four players in the same rating band, or switch to Open Rate"
                      : "Add at least four players to start"
                    : "Generate the teams and reveal the court board"
                }
              >
                {generating ? <span className="spinner" aria-hidden /> : <ShuffleIcon size={18} />}
                {startButtonLabel}
              </button>
            </div>
          </div>
        </div>
      ) : displayedMatches.length === 0 ? (
        <div className="rotation-empty">
          <div className="empty-court" aria-hidden>
            <span className="empty-net" />
            <span className="empty-ball" />
          </div>
          <h3>Preparing the next rotation</h3>
          <p>
            {readOnly
              ? "All results are saved. The next queue starts automatically as soon as a full group is available. The admin manages the roster and rotation."
              : "All results are saved. The next queue starts automatically as soon as a full group is available. If the roster cannot form another court, add a player or reset the game to change the setup."}
          </p>
          {!readOnly ? (
            <div className="rotation-empty-actions">
              <button type="button" className="btn btn-outline btn-small" onClick={onAddPlayer}>
                <PlusIcon size={15} />
                Add a player
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="court-grid">
          {displayedMatches.map((match) => (
            <CourtCard
              key={match.id}
              match={match}
              queued={!activeMatchIds.has(match.id)}
              singleCourt={singleCourtBoard}
              saving={savingMatchId === match.id}
              onSaveScore={handleScore}
              onEditLineup={onEditLineup}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      {!needsSetup && activeRound && total > 0 && availablePlayers.length > 0 ? (
        <div className="waiting-strip">
          <div className="waiting-label">
            <ClockIcon size={14} />
            <span>Available next</span>
            <strong>{availablePlayers.length}</strong>
          </div>
          <div className="waiting-players">
            {availablePlayers.slice(0, 8).map((player) => (
              <span className="waiting-player" key={player.id}>
                <Avatar name={player.name} size="xs" />
                {player.name}
                <small>{player.gamesPlayed} played</small>
              </span>
            ))}
            {availablePlayers.length > 8 ? (
              <span className="waiting-more">+{availablePlayers.length - 8} more</span>
            ) : null}
          </div>
          <span className="waiting-note">
            {hasPendingCourt
              ? singleCourtBoard
                ? `Fewest games first for the next group${
                    activeRound?.mode === "open"
                      ? " across all levels."
                      : " within their level."
                  }`
                : "Fewest games first for the next rotation; first finishers break ties."
              : "Available for the next rotation."}
          </span>
        </div>
      ) : null}

      {!needsSetup && activeRound && total > 0 ? (
        <div className="rotation-foot">
          <span>
            <CheckIcon size={14} /> No player on two active courts
          </span>
          <span>
            {activeRound.mode === "open" ? (
              <>
                <ShuffleIcon size={14} /> Open Rate mixes rating bands
              </>
            ) : (
              <>
                <CheckIcon size={14} /> Auto courts stay in one level
              </>
            )}
          </span>
          <span>
            <CourtIcon size={14} />{" "}
            {singleCourtBoard ? "Court + Next Player queue" : `Up to ${MAX_COURTS} courts per round`}
          </span>
        </div>
      ) : null}
    </section>
  );
}
