"use client";

import { useEffect, useRef } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (
        target: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "auto" | "light" | "dark";
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | undefined;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Drop the memoised promise and the dead tag, or every later retry
      // re-awaits this same rejection and fails instantly — which made the
      // "Try the check again" button a no-op for exactly the people who
      // needed it.
      scriptPromise = undefined;
      script.remove();
      reject(new Error("Turnstile script failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile, rendered explicitly.
 *
 * Chosen over proof-of-work because the threat here is coordinated
 * manipulation of the medians, and proof-of-work only raises an attacker's
 * cost linearly while spending the honest visitor's battery.
 *
 * The widget is interaction-only: most people will never see it.
 */
/** How long to wait before telling someone it is not going to work. */
const GIVE_UP_MS = 15_000;

export function Turnstile({
  siteKey,
  onToken,
  onFailure,
  attempt = 0,
}: {
  siteKey: string;
  onToken: (token: string | undefined) => void;
  /**
   * Called when no token is coming — script blocked, wrong hostname, or
   * Cloudflare unreachable. Without this the submit button waits forever on
   * "Checking your browser…", which is what a privacy extension blocking
   * challenges.cloudflare.com actually produces.
   */
  onFailure?: () => void;
  /** Changing this remounts the widget, for a retry. */
  attempt?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string>(undefined);

  // The callbacks are held in refs and deliberately kept out of the effect's
  // dependencies. Callers pass inline arrows — a new identity on every render —
  // and with those in the dependency array the effect re-ran on every keystroke
  // of the survey, removing and re-rendering the widget each time. Measured on
  // production: nineteen render/remove pairs from six interactions on a single
  // screen. That burns a fresh challenge per keystroke against one sitekey,
  // which is the shape of the abuse Cloudflare throttles, so the widget starts
  // failing for that visitor and the site looks like it is being blocked. It
  // also wiped any checkbox an interaction-only challenge had just shown, and
  // restarted the give-up timer, so the failure notice fired at random.
  //
  // The widget must mount once per (siteKey, attempt) and stay mounted.
  const onTokenRef = useRef(onToken);
  const onFailureRef = useRef(onFailure);
  useEffect(() => {
    onTokenRef.current = onToken;
    onFailureRef.current = onFailure;
  });

  useEffect(() => {
    let cancelled = false;
    let solved = false;

    const giveUp = setTimeout(() => {
      if (!cancelled && !solved) onFailureRef.current?.();
    }, GIVE_UP_MS);

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          appearance: "interaction-only",
          theme: "auto",
          callback: (token) => {
            solved = true;
            clearTimeout(giveUp);
            onTokenRef.current(token);
          },
          "error-callback": () => {
            clearTimeout(giveUp);
            onTokenRef.current(undefined);
            onFailureRef.current?.();
          },
          "expired-callback": () => {
            solved = false;
            onTokenRef.current(undefined);
          },
        });
      })
      .catch(() => {
        // Script blocked or Cloudflare unreachable. Say so rather than leaving
        // someone staring at a disabled button: we never pretend to have
        // verified, but we do owe them an explanation.
        if (!cancelled) {
          clearTimeout(giveUp);
          onTokenRef.current(undefined);
          onFailureRef.current?.();
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(giveUp);
      if (widgetRef.current && window.turnstile) {
        // Removing an id Turnstile has already discarded throws; a throw in a
        // cleanup would take the survey down with it.
        try {
          window.turnstile.remove(widgetRef.current);
        } catch {
          // Already gone. Nothing to do.
        }
        widgetRef.current = undefined;
      }
    };
  }, [siteKey, attempt]);

  return <div ref={containerRef} className="flex justify-center" />;
}
