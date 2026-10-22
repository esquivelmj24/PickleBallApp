"use client";

import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "pickle-theme";

export const THEMES = [
  { id: "classic", label: "Classic" },
  { id: "dark", label: "Dark" },
  { id: "gray", label: "Gray" },
  { id: "yellow", label: "Black & Yellow" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeId>("classic");

  useEffect(() => {
    const current = document.documentElement.dataset.theme as ThemeId | undefined;
    if (current && THEMES.some((item) => item.id === current)) {
      setTheme(current);
    }
  }, []);

  function applyTheme(next: ThemeId) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage restrictions; the theme still applies for this visit.
    }
  }

  return (
    <label className={`theme-switcher${compact ? " is-compact" : ""}`}>
      <span className="theme-switcher-label">Theme</span>
      <select
        className="theme-select"
        value={theme}
        onChange={(event) => applyTheme(event.target.value as ThemeId)}
        aria-label="Background theme"
      >
        {THEMES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
