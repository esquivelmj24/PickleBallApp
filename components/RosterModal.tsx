"use client";

import { useEffect, useState } from "react";
import {
  ROSTER_CAPACITIES,
  ROSTER_CAPACITY_MAX,
  ROSTER_CAPACITY_MIN,
} from "@/lib/roster-config";
import { AlertIcon, XIcon } from "./icons";

export type RosterFormValues = {
  name: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
};

type RosterModalProps = {
  onClose: () => void;
  onSubmit: (payload: RosterFormValues) => Promise<void>;
};

function todayValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function RosterModal({ onClose, onSubmit }: RosterModalProps) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(todayValue);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [capacity, setCapacity] = useState("20");
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("Enter a roster name with at least 2 characters.");
      return;
    }
    const trimmedLocation = location.trim().replace(/\s+/g, " ");
    if (trimmedLocation.length < 2) {
      setError("Enter the location for this roster.");
      return;
    }
    if (trimmedLocation.length > 100) {
      setError("Location must be 100 characters or fewer.");
      return;
    }
    if (!/[a-zA-Z0-9]/.test(trimmedLocation)) {
      setError("Location must include a letter or number.");
      return;
    }
    if (!date) {
      setError("Choose the scheduled date.");
      return;
    }
    if (!startTime) {
      setError("Choose the start time.");
      return;
    }
    if (!endTime) {
      setError("Choose the end time.");
      return;
    }
    if (endTime <= startTime) {
      setError("End time must be later than the start time.");
      return;
    }

    const parsedCapacity = Number(capacity);
    if (
      !Number.isInteger(parsedCapacity) ||
      parsedCapacity < ROSTER_CAPACITY_MIN ||
      parsedCapacity > ROSTER_CAPACITY_MAX
    ) {
      setError(
        `Enter a whole number of players from ${ROSTER_CAPACITY_MIN} to ${ROSTER_CAPACITY_MAX}.`,
      );
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: trimmedName,
        location: trimmedLocation,
        date,
        startTime,
        endTime,
        capacity: parsedCapacity,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not create the roster.",
      );
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
      <div
        className="modal roster-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="roster-modal-title"
      >
        <div className="modal-accent" />
        <div className="modal-head">
          <div>
            <span className="eyebrow">Schedule a game</span>
            <h2 id="roster-modal-title">Create a roster</h2>
          </div>
          <button
            className="icon-btn"
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <XIcon size={20} />
          </button>
        </div>

        <p className="modal-intro">
          Set the date, location, start and end times, and number of player slots. Players will see
          the roster on their page and can reserve a spot until it is full or you end the
          transaction.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label htmlFor="roster-name">Roster name</label>
            <input
              id="roster-name"
              className="text-input"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Friday Night Pickle"
              maxLength={60}
              autoFocus
            />
          </div>

          <div className="field-group">
            <label htmlFor="roster-location">Location</label>
            <input
              id="roster-location"
              className="text-input"
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. Riverside Pickleball Courts"
              maxLength={100}
            />
          </div>

          <div className="roster-form-row roster-time-row">
            <div className="field-group">
              <label htmlFor="roster-date">Date</label>
              <input
                id="roster-date"
                className="text-input"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="roster-start-time">Start time</label>
              <input
                id="roster-start-time"
                className="text-input"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="roster-end-time">End time</label>
              <input
                id="roster-end-time"
                className="text-input"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="roster-capacity">Number of players</label>
            <div className="capacity-manual-row">
              <input
                id="roster-capacity"
                className="text-input capacity-input"
                type="number"
                inputMode="numeric"
                min={ROSTER_CAPACITY_MIN}
                max={ROSTER_CAPACITY_MAX}
                step={1}
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
              />
              <span className="capacity-unit">players max</span>
            </div>
            <div className="capacity-presets" aria-label="Quick capacity presets">
              {ROSTER_CAPACITIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`capacity-chip ${
                    Number(capacity) === option ? "is-selected" : ""
                  }`}
                  aria-pressed={Number(capacity) === option}
                  onClick={() => setCapacity(String(option))}
                >
                  {option}
                </button>
              ))}
            </div>
            <span className="field-hint">
              Enter any number from {ROSTER_CAPACITY_MIN} to {ROSTER_CAPACITY_MAX}, or choose a
              quick preset. The roster shows a ratio such as 1/{capacity || "N"}.
            </span>
          </div>

          {error ? (
            <div className="form-error" role="alert">
              <AlertIcon size={15} />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner spinner-light" /> : null}
              {saving ? "Creating…" : "Create roster"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
