"use client";

import { useSyncExternalStore } from "react";

type Choice = "light" | "dark" | "system";

const STORAGE_KEY = "wwe-theme";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function read(): Choice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/**
 * The server has no way to know the visitor's stored choice, so it always
 * renders the neutral state. React swaps in the real one after hydration
 * without a mismatch warning — and the inline script in the root layout has
 * already painted the correct colours, so nothing flashes.
 */
function readOnServer(): Choice {
  return "system";
}

/**
 * "system" removes the attribute entirely so the `prefers-color-scheme` media
 * query takes over again — which is why the light theme is restated explicitly
 * in globals.css rather than left to fall through.
 */
function write(choice: Choice) {
  const root = document.documentElement;
  try {
    if (choice === "system") {
      root.removeAttribute("data-theme");
      localStorage.removeItem(STORAGE_KEY);
    } else {
      root.setAttribute("data-theme", choice);
      localStorage.setItem(STORAGE_KEY, choice);
    }
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). The visual
    // change still applies for this page view; it just will not persist.
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
  }
  listeners.forEach((notify) => notify());
}

const NEXT: Record<Choice, Choice> = {
  system: "dark",
  dark: "light",
  light: "system",
};

const GLYPH: Record<Choice, string> = {
  system: "◐",
  dark: "☾",
  light: "☀",
};

export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, read, readOnServer);
  const label = choice === "system" ? "Theme: follows your system" : `Theme: ${choice}`;

  return (
    <button
      type="button"
      onClick={() => write(NEXT[choice])}
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-full border border-line text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
    >
      <span aria-hidden="true" className="text-[15px] leading-none">
        {GLYPH[choice]}
      </span>
    </button>
  );
}
