"use client";

import Link from "next/link";
import { getLevel } from "@/lib/levels";
import { formatRosterDate, formatRosterTimeRange } from "@/lib/roster-config";
import type { Roster } from "@/lib/types";
import { Avatar } from "./Avatar";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  UsersIcon,
} from "./icons";

type RosterDetailProps = {
  roster: Roster;
  isAdmin: boolean;
  joiningId: string | null;
  onJoin: (roster: Roster) => Promise<void>;
  onEditRoster: () => void;
  onEndRoster: () => void;
};

export function RosterDetail({
  roster,
  isAdmin,
  joiningId,
  onJoin,
  onEditRoster,
  onEndRoster,
}: RosterDetailProps) {
  const members = [...roster.members].sort(
    (a, b) =>
      Number(b.isViewer) - Number(a.isViewer) ||
      b.joinedAt.localeCompare(a.joinedAt) ||
      a.name.localeCompare(b.name),
  );
  const progress = Math.min(
    100,
    Math.round((roster.joinedCount / roster.capacity) * 100),
  );

  return (
    <section
      className="panel roster-detail-panel"
      id="roster-details"
      aria-labelledby="roster-detail-title"
    >
      <div className="roster-detail-topbar">
        <Link href="/#rosters" className="btn btn-outline btn-small roster-back-btn">
          <ArrowLeftIcon size={15} />
          Back to rosters
        </Link>
        <div className="roster-detail-badges">
          {roster.joined ? (
            <span className="game-roster-status is-joined">
              <CheckIcon size={13} />
              You joined
            </span>
          ) : null}
          {roster.ended ? (
            <span className="game-roster-status is-ended">
              <LockIcon size={13} />
              Roster ended
            </span>
          ) : (
            <span className={`game-roster-status ${roster.full ? "is-full" : ""}`}>
              {roster.full
                ? "Roster full"
                : `${roster.remaining} slot${roster.remaining === 1 ? "" : "s"} left`}
            </span>
          )}
        </div>
      </div>

      <div className="roster-detail-heading">
        <div className="roster-detail-heading-copy">
          <span className="eyebrow">{isAdmin ? "Roster management" : "Game roster"}</span>
          <h1 id="roster-detail-title">{roster.name}</h1>
          <p>
            {isAdmin
              ? roster.ended
                ? "This transaction has ended and has been removed from the roster list."
                : "Review the joined players, then use the game board below to prepare the rotation."
              : roster.ended
                ? "This roster has ended and is no longer accepting players."
                : roster.joined
                  ? "Your spot is reserved. Review the players and follow the live rotation below."
                  : "Review the location, date, time, and joined players before deciding whether to join."}
          </p>
        </div>
        <div
          className="roster-detail-ratio"
          aria-label={`${roster.joinedCount} of ${roster.capacity} players joined`}
        >
          <span>
            <strong>{roster.joinedCount}</strong>/{roster.capacity}
          </span>
          <small>players joined</small>
        </div>
      </div>

      <div className="roster-detail-meta">
        <span>
          <CalendarIcon size={15} />
          {formatRosterDate(roster.date)}
        </span>
        {roster.location ? (
          <span className="roster-detail-location">
            <MapPinIcon size={15} />
            {roster.location}
          </span>
        ) : null}
        <span>
          <ClockIcon size={15} />
          {formatRosterTimeRange(roster.startTime, roster.endTime)}
        </span>
        <span>
          <UsersIcon size={15} />
          {roster.joinedCount} of {roster.capacity} players
        </span>
        <span>Host: {roster.ownerAlias}</span>
      </div>

      <div className="roster-detail-progress" aria-hidden>
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="roster-detail-players">
        <div className="roster-detail-players-head">
          <div>
            <span className="eyebrow">Participants</span>
            <h2>Players who joined</h2>
          </div>
          <span className="panel-count">
            {roster.joinedCount} of {roster.capacity}
          </span>
        </div>

        {members.length > 0 ? (
          <ul className="roster-detail-player-list">
            {members.map((member) => {
              const level = getLevel(member.rating);
              return (
                <li
                  key={member.playerId}
                  className={`roster-detail-player ${member.isViewer ? "is-viewer" : ""}`}
                >
                  <Avatar name={member.name} size="sm" />
                  <div className="roster-detail-player-copy">
                    <strong>
                      {member.name}
                      {member.isViewer ? <span className="you-badge">You</span> : null}
                    </strong>
                    <span>
                      {member.rating.toFixed(1)} · {level.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-copy">
            No players have joined this roster yet. The first person to join will appear here.
          </p>
        )}
      </div>

      {!isAdmin ? (
        <div
          className={`roster-detail-join ${
            roster.joined ? "is-joined" : roster.ended ? "is-ended" : ""
          }`}
        >
          <div className="roster-detail-join-copy">
            <strong>
              {roster.ended
                ? "This roster has ended"
                : roster.joined
                  ? "Your spot is reserved"
                  : roster.full
                    ? "This roster is full"
                    : "Ready to join this roster?"}
            </strong>
            <span>
              {roster.ended
                ? "The admin has closed this transaction and it is no longer accepting players."
                : roster.joined
                  ? `${roster.joinedCount}/${roster.capacity} players joined · ${roster.remaining} slots remain`
                  : roster.full
                    ? "Choose another scheduled roster to join."
                    : `${roster.remaining} of ${roster.capacity} slots remain for this game.`}
            </span>
          </div>
          <button
            type="button"
            className={`btn ${
              roster.joined || roster.full || roster.ended ? "btn-outline" : "btn-primary"
            } btn-small`}
            onClick={() => void onJoin(roster)}
            disabled={roster.joined || roster.full || roster.ended || joiningId === roster.id}
          >
            {joiningId === roster.id ? (
              <span className="spinner spinner-light" />
            ) : roster.joined ? (
              <CheckIcon size={15} />
            ) : roster.ended ? (
              <LockIcon size={15} />
            ) : (
              <PlusIcon size={15} />
            )}
            {joiningId === roster.id
              ? "Joining…"
              : roster.joined
                ? "Joined"
                : roster.ended
                  ? "Roster ended"
                  : roster.full
                    ? "Roster full"
                    : "Join this roster"}
          </button>
        </div>
      ) : (
        <div className="roster-detail-admin-note">
          <div className="roster-detail-admin-note-copy">
            <span className="eyebrow">Admin controls</span>
            <p>
              {roster.ended
                ? "This transaction has ended and has been removed from the roster list."
                : "Edit the roster name, location, date, or times. The game board and Players & ratings sections are available below. End the transaction when the roster should stop accepting players."}
            </p>
          </div>
          {roster.ended ? (
            <span className="game-roster-status is-ended">
              <LockIcon size={13} />
              Ended
            </span>
          ) : (
            <div className="roster-detail-admin-actions">
              <button type="button" className="btn btn-outline btn-small" onClick={onEditRoster}>
                <PencilIcon size={15} />
                Edit roster
              </button>
              <button type="button" className="btn btn-danger btn-small" onClick={onEndRoster}>
                <LockIcon size={15} />
                End Transaction
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
