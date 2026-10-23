"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertIcon, CameraIcon, CheckIcon, TrashIcon } from "./icons";

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SOURCE_BYTES = 6 * 1024 * 1024;
const MAX_DIMENSION = 512;

type AvatarResponse = {
  avatarUrl?: string | null;
  error?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be opened."));
    };
    image.src = url;
  });
}

async function resizeProfileImage(file: File): Promise<string> {
  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("That image has no visible content.");
  }

  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - side) / 2;
  const sourceY = (image.naturalHeight - side) / 2;
  const target = Math.min(MAX_DIMENSION, side);
  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Your browser could not prepare that image.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, target, target);
  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, target, target);

  return canvas.toDataURL("image/jpeg", 0.84);
}

export function ProfileImageCard({
  alias,
  role,
}: {
  alias: string;
  role: "admin" | "player";
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    async function loadAvatar() {
      try {
        const response = await fetch("/api/profile/avatar", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as AvatarResponse;
        if (!response.ok) {
          throw new Error(payload.error || "Could not load the profile image.");
        }
        if (active) setAvatarUrl(payload.avatarUrl ?? null);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load the profile image.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAvatar();
    return () => {
      active = false;
    };
  }, []);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setNotice("");

    if (!ACCEPTED_TYPES.has(file.type)) {
      setError("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("Choose an image smaller than 6 MB.");
      return;
    }

    setSaving(true);
    try {
      const image = await resizeProfileImage(file);
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const payload = (await response.json().catch(() => ({}))) as AvatarResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Could not save the profile image.");
      }

      setAvatarUrl(payload.avatarUrl ?? image);
      setNotice("Profile image updated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save the profile image.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setError("");
    setNotice("");
    setRemoving(true);
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as AvatarResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Could not remove the profile image.");
      }

      setAvatarUrl(null);
      setNotice("Profile image removed.");
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove the profile image.",
      );
    } finally {
      setRemoving(false);
    }
  }

  const busy = loading || saving || removing;
  const roleLabel = role === "admin" ? "Admin account" : "Player account";

  return (
    <section className="night-card profile-card" aria-labelledby="profile-image-title">
      <div className="night-lines" aria-hidden>
        <span className="night-line-v" />
        <span className="night-line-h" />
        <span className="night-line-kitchen" />
      </div>

      <div className="profile-card-head">
        <div>
          <span className="eyebrow eyebrow-light">Your profile</span>
          <h2 id="profile-image-title">Upload profile image</h2>
        </div>
        <span className="profile-role-chip">{roleLabel}</span>
      </div>

      <div className="profile-card-content">
        <span className={`profile-photo ${avatarUrl ? "has-image" : ""}`}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={`${alias} profile`} />
          ) : (
            <span className="profile-photo-initials">{initials(alias)}</span>
          )}
          <span className="profile-photo-badge" aria-hidden>
            <CameraIcon size={15} />
          </span>
        </span>

        <div className="profile-card-copy">
          <strong title={alias}>{alias}</strong>
          <span className="profile-card-role">{roleLabel}</span>
          <p>
            Add a photo so teammates can recognise you around the courts. It is saved to
            your account and can be changed at any time.
          </p>
        </div>
      </div>

      <div className="profile-card-actions">
        <button
          type="button"
          className="btn btn-primary btn-small profile-upload-button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {saving ? <span className="spinner spinner-light" /> : <CameraIcon size={16} />}
          {saving ? "Saving..." : avatarUrl ? "Change image" : "Upload image"}
        </button>
        <input
          ref={inputRef}
          className="profile-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => void handleFileChange(event)}
          disabled={busy}
          tabIndex={-1}
          aria-label="Choose profile image"
        />
        {avatarUrl ? (
          <button
            type="button"
            className="profile-remove-button"
            onClick={() => void handleRemove()}
            disabled={busy}
          >
            {removing ? (
              <span className="spinner spinner-light" />
            ) : (
              <TrashIcon size={14} />
            )}
            {removing ? "Removing..." : "Remove"}
          </button>
        ) : null}
      </div>

      {error ? (
        <span className="profile-card-message is-error" role="alert">
          <AlertIcon size={14} />
          {error}
        </span>
      ) : notice ? (
        <span className="profile-card-message" role="status">
          <CheckIcon size={14} />
          {notice}
        </span>
      ) : (
        <span className="profile-card-hint">
          PNG, JPG, or WebP. We crop to a square and resize to 512px.
        </span>
      )}

      <span className="profile-card-tag">PICKLE &amp; CHILL PROFILE</span>
    </section>
  );
}
