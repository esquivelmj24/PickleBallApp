"use client";

import { useEffect, useState } from "react";
import { MIN_RATING, MAX_RATING, normalizeRating } from "@/lib/levels";
import { GENDERS } from "@/lib/constants";
import { AlertIcon, CheckIcon, MinusIcon, PlusIcon, XIcon } from "./icons";

type ProfileModalProps = {
  user: {
    alias: string;
    rating?: number;
    isNR?: boolean;
    gender?: string;
  };
  onClose: () => void;
  onSubmit: (payload: { alias: string; rating: number; isNR: boolean; gender: string }) => Promise<void>;
};

export function ProfileModal({ user, onClose, onSubmit }: ProfileModalProps) {
  const initialRating = user.rating ?? 3.0;
  const [alias, setAlias] = useState(user.alias);
  const [rating, setRating] = useState(initialRating);
  const [ratingText, setRatingText] = useState(initialRating.toFixed(1));
  const [isNR, setIsNR] = useState(Boolean(user.isNR));
  const [gender, setGender] = useState(user.gender ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    if (!alias.trim()) {
      setError("Enter your alias.");
      return;
    }

    const normalized = normalizeRating(ratingText) ?? rating;
    if (!gender) {
      setError("Please select a gender.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        alias: alias.trim(),
        rating: normalized,
        isNR,
        gender,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save profile.");
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
      <div className="modal player-modal" role="dialog" aria-modal="true">
        <div className="modal-accent" style={{ background: "var(--forest)" }} />
        <div className="modal-head">
          <div>
            <span className="eyebrow">My Account</span>
            <h2>Edit Profile</h2>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} disabled={saving} aria-label="Close">
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label htmlFor="profile-alias">Alias</label>
            <input
              id="profile-alias"
              className="text-input"
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              placeholder="Your alias"
              maxLength={30}
              autoComplete="off"
            />
            <span className="field-hint">3–30 characters. This is your unique identifier.</span>
          </div>

          <div className="rating-block">
            <div className="rating-block-head">
              <div>
                <label htmlFor={isNR ? undefined : "profile-rating"}>Registered Rate</label>
                <span className="field-hint">
                  {isNR
                    ? "NR selected — your rate is ignored."
                    : "Set your rate from 2.0 to 4.0, or mark as NR."}
                </span>
              </div>
              <div className="rating-head-actions">
                <button
                  type="button"
                  className={`nr-toggle ${isNR ? "is-active" : ""}`}
                  aria-pressed={isNR}
                  onClick={() => setIsNR((current) => !current)}
                  disabled={saving}
                  title={isNR ? "Use numeric rating" : "Mark as Not Rated"}
                >
                  NR
                </button>
              </div>
            </div>

            {isNR ? (
              <div className="rating-nr-display">
                <strong className="rating-nr-mark">NR</strong>
                <div>
                  <strong>Not Rated</strong>
                  <span>Your rate is unknown. You will be balanced neutrally.</span>
                </div>
              </div>
            ) : (
              <div className="rating-display-row">
                <div className="rating-stepper">
                  <button
                    type="button"
                    className="step-btn"
                    onClick={() => updateRating(rating - 0.1)}
                    disabled={rating <= MIN_RATING}
                  >
                    <MinusIcon size={16} />
                  </button>
                  <div className="rating-number">
                    <input
                      id="profile-rating"
                      type="number"
                      min={MIN_RATING}
                      max={MAX_RATING}
                      step="0.1"
                      value={ratingText}
                      onChange={(event) => handleRatingText(event.target.value)}
                      onBlur={() => setRatingText(rating.toFixed(1))}
                    />
                    <span>RATE</span>
                  </div>
                  <button
                    type="button"
                    className="step-btn"
                    onClick={() => updateRating(rating + 0.1)}
                    disabled={rating >= MAX_RATING}
                  >
                    <PlusIcon size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="field-group">
            <label htmlFor="profile-gender">Gender</label>
            <select
              id="profile-gender"
              className="text-input"
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              required
            >
              <option value="">Select gender</option>
              {GENDERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
