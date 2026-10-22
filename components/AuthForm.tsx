"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GENDERS, type Gender } from "@/lib/constants";
import { getLevel, normalizeRating } from "@/lib/levels";

type AuthMode = "login" | "register";
type Role = "admin" | "player";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [rating, setRating] = useState("3.0");
  const [gender, setGender] = useState<Gender | "">("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";
  const normalizedRating = normalizeRating(rating);
  const level = normalizedRating !== null ? getLevel(normalizedRating) : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (isRegister && !role) {
      setError("Choose Admin user or Player user to create an account.");
      return;
    }

    if (isRegister && role === "player") {
      if (normalizeRating(rating) === null) {
        setError("Rate must be between 2.0 and 4.0.");
        return;
      }
      if (!gender) {
        setError("Choose a gender for the player account.");
        return;
      }
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRegister
            ? {
                alias,
                password,
                role,
                ...(role === "player"
                  ? { rating: normalizeRating(rating), gender }
                  : {}),
              }
            : { alias, password },
        ),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not complete the request. Try again.");
      }

      router.replace("/");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const submitLabel = !isRegister
    ? "Sign in"
    : role === "admin"
      ? "Create admin account"
      : role === "player"
        ? "Create player account"
        : "Create account";

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <label className="auth-field">
        <span>Alias</span>
        <input
          type="text"
          name="alias"
          value={alias}
          onChange={(event) => setAlias(event.target.value)}
          autoComplete="username"
          placeholder={role === "player" ? "e.g. maya-chen" : "e.g. court-committee"}
          minLength={3}
          maxLength={30}
          required
        />
      </label>

      <label className="auth-field">
        <span>Password</span>
        <input
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={isRegister ? "new-password" : "current-password"}
          placeholder={isRegister ? "At least 8 characters" : "Your password"}
          minLength={8}
          maxLength={128}
          required
        />
      </label>

      {isRegister ? (
        <fieldset className="auth-role-group">
          <legend>Account type</legend>

          <label className={`auth-role ${role === "admin" ? "is-selected" : ""}`}>
            <input
              type="radio"
              name="role"
              value="admin"
              checked={role === "admin"}
              onChange={() => setRole("admin")}
            />
            <span>
              <strong>Admin user</strong>
              <small>Create and manage games, players, courts, and scores.</small>
            </span>
          </label>

          <label className={`auth-role ${role === "player" ? "is-selected" : ""}`}>
            <input
              type="radio"
              name="role"
              value="player"
              checked={role === "player"}
              onChange={() => setRole("player")}
            />
            <span>
              <strong>Player user</strong>
              <small>View the live board and join games with your registered rate.</small>
            </span>
          </label>
        </fieldset>
      ) : null}

      {isRegister && role === "player" ? (
        <>
          <label className="auth-field">
            <span>Rate</span>
            <input
              type="number"
              name="rating"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              min={2}
              max={4}
              step="0.1"
              inputMode="decimal"
              required
            />
            <small className="auth-field-hint">
              {level
                ? `${level.label} · used automatically for balanced matchmaking.`
                : "Set a rate from 2.0 to 4.0."}
            </small>
          </label>

          <label className="auth-field">
            <span>Gender</span>
            <select
              name="gender"
              value={gender}
              onChange={(event) => setGender(event.target.value as Gender | "")}
              required
            >
              <option value="">Select gender</option>
              {GENDERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn btn-primary btn-large auth-submit" disabled={busy}>
        {busy ? (isRegister ? "Creating account…" : "Signing in…") : submitLabel}
      </button>
    </form>
  );
}
