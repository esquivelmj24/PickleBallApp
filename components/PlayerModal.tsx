"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getLevel, LEVELS, MAX_RATING, MIN_RATING, normalizeRating } from "@/lib/levels";
import type { Player } from "@/lib/types";
import { AlertIcon, CheckIcon, MinusIcon, PlusIcon, XIcon } from "./icons";

type PlayerModalProps = {
  mode: "add" | "edit";
  player?: Player;
  onClose: () => void;
  onSubmit: (payload: { name: string; rating: number }) => Promise<void>;
};

export function PlayerModal({ mode, player, onClose, onSubmit }: PlayerModalProps) {
  const initialRating = player?.rating ?? 3.0;
  const [name, setName] = useState(player?.name ?? "");
  const [rating, setRating] = useState(initialRating);
  const [ratingText, setRatingText] = useState(initialRating.toFixed(1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const level = useMemo(() => getLevel(rating), [rating]);
  const rangeProgress = ((rating - MIN_RATING) / (MAX_RATING - MIN_RATING)) * 100;

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

  function updateRating(next: number) {
    const normalized = normalizeRating(next);
    if (normalized === null) return;
    setRating(normalized);
    setRatingText(normalized.toFixed(1));
  }

  function handleRatingText(value: string) {
    setRatingText(value);
    const normalized = normalizeRating(value);
    if (normalized !== null) setRating(normalized);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Enter the player's name.");
      return;
    }

    const normalized = normalizeRating(ratingText) ?? rating;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), rating: normalized });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save the player.");
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
      <div className="modal player-modal" role="dialog" aria-modal="true" aria-labelledby="player-modal-title">
        <div className="modal-accent" style={{ background: level.color }} />
        <div className="modal-head">
          <div>
            <span className="eyebrow">{mode === "add" ? "Roster entry" : "Update player"}</span>
            <h2 id="player-modal-title">{mode === "add" ? "Add a player" : "Edit player"}</h2>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} disabled={saving} aria-label="Close">
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label htmlFor="player-name">Player name</label>
            <input
              id="player-name"
              className="text-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Maya Chen"
              maxLength={40}
              autoFocus
              autoComplete="off"
            />
            <span className="field-hint">One name per person. Duplicate names are not allowed.</span>
          </div>

          <div className="rating-block">
            <div className="rating-block-head">
              <div>
                <label htmlFor="player-rating">Committee rating</label>
                <span className="field-hint">Set a rate from 2.0 to 4.0.</span>
              </div>
              <span className="level-pill" style={{ background: level.soft, color: level.color }}>
                <span className="level-dot" style={{ background: level.color }} />
                {level.label}
              </span>
            </div>

            <div className="rating-display-row">
              <div className="rating-stepper">
                <button
                  type="button"
                  className="step-btn"
                  onClick={() => updateRating(rating - 0.1)}
                  disabled={rating <= MIN_RATING}
                  aria-label="Decrease rating by 0.1"
                >
                  <MinusIcon size={16} />
                </button>
                <div className="rating-number">
                  <input
                    id="player-rating"
                    type="number"
                    min={MIN_RATING}
                    max={MAX_RATING}
                    step="0.1"
                    value={ratingText}
                    onChange={(event) => handleRatingText(event.target.value)}
                    onBlur={() => setRatingText(rating.toFixed(1))}
                    aria-label="Player rating"
                  />
                  <span>RATE</span>
                </div>
                <button
                  type="button"
                  className="step-btn"
                  onClick={() => updateRating(rating + 0.1)}
                  disabled={rating >= MAX_RATING}
                  aria-label="Increase rating by 0.1"
                >
                  <PlusIcon size={16} />
                </button>
              </div>

              <div className="rating-slider-wrap">
                <input
                  className="rating-slider"
                  type="range"
                  min={MIN_RATING}
                  max={MAX_RATING}
                  step="0.1"
                  value={rating}
                  onChange={(event) => updateRating(Number(event.target.value))}
                  style={
                    {
                      "--range-progress": `${rangeProgress}%`,
                      "--range-color": level.color,
                    } as CSSProperties
                  }
                  aria-label="Rating slider"
                />
                <div className="range-labels">
                  <span>2.0</span>
                  <span>3.0</span>
                  <span>4.0</span>
                </div>
              </div>
            </div>

            <div className="level-guide">
              {LEVELS.map((band) => {
                const active = band.key === level.key;
                return (
                  <div
                    key={band.key}
                    className={`level-guide-item ${active ? "is-active" : ""}`}
                    style={{ "--band-color": band.color } as CSSProperties}
                  >
                    <div className="level-guide-top">
                      <span className="level-dot" style={{ background: band.color }} />
                      <strong>{band.label}</strong>
                      {active ? <CheckIcon size={14} /> : null}
                    </div>
                    <span>{band.min.toFixed(1)} – {band.max.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
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
              {saving ? "Saving…" : mode === "add" ? "Add to roster" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
