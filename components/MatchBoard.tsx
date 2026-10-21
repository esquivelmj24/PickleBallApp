"use client";

import { useEffect, useState } from "react";
import { averageRating } from "@/lib/format";
import { getLevel, LEVELS } from "@/lib/levels";
import type { AppState, Match, MatchMode, Player } from "@/lib/types";
import { Avatar } from "./Avatar";
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  CourtIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  ShuffleIcon,
  TrophyIcon,
} from "./icons";

type MatchBoardProps = {
  players: Player[];
  activeRound: AppState["activeRound"];
  onGenerate: (courts: number, mode: MatchMode) => Promise<void>;
  onSaveScore: (matchId: string, team1Score: number, team2Score: number) => Promise<void>;
  onEditLineup: (match: Match) => void;
  onAddPlayer: () => void;
};

type CourtCardProps = {
  match: Match;
  queued: boolean;
  saving: boolean;
  onSaveScore: (matchId: string, team1Score: number, team2Score: number) => Promise<void>;
  onEditLineup: (match: Match) => void;
};

function CourtCard({ match, queued, saving, onSaveScore, onEditLineup }: CourtCardProps) {
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
  const courtNumber = String(match.court).padStart(2, "0");

  return (
    <article className={`court-card ${completed ? "is-completed" : ""} ${queued ? "is-queued" : ""}`}>
      <div className="court-card-top">
        <div className="court-label">
          <CourtIcon size={16} />
          <span>{queued ? "Next lineup" : `Court ${courtNumber}`}</span>
          {queued ? <span className="queue-court-tag">Court {courtNumber}</span> : null}
        </div>
        <div className="court-top-tags">
          <span
            className={`court-band ${isOpenRate ? "is-open" : ""} ${mixedLevels ? "is-mixed" : ""}`}
            style={{ color: levelColor, background: levelSoft }}
            title={
              isOpenRate
                ? "Open rate court — rating bands are intentionally mixed"
                : mixedLevels
                  ? "Mixed rating bands from a committee lineup override"
                  : "Automatic level-matched court"
            }
          >
            <span className="level-dot" style={{ background: levelColor }} />
            {isOpenRate ? "Open rate" : mixedLevels ? "Mixed levels" : courtLevel.label}
          </span>
          <span className={`match-status ${completed ? "is-final" : ""} ${queued ? "is-queued" : ""}`}>
            {queued ? (
              <>
                <ClockIcon size={13} /> Queued
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
              Up next on Court {courtNumber}
            </span>
            <button
              type="button"
              className="lineup-btn"
              onClick={() => onEditLineup(match)}
              title="Committee override — change players"
            >
              <PencilIcon size={14} />
              Change lineup
            </button>
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
                aria-label={`Court ${match.court} team A score`}
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
                aria-label={`Court ${match.court} team B score`}
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

      {error ? (
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
  onSaveScore,
  onEditLineup,
  onAddPlayer,
}: MatchBoardProps) {
  const [mode, setMode] = useState<MatchMode>("level");
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
  const maxCourts = Math.max(1, courtCapacity);
  const [courts, setCourts] = useState(() => Math.max(1, courtCapacity));
  const [generating, setGenerating] = useState(false);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [boardError, setBoardError] = useState("");

  useEffect(() => {
    setCourts((current) => Math.min(Math.max(current, 1), maxCourts));
  }, [maxCourts]);

  useEffect(() => {
    if (activeRound) setMode(activeRound.mode);
  }, [activeRound?.roundId, activeRound?.mode]);

  const hasPlayers = players.length >= 4;
  const canAutoMatch = courtCapacity > 0;
  const closestTier = [...tierSummary]
    .filter((tier) => tier.count > 0)
    .sort((a, b) => a.shortage - b.shortage)[0];
  const roundMatches = activeRound?.matches ?? [];
  const completed = activeRound?.completed ?? 0;
  const total = roundMatches.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  const orderedMatches = [...roundMatches].sort(
    (a, b) =>
      a.court - b.court ||
      a.queuePosition - b.queuePosition ||
      a.createdAt.localeCompare(b.createdAt),
  );
  const activeByCourt = new Map<number, string>();
  for (const match of orderedMatches) {
    if (match.status === "scheduled" && !activeByCourt.has(match.court)) {
      activeByCourt.set(match.court, match.id);
    }
  }
  const activeMatchIds = new Set(activeByCourt.values());
  const activeCount = activeByCourt.size;
  const queuedCount = orderedMatches.filter(
    (match) => match.status === "scheduled" && !activeMatchIds.has(match.id),
  ).length;
  const singleCourtBoard =
    Boolean(activeRound) && new Set(orderedMatches.map((match) => match.court)).size === 1;
  const queuesOnOneCourt = courts === 1 && courtCapacity > 1;

  const onCourtIds = new Set(
    roundMatches.flatMap((match) => [...match.team1, ...match.team2]).map((player) => player.playerId),
  );
  const waitingPlayers = players
    .filter((player) => !onCourtIds.has(player.id))
    .sort((a, b) => a.gamesPlayed - b.gamesPlayed || a.name.localeCompare(b.name));

  async function handleGenerate() {
    setBoardError("");
    setGenerating(true);
    try {
      await onGenerate(courts, mode);
    } catch (error) {
      setBoardError(error instanceof Error ? error.message : "Could not build a rotation.");
    } finally {
      setGenerating(false);
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
          <span className="eyebrow">Match night</span>
          <h2 id="rotation-title">Tonight&apos;s rotation</h2>
          <p>
            {activeRound
              ? completed === total
                ? "Every lineup is in the books. Build the next fair rotation."
                : `${activeCount} court${activeCount === 1 ? "" : "s"} in play${
                    queuedCount
                      ? ` · ${queuedCount} next lineup${queuedCount === 1 ? "" : "s"}`
                      : ""
                  } · ${completed} of ${total} scored`
              : mode === "level"
                ? "Level-matched auto courts, with the fewest-played players first."
                : "Open rate courts — any rating can share a court, fewest-played first."}
          </p>
        </div>

        <div className="rotation-controls">
          <div
            className="court-stepper"
            title={
              mode === "level"
                ? "Number of physical courts to fill with level-matched lineups"
                : "Number of physical courts to fill with open-rate lineups"
            }
          >
            <span className="stepper-label">Courts</span>
            <button
              type="button"
              className="step-btn step-btn-small"
              onClick={() => setCourts((value) => Math.max(1, value - 1))}
              disabled={courts <= 1 || generating}
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
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={!canAutoMatch || generating}
            title={
              canAutoMatch
                ? mode === "level"
                  ? "Build level-matched courts"
                  : "Build Open rate courts across all levels"
                : mode === "level"
                  ? "Add four players in the same rating band, or switch to Open rate"
                  : "Add at least four players to build an Open rate court"
            }
          >
            {generating ? <span className="spinner" aria-hidden /> : <ShuffleIcon size={18} />}
            {generating ? "Building…" : activeRound ? "Shuffle new round" : "Build rotation"}
          </button>
        </div>
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
            Open rate
          </button>
        </div>
        <span className="mode-note">
          {mode === "level"
            ? "Rating bands stay separate"
            : "Any rating can share a court"}
          {activeRound ? " · applies to the next shuffle" : ""}
        </span>
      </div>

      <div className={`auto-level-rule ${mode === "open" ? "is-open" : ""}`}>
        <span className="auto-level-icon">
          {mode === "open" ? <ShuffleIcon size={14} /> : <CheckIcon size={14} />}
        </span>
        <p>
          {mode === "open" ? (
            <>
              <strong>Open rate is on.</strong> Automatic courts can mix Beginner, Low
              Intermediate, and High Intermediate players.
              <span> Fair play counts still decide who gets the next game.</span>
            </>
          ) : (
            <>
              <strong>Automatic courts are level-locked.</strong> Beginner plays beginner, low
              intermediate plays low intermediate, and high intermediate plays high intermediate.
              <span> Manual lineup changes are not rate-restricted.</span>
            </>
          )}
        </p>
      </div>

      {queuesOnOneCourt ? (
        <div className="queue-hint">
          <ClockIcon size={14} />
          <span>
            One physical court selected — extra lineups are queued as{" "}
            <strong>Next lineup</strong> cards on Court 01.
          </span>
        </div>
      ) : null}

      {activeRound && total > 0 ? (
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

      {!hasPlayers ? (
        <div className="rotation-empty">
          <div className="empty-court" aria-hidden>
            <span className="empty-net" />
            <span className="empty-ball" />
          </div>
          <h3>{players.length === 0 ? "The court is open" : "A full court is needed"}</h3>
          <p>
            {players.length === 0
              ? "Add players and their committee rating to start building balanced courts."
              : `You have ${players.length} player${players.length === 1 ? "" : "s"}. Add ${4 - players.length} more to fill a court.`}
          </p>
          <button type="button" className="btn btn-dark" onClick={onAddPlayer}>
            <PlusIcon size={17} />
            Add a player
          </button>
        </div>
      ) : !activeRound && !canAutoMatch ? (
        <div className="rotation-empty needs-level">
          <div className="empty-court" aria-hidden>
            <span className="empty-net" />
            <span className="empty-ball" />
          </div>
          <h3>No full rating band yet</h3>
          <p>
            You have {players.length} players, but Level match needs four players in the same
            rating band.
            {closestTier
              ? ` Add ${closestTier.shortage} more ${closestTier.label} player${
                  closestTier.shortage === 1 ? "" : "s"
                } to unlock a level-matched court, or switch to Open rate.`
              : " Adjust a rating so four players share a level, or switch to Open rate."}
          </p>
          <div className="rotation-empty-actions">
            <button type="button" className="btn btn-primary" onClick={() => setMode("open")}>
              <ShuffleIcon size={17} />
              Use Open rate
            </button>
            <button type="button" className="btn btn-outline" onClick={onAddPlayer}>
              <PlusIcon size={17} />
              Add a player
            </button>
          </div>
        </div>
      ) : !activeRound || total === 0 ? (
        <div className="rotation-empty has-players">
          <div className="empty-court" aria-hidden>
            <span className="empty-net" />
            <span className="empty-ball" />
          </div>
          <h3>{mode === "open" ? "Open rate courts, ready to build" : "Level-matched courts, ready to build"}</h3>
          <p>
            {players.length} players rated.{" "}
            {mode === "open"
              ? "Open rate can mix all rating bands, prioritizes anyone who hasn't played, and never repeats a name."
              : "Each automatic court stays inside one rating band, prioritizes anyone who hasn't played, and never repeats a name."}
          </p>
          <button
            type="button"
            className="btn btn-dark"
            onClick={handleGenerate}
            disabled={generating || !canAutoMatch}
          >
            {generating ? <span className="spinner spinner-light" aria-hidden /> : <ShuffleIcon size={17} />}
            {generating ? "Building rotation…" : "Build the first rotation"}
          </button>
        </div>
      ) : (
        <div className={`court-grid ${singleCourtBoard && orderedMatches.length > 1 ? "is-queue" : ""}`}>
          {orderedMatches.map((match) => (
            <CourtCard
              key={match.id}
              match={match}
              queued={match.status === "scheduled" && !activeMatchIds.has(match.id)}
              saving={savingMatchId === match.id}
              onSaveScore={handleScore}
              onEditLineup={onEditLineup}
            />
          ))}
        </div>
      )}

      {activeRound && total > 0 && waitingPlayers.length > 0 ? (
        <div className="waiting-strip">
          <div className="waiting-label">
            <ClockIcon size={14} />
            <span>Waiting list</span>
            <strong>{waitingPlayers.length}</strong>
          </div>
          <div className="waiting-players">
            {waitingPlayers.slice(0, 8).map((player) => (
              <span className="waiting-player" key={player.id}>
                <Avatar name={player.name} size="xs" />
                {player.name}
                <small>{player.gamesPlayed} played</small>
              </span>
            ))}
            {waitingPlayers.length > 8 ? (
              <span className="waiting-more">+{waitingPlayers.length - 8} more</span>
            ) : null}
          </div>
          <span className="waiting-note">
            Next rotation gives them priority
            {activeRound?.mode === "open" ? " across all levels." : " within their level."}
          </span>
        </div>
      ) : null}

      {activeRound && total > 0 ? (
        <div className="rotation-foot">
          <span>
            <CheckIcon size={14} /> No duplicate players within a round
          </span>
          <span>
            {activeRound.mode === "open" ? (
              <>
                <ShuffleIcon size={14} /> Open rate mixes rating bands
              </>
            ) : (
              <>
                <CheckIcon size={14} /> Auto courts stay in one level
              </>
            )}
          </span>
          {queuedCount > 0 ? (
            <span>
              <ClockIcon size={14} /> Next lineups queue on Court 01
            </span>
          ) : (
            <span>
              <CheckIcon size={14} /> Fewest-played first
            </span>
          )}
        </div>
      ) : null}
    </section>
  );
}
