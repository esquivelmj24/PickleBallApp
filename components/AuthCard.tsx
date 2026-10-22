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
            <small>Balanced courts, better games</small>
          </span>
        </Link>
        <div className="auth-topbar-actions">
          <ThemeSwitcher compact />
        </div>
      </header>

      <main className="auth-main">
        <section className="auth-card panel" aria-labelledby="auth-title">
          <span className="eyebrow">{isRegister ? "Account registration" : "Welcome back"}</span>
          <h1 id="auth-title">{isRegister ? "Create your account" : "Welcome back"}</h1>
          <p className="auth-lede">
            {isRegister
              ? "Choose an Admin user to run the board, or a Player user to view the live courts and join games."
              : "Sign in to manage the court board or join the club game."}
          </p>

          <AuthForm mode={mode} />

          <p className="auth-switch">
            {isRegister ? "Already registered?" : "Need an account?"}{" "}
            <Link href={isRegister ? "/login" : "/register"}>
              {isRegister ? "Sign in" : "Register"}
            </Link>
          </p>
        </section>
      </main>

      <footer className="auth-footer">
        <span>Pickle &amp; Chill · Balanced courts, better games</span>
        <span>Admins manage the board. Players join and follow the game.</span>
      </footer>
    </div>
  );
}
