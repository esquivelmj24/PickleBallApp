"use client";

import { useState } from "react";
import { formatRosterDate, formatRosterTime } from "@/lib/roster-config";
import type { Roster } from "@/lib/types";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  PlusIcon,
  UsersIcon,
} from "./icons";

type RosterPanelProps = {
  rosters: Roster[];
  isAdmin: boolean;
  onCreate: () => void;
  onJoin: (roster: Roster) => Promise<void>;
  joiningId: string | null;
};

export function RosterPanel({
  rosters,
  isAdmin,
  onCreate,
  onJoin,
  joiningId,
}: RosterPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRoster = rosters.find((roster) => roster.id === selectedId) ?? null;

  return (
    <section
      className={`panel game-rosters-panel ${isAdmin ? "is-admin" : ""}`}
      id="rosters"
      aria-labelledby="game-rosters-title"
    >
      <div className="panel-head game-rosters-head">
        <div className="game-rosters-heading">
          <div className="section-mark">
            <CalendarIcon size={18} />
          </div>
          <div>
            <span className="eyebrow">{isAdmin ? "Game schedule" : "Join a scheduled game"}</span>
            <h2 id="game-rosters-title">Game rosters</h2>
            <p className="game-rosters-lede">
              {isAdmin
                ? "Create scheduled games and watch the joined/capacity ratio update as players reserve spots."
                : "Pick a roster to review its details and joined players, then use the Join button inside it when you are ready. Your registered rate is added to the host's board automatically."}
            </p>
          </div>
        </div>

        {isAdmin ? (
          <button type="button" className="btn btn-primary btn-small" onClick={onCreate}>
            <PlusIcon size={16} />
            Create roster
          </button>
        ) : (
          <span className="panel-count">
            {rosters.length} scheduled
          </span>
        )}
      </div>

      {rosters.length === 0 ? (
        <div className="game-roster-empty">
          <span className="game-roster-empty-icon">
            <CalendarIcon size={24} />
          </span>
          <div>
            <strong>No rosters scheduled yet</strong>
            <p>
              {isAdmin
                ? "Create the first roster with a date, time, and player capacity."
                : "An admin has not scheduled a game yet. Check back soon."}
            </p>
          </div>
          {isAdmin ? (
            <button type="button" className="btn btn-outline btn-small" onClick={onCreate}>
              <PlusIcon size={15} />
              New roster
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="game-roster-grid">
            {rosters.map((roster) => {
              const selected = selectedRoster?.id === roster.id;
              const progress = Math.min(
                100,
                Math.round((roster.joinedCount / roster.capacity) * 100),
              );
              const orderedMembers = [...roster.members].sort(
                (a, b) =>
                  Number(b.isViewer) - Number(a.isViewer) ||
                  b.joinedAt.localeCompare(a.joinedAt) ||
                  a.name.localeCompare(b.name),
              );
              const visibleMembers = orderedMembers.slice(0, 5);
              const hiddenMemberCount = orderedMembers.length - visibleMembers.length;
              const cardClasses = [
                "game-roster-card",
                selected ? "is-selected" : "",
                roster.joined ? "is-joined" : "",
                roster.full ? "is-full" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <article key={roster.id} className={cardClasses}>
                  <button
                    type="button"
                    className="game-roster-hit"
                    disabled={isAdmin}
                    aria-pressed={isAdmin ? undefined : selected}
                    onClick={() => {
                      if (!isAdmin) setSelectedId(roster.id);
                    }}
                  >
                    <span className="game-roster-topline">
                      <span className="game-roster-name">{roster.name}</span>
                      <span className="game-roster-ratio" aria-label={`${roster.joinedCount} of ${roster.capacity} players joined`}>
                        <strong>{roster.joinedCount}</strong>
                        <span>/</span>
                        {roster.capacity}
                      </span>
                    </span>

                    <span className="game-roster-meta">
                      <span>
                        <CalendarIcon size={14} />
                        {formatRosterDate(roster.date)}
                      </span>
                      <span>
                        <ClockIcon size={14} />
                        {formatRosterTime(roster.time)}
                      </span>
                      {!isAdmin ? (
                        <span className="game-roster-host">
                          <UsersIcon size={14} />
                          Host: {roster.ownerAlias}
                        </span>
                      ) : null}
                    </span>

                    <span className="game-roster-progress-track" aria-hidden>
                      <span style={{ width: `${progress}%` }} />
                    </span>

                    {!selected ? (
                      <span className="game-roster-people">
                        {orderedMembers.length > 0 ? (
                          <>
                            {visibleMembers.map((member) => (
                              <span
                                key={member.playerId}
                                className={`game-roster-person ${member.isViewer ? "is-viewer" : ""}`}
                                title={`${member.name} · ${member.rating.toFixed(1)}`}
                              >
                                {member.name}
                                {member.isViewer ? (
                                  <span className="game-roster-person-you">you</span>
                                ) : null}
                              </span>
                            ))}
                            {hiddenMemberCount > 0 ? (
                              <span
                                className="game-roster-person is-more"
                                title={orderedMembers
                                  .slice(visibleMembers.length)
                                  .map((member) => member.name)
                                  .join(", ")}
                              >
                                +{hiddenMemberCount} more
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="game-roster-people-empty">No players joined yet</span>
                        )}
                      </span>
                    ) : null}

                    <span className="game-roster-footer">
                      <span className="game-roster-slots">
                        {roster.full
                          ? "Roster full"
                          : `${roster.remaining} slot${roster.remaining === 1 ? "" : "s"} left`}
                      </span>
                      {roster.joined ? (
                        <span className="game-roster-status is-joined">
                          <CheckIcon size={13} />
                          Joined
                        </span>
                      ) : roster.full ? (
                        <span className="game-roster-status is-full">Full</span>
                      ) : !isAdmin ? (
                        <span className="game-roster-status">
                          {selected ? "Selected" : "Select roster"}
                        </span>
                      ) : null}
                    </span>
                  </button>

                  {!isAdmin && selected ? (
                    <div className="game-roster-join">
                      <div className="game-roster-joined-list">
                        <div className="game-roster-joined-head">
                          <span>Players who joined</span>
                          <span>
                            {roster.joinedCount} of {roster.capacity} players
                          </span>
                        </div>
                        {orderedMembers.length > 0 ? (
                          <div className="game-roster-joined-chips">
                            {orderedMembers.map((member) => (
                              <span
                                key={member.playerId}
                                className={`game-roster-joined-chip ${member.isViewer ? "is-viewer" : ""}`}
                              >
                                {member.name}
                                {member.isViewer ? (
                                  <span className="game-roster-person-you">you</span>
                                ) : null}
                                <small>{member.rating.toFixed(1)}</small>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="game-roster-joined-empty">
                            No players joined yet. Be the first to reserve a spot.
                          </span>
                        )}
                      </div>

                      <div className="game-roster-join-main">
                        <div className="game-roster-join-copy">
                          <strong>
                            {roster.joined
                              ? "Your spot is reserved"
                              : roster.full
                                ? "This roster is full"
                                : "Ready to join this roster?"}
                          </strong>
                          <span>
                            {roster.joined
                              ? `${roster.joinedCount}/${roster.capacity} players joined · ${roster.remaining} slots remain`
                              : roster.full
                                ? "Choose another scheduled roster to join."
                                : `${roster.remaining} of ${roster.capacity} slots remain for this game.`}
                          </span>
                        </div>
                        <button
                          type="button"
                          className={`btn ${roster.joined || roster.full ? "btn-outline" : "btn-primary"} btn-small`}
                          onClick={() => void onJoin(roster)}
                          disabled={roster.joined || roster.full || joiningId === roster.id}
                        >
                          {joiningId === roster.id ? (
                            <span className="spinner spinner-light" />
                          ) : roster.joined ? (
                            <CheckIcon size={15} />
                          ) : (
                            <PlusIcon size={15} />
                          )}
                          {joiningId === roster.id
                            ? "Joining…"
                            : roster.joined
                              ? "Joined"
                              : roster.full
                                ? "Roster full"
                                : "Join this roster"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          {!isAdmin ? (
            <p className="game-rosters-footnote">
              Select a roster to review its date, time, joined players, and open slots before
              deciding whether to join. Ratios refresh automatically.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
