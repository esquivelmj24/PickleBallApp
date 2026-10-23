"use client";

import Link from "next/link";
import { formatRosterDate, formatRosterTimeRange } from "@/lib/roster-config";
import type { Roster } from "@/lib/types";
import {
  ArrowUpRightIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  MapPinIcon,
  PlusIcon,
  UsersIcon,
} from "./icons";

type RosterPanelProps = {
  rosters: Roster[];
  isAdmin: boolean;
  onCreate: () => void;
};

export function RosterPanel({ rosters, isAdmin, onCreate }: RosterPanelProps) {
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
            <span className="eyebrow">{isAdmin ? "Game schedule" : "Scheduled games"}</span>
            <h2 id="game-rosters-title">Game rosters</h2>
            <p className="game-rosters-lede">
              {isAdmin
                ? "Create scheduled games with a location, then open a roster to manage its players, match setup, and rotation."
                : "Open a roster to review its location, date, time, and joined players on a dedicated page before deciding whether to join."}
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
                ? "Create the first roster with a location, date, time, and player capacity."
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
                roster.joined ? "is-joined" : "",
                roster.full ? "is-full" : "",
                roster.ended ? "is-ended" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <Link
                  key={roster.id}
                  href={`/rosters/${roster.id}`}
                  className={cardClasses}
                  aria-label={`Open details for ${roster.name}${
                    roster.ended ? " (ended)" : ""
                  }`}
                >
                  <span className="game-roster-hit">
                    <span className="game-roster-topline">
                      <span className="game-roster-name">{roster.name}</span>
                      <span
                        className="game-roster-ratio"
                        aria-label={`${roster.joinedCount} of ${roster.capacity} players joined`}
                      >
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
                      {roster.location ? (
                        <span className="game-roster-location">
                          <MapPinIcon size={14} />
                          {roster.location}
                        </span>
                      ) : null}
                      <span>
                        <ClockIcon size={14} />
                        {formatRosterTimeRange(roster.startTime, roster.endTime)}
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

                    <span className="game-roster-people">
                      {orderedMembers.length > 0 ? (
                        <>
                          {visibleMembers.map((member) => (
                            <span
                              key={member.playerId}
                              className={`game-roster-person ${member.isViewer ? "is-viewer" : ""}`}
                              title={`${member.name} · ${
                                member.isNR ? "NR" : member.rating.toFixed(1)
                              }`}
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

                    <span className="game-roster-footer">
                      <span className="game-roster-slots">
                        {roster.ended
                          ? "Transaction ended"
                          : roster.full
                            ? "Roster full"
                            : `${roster.remaining} slot${roster.remaining === 1 ? "" : "s"} left`}
                      </span>
                      <span
                        className={`game-roster-status ${
                          roster.ended
                            ? "is-ended"
                            : roster.joined
                              ? "is-joined"
                              : roster.full
                                ? "is-full"
                                : ""
                        }`}
                      >
                        {roster.ended ? (
                          <LockIcon size={13} />
                        ) : roster.joined ? (
                          <CheckIcon size={13} />
                        ) : (
                          <ArrowUpRightIcon size={13} />
                        )}
                        {roster.ended
                          ? "Ended · View"
                          : roster.joined
                            ? "Joined · View"
                            : roster.full
                              ? "View roster"
                              : isAdmin
                                ? "Manage roster"
                                : "View roster"}
                      </span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>

          <p className="game-rosters-footnote">
            {isAdmin
              ? "Open a roster to access the game board and Players & ratings. Use End Transaction to close sign-ups and remove the roster from the list."
              : "Open any roster to review its details and joined players. Joining is available on the roster details page."}
          </p>
        </>
      )}
    </section>
  );
}
