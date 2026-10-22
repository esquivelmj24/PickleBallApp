import Link from "next/link";
import { AuthForm } from "./AuthForm";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function AuthCard({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";

  return (
    <div className="auth-shell">
      <header className="auth-topbar">
        <Link className="brand" href="/login" aria-label="Pickle & Chill">
          <span className="brand-copy">
            <strong>PICKLE &amp; CHILL</strong>
            <small>Committee console</small>
          </span>
        </Link>
        <div className="auth-topbar-actions">
          <ThemeSwitcher compact />
        </div>
      </header>

      <main className="auth-main">
        <section className="auth-card panel" aria-labelledby="auth-title">
          <span className="eyebrow">{isRegister ? "Admin registration" : "Admin sign in"}</span>
          <h1 id="auth-title">{isRegister ? "Create your admin account" : "Welcome back"}</h1>
          <p className="auth-lede">
            {isRegister
              ? "Every field is required. This account gets its own private roster, courts, scores, and game history."
              : "Sign in with your alias and password to manage your own players, courts, and scores."}
          </p>

          <AuthForm mode={mode} />

          <p className="auth-switch">
            {isRegister ? "Already registered?" : "Need an admin account?"}{" "}
            <Link href={isRegister ? "/login" : "/register"}>
              {isRegister ? "Sign in" : "Register"}
            </Link>
          </p>
        </section>
      </main>

      <footer className="auth-footer">
        <span>Pickle &amp; Chill · Admin access only</span>
        <span>Each account has its own private game board</span>
      </footer>
    </div>
  );
}
