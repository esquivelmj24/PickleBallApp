"use client";

import { useMemo, useState } from "react";
import { ALL_LEVELS, getLevel, type LevelKey } from "@/lib/levels";
import type { Player } from "@/lib/types";
import { Avatar } from "./Avatar";
import {
  ChevronDownIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  TrashIcon,
} from "./icons";

type Filter = "all" | LevelKey;
type Sort = "played" | "name" | "rating" | "wins";

type PlayerRosterProps = {
  players: Player[];
  topPlayerIds: string[];
  onAdd: () => void;
  canAddPlayer: boolean;
  onEdit: (player: Player) => void;
  onDelete: (player: Player) => void;
  onClearAll: () => void;
  canClearAll: boolean;
  onLoadSample: () => Promise<void>;
  sampleLoading: boolean;
  readOnly?: boolean;
  viewerPlayerId?: string;
};

const SORT_LABELS: Record<Sort, string> = {
  played: "Most played",
  name: "Name A–Z",
  rating: "Highest rating",
  wins: "Most wins",
};

export function PlayerRoster({
  players,
  topPlayerIds,
  onAdd,
  canAddPlayer,
  onEdit,
  onDelete,
  onClearAll,
  canClearAll,
  onLoadSample,
  sampleLoading,
  readOnly = false,
  viewerPlayerId,
}: PlayerRosterProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("played");

  const maxPlayed = Math.max(1, ...players.map((player) => player.gamesPlayed));

  const filteredPlayers = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return players
      .filter((player) => {
        const matchesSearch = !searchTerm || player.name.toLowerCase().includes(searchTerm);
        const matchesLevel = filter === "all" || player.level === filter;
        return matchesSearch && matchesLevel;
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "rating") {
          if (a.isNR !== b.isNR) return a.isNR ? 1 : -1;
          return b.rating - a.rating || a.name.localeCompare(b.name);
        }
        if (sort === "wins") return b.wins - a.wins || b.pointDiff - a.pointDiff;
        return b.gamesPlayed - a.gamesPlayed || a.name.localeCompare(b.name);
      });
  }, [filter, players, search, sort]);

  return (
    <section className="panel roster-panel" id="players" aria-labelledby="roster-title">
      <div className="roster-head">
        <div>
          <span className="eyebrow">{readOnly ? "Game roster" : "Committee roster"}</span>
          <h2 id="roster-title">Players &amp; ratings</h2>
          <p>
            {readOnly
              ? "See who is on the board, their registered rates, and how many games they have played."
              : "Track rates and keep an eye on who has played the most."}
          </p>
        </div>
        <div className="roster-head-actions">
          {readOnly ? (
            <span className="view-only-chip">
              <LockIcon size={13} />
              View only
            </span>
          ) : (
            <>
              {canClearAll ? (
                <button type="button" className="btn btn-clear" onClick={onClearAll}>
                  <TrashIcon size={16} />
                  Clear all
                </button>
              ) : null}
              {canAddPlayer ? (
                <button type="button" className="btn btn-outline" onClick={onAdd}>
                  <PlusIcon size={17} />
                  Add player
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {players.length === 0 ? (
        <div className="roster-empty">
          <div className="roster-empty-art" aria-hidden>
            <span className="sheet-line sheet-line-1" />
            <span className="sheet-line sheet-line-2" />
            <span className="sheet-line sheet-line-3" />
            <span className="sheet-ball" />
          </div>
          <div>
            <h3>{readOnly ? "No players on the board yet" : "Build your roster"}</h3>
            <p>
              {readOnly
                ? "The admin will add players to the board, or players can join from the game page."
                : "Enter each player's name and the rate set by the committee. Ratings keep the courts competitive."}
            </p>
            {!readOnly ? (
              <div className="roster-empty-actions">
                <button type="button" className="btn btn-ghost" onClick={onLoadSample} disabled={sampleLoading}>
                  {sampleLoading ? <span className="spinner" aria-hidden /> : <SparklesIcon size={16} />}
                  {sampleLoading ? "Loading…" : "Load sample roster"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="roster-toolbar">
            <div className="search-box">
              <SearchIcon size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search players"
                aria-label="Search players"
              />
            </div>

            <div className="filter-chips" role="group" aria-label="Filter by level">
              <button
                type="button"
                className={`filter-chip ${filter === "all" ? "is-active" : ""}`}
                onClick={() => setFilter("all")}
              >
                All
                <span>{players.length}</span>
              </button>
              {ALL_LEVELS.map((level) => {
                const count = players.filter((player) => player.level === level.key).length;
                return (
                  <button
                    type="button"
                    key={level.key}
                    className={`filter-chip ${filter === level.key ? "is-active" : ""}`}
                    onClick={() => setFilter(level.key)}
                  >
                    <span className="level-dot" style={{ background: level.color }} />
                    {level.label}
                    <span>{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="sort-select">
              <label htmlFor="roster-sort">Sort</label>
              <div className="select-wrap">
                <select
                  id="roster-sort"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as Sort)}
                >
                  {Object.entries(SORT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon size={15} className="select-chevron" />
              </div>
            </div>
          </div>

          <div className="roster-table-wrap">
            <table className="roster-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Committee rate</th>
                  <th>Played</th>
                  <th>Record</th>
                  {!readOnly ? <th><span className="sr-only">Actions</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player) => {
                  const level = getLevel(player.rating, player.isNR);
                  const rateLabel = player.isNR ? "NR" : player.rating.toFixed(1);
                  const rank = topPlayerIds.indexOf(player.id);
                  const isViewer = player.id === viewerPlayerId;
                  return (
                    <tr key={player.id} className={isViewer ? "is-viewer" : undefined}>
                      <td>
                        <div className="player-cell">
                          <div className="player-avatar-wrap">
                            <Avatar name={player.name} size="md" />
                            {rank >= 0 ? <span className="rank-star">{rank + 1}</span> : null}
                          </div>
                          <div className="player-name-cell">
                            <strong>
                              {player.name}
                              {isViewer ? <span className="you-badge">You</span> : null}
                            </strong>
                            <span>
                              {player.gamesPlayed === 0
                                ? "Yet to play"
                                : `${player.winRate}% win rate`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="rate-cell">
                          <button
                              type="button"
                              className={`rate-edit-btn ${player.isNR ? "is-nr" : ""}`}
                              onClick={() => !readOnly && onEdit(player)}
                              aria-label={`Edit ${player.name}'s rate`}
                              title={readOnly ? "View rating" : "Edit this player's rate"}
                            >
                              {rateLabel}
                            </button>
                          <span className="level-pill" style={{ background: level.soft, color: level.color }}>
                            <span className="level-dot" style={{ background: level.color }} />
                            {level.label}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="played-cell">
                          <div className="played-copy">
                            <strong>{player.gamesPlayed}</strong>
                            <span>{player.gamesPlayed === 1 ? "game" : "games"}</span>
                          </div>
                          <div className="played-bar" aria-hidden>
                            <span
                              style={{ width: `${(player.gamesPlayed / maxPlayed) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="record-cell">
                          <span className="record-wins">{player.wins}W</span>
                          <span className="record-losses">{player.losses}L</span>
                        </div>
                      </td>
                      {!readOnly ? (
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => onEdit(player)}
                              aria-label={`Edit ${player.name}`}
                              title="Edit player"
                            >
                              <PencilIcon size={16} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn-danger"
                              onClick={() => onDelete(player)}
                              aria-label={`Remove ${player.name}`}
                              title="Remove player"
                            >
                              <TrashIcon size={16} />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredPlayers.length === 0 ? (
              <div className="table-empty">
                <SearchIcon size={22} />
                <p>No players match that search.</p>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>

          <div className="roster-foot">
            <span>
              Showing {filteredPlayers.length} of {players.length} players
            </span>
            <span className="roster-foot-note">
              {readOnly
                ? "View-only roster. The admin updates players and scores."
                : "Played counts update only when a score is saved."}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
