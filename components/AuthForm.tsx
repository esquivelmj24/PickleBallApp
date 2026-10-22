"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "register";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (isRegister && !admin) {
      setError("Confirm the Admin user checkbox to create an admin account.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { alias, password, admin } : { alias, password }),
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
          placeholder="e.g. court-committee"
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
        <label className="auth-check">
          <input
            type="checkbox"
            name="admin"
            checked={admin}
            onChange={(event) => setAdmin(event.target.checked)}
            required
          />
          <span>
            <strong>Admin user</strong>
            <small>Admins can edit players, courts, scores, and the whole game journey.</small>
          </span>
        </label>
      ) : null}

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn btn-primary btn-large auth-submit" disabled={busy}>
        {busy
          ? isRegister
            ? "Creating account…"
            : "Signing in…"
          : isRegister
            ? "Create admin account"
            : "Sign in"}
      </button>
    </form>
  );
}
