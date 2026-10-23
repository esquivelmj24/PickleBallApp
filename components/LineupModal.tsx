"use client";

import { useEffect, useMemo, useState } from "react";
import { averageRating } from "@/lib/format";
import type { Match, Player } from "@/lib/types";
import { Avatar } from "./Avatar";
import { AlertIcon, CheckIcon, LockIcon, XIcon } from "./icons";

type LineupModalProps = {
  match: Match;
  players: Player[];
  courtLabel: string;
  occupiedByCourt: Map<string, number>;
  onClose: () => void;
  onSubmit: (team1: string[], team2: string[]) => Promise<void>;
};

type Slot = { team: 1 | 2; index: number; label: string };

const SLOTS: Slot[] = [
  { team: 1, index: 0, label: "Team A · Player 1" },
  { team: 1, index: 1, label: "Team A · Player 2" },
  { team: 2, index: 0, label: "Team B · Player 1" },
  { team: 2, index: 1, label: "Team B · Player 2" },
];

export function LineupModal({
  match,
  players,
  courtLabel,
  occupiedByCourt,
  onClose,
  onSubmit,
}: LineupModalProps) {
  const [team1, setTeam1] = useState<string[]>([
    match.team1[0]?.playerId ?? "",
    match.team1[1]?.playerId ?? "",
  ]);
  const [team2, setTeam2] = useState<string[]>([
    match.team2[0]?.playerId ?? "",
    match.team2[1]?.playerId ?? "",
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentIds = new Set([...team1, ...team2]);
  const selectedPlayerMap = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );
  const team1Players = team1.map((id) => selectedPlayerMap.get(id)).filter(Boolean) as Player[];
  const team2Players = team2.map((id) => selectedPlayerMap.get(id)).filter(Boolean) as Player[];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, saving]);

  function setSlot(slot: Slot, playerId: string) {
    if (slot.team === 1) {
      const next = [...team1];
      next[slot.index] = playerId;
      setTeam1(next);
    } else {
      const next = [...team2];
      next[slot.index] = playerId;
      setTeam2(next);
    }
  }

  function getSlotValue(slot: Slot) {
    return slot.team === 1 ? team1[slot.index] : team2[slot.index];
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (new Set(currentIds).size !== 4 || currentIds.has("")) {
      setError("Choose four different players for this court.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit(team1, team2);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not update the lineup.");
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !saving) onClose();
      }}
    >
      <div className="modal lineup-modal" role="dialog" aria-modal="true" aria-labelledby="lineup-modal-title">
        <div className="modal-accent" style={{ background: "#4BA3FF" }} />
        <div className="modal-head">
          <div>
            <span className="eyebrow">
              Committee override · {courtLabel}
            </span>
            <h2 id="lineup-modal-title">Change the lineup</h2>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} disabled={saving} aria-label="Close">
            <XIcon size={20} />
          </button>
        </div>

        <p className="modal-intro">
          Swap in any available roster player. Rating groups are not enforced for manual
          changes. Players already assigned to another active court are locked until that
          lineup is changed. Players on completed courts are available again.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="lineup-teams">
            {[1, 2].map((teamNumber) => {
              const selected = teamNumber === 1 ? team1Players : team2Players;
              return (
                <div className={`lineup-team lineup-team-${teamNumber}`} key={teamNumber}>
                  <div className="lineup-team-head">
                    <span className="team-dot" />
                    <strong>Team {teamNumber === 1 ? "A" : "B"}</strong>
                    <span>{selected.length ? `Avg ${averageRating(selected)}` : "No players"}</span>
                  </div>
                  {SLOTS.filter((slot) => slot.team === teamNumber).map((slot) => {
                    const value = getSlotValue(slot);
                    return (
                      <label className="lineup-slot" key={`${slot.team}-${slot.index}`}>
                        <span>{slot.label}</span>
                        <div className="select-wrap">
                          <select
                            value={value}
                            onChange={(event) => setSlot(slot, event.target.value)}
                            required
                          >
                            <option value="" disabled>
                              Select a player
                            </option>
                            {players.map((player) => {
                              const occupiedCourt = occupiedByCourt.get(player.id);
                              const selectedElsewhere = currentIds.has(player.id) && value !== player.id;
                              const disabled = Boolean(occupiedCourt) || selectedElsewhere;
                              return (
                                <option key={player.id} value={player.id} disabled={disabled}>
                                  {player.name} · {player.isNR ? "NR" : player.rating.toFixed(1)}
                                  {occupiedCourt ? ` (Court ${occupiedCourt})` : ""}
                                  {selectedElsewhere ? " (selected)" : ""}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        {value && selectedPlayerMap.get(value) ? (
                          <div className="lineup-preview">
                            <Avatar name={selectedPlayerMap.get(value)!.name} size="xs" />
                            <span>{selectedPlayerMap.get(value)!.levelLabel}</span>
                            {occupiedByCourt.get(value) ? (
                              <span className="lock-note"><LockIcon size={12} /> In use</span>
                            ) : null}
                          </div>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="lineup-note">
            <CheckIcon size={16} />
            <span>
              <strong>Manual override:</strong> mixing rating groups is allowed, and the court
              will be labeled “Mixed levels” on the board. Changes apply to this rotation only;
              playing records stay untouched.
            </span>
          </div>

          {error ? (
            <div className="form-error" role="alert">
              <AlertIcon size={17} />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" aria-hidden /> : <CheckIcon size={18} />}
              {saving ? "Saving…" : "Save lineup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
