"use client";

import { useEffect, useState } from "react";
import { AlertIcon, TrashIcon, XIcon } from "./icons";

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  cancelLabel?: string;
  workingLabel?: string;
  requirePhrase?: string;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onClose,
  onConfirm,
  cancelLabel = "Keep player",
  workingLabel = "Removing…",
  requirePhrase,
}: ConfirmDialogProps) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [phrase, setPhrase] = useState("");
  const phraseMatches =
    !requirePhrase || phrase.trim().toLowerCase() === requirePhrase.toLowerCase();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, working]);

  async function handleConfirm() {
    if (!phraseMatches) {
      setError(`Type ${requirePhrase} to confirm this action.`);
      return;
    }

    setWorking(true);
    setError("");
    try {
      await onConfirm();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Could not complete that action.");
      setWorking(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !working) onClose();
      }}
    >
      <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="modal-head">
          <span className="danger-icon"><TrashIcon size={20} /></span>
          <button className="icon-btn" type="button" onClick={onClose} disabled={working} aria-label="Close">
            <XIcon size={20} />
          </button>
        </div>
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        {requirePhrase ? (
          <label className="confirm-phrase">
            <span>
              Type <strong>{requirePhrase}</strong> to continue
            </span>
            <input
              type="text"
              value={phrase}
              onChange={(event) => {
                setPhrase(event.target.value);
                setError("");
              }}
              placeholder={requirePhrase}
              aria-label={`Type ${requirePhrase} to confirm`}
              autoComplete="off"
              autoFocus
              disabled={working}
            />
          </label>
        ) : null}
        {error ? (
          <div className="form-error" role="alert">
            <AlertIcon size={17} />
            <span>{error}</span>
          </div>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={working}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={working || !phraseMatches}
          >
            {working ? <span className="spinner" aria-hidden /> : <TrashIcon size={17} />}
            {working ? workingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
