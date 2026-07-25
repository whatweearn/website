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
    script.onerror = () => reject(new Error("Turnstile script failed to load"));
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

  useEffect(() => {
    let cancelled = false;
    let solved = false;

    const giveUp = setTimeout(() => {
      if (!cancelled && !solved) onFailure?.();
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
            onToken(token);
          },
          "error-callback": () => {
            clearTimeout(giveUp);
            onToken(undefined);
            onFailure?.();
          },
          "expired-callback": () => {
            solved = false;
            onToken(undefined);
          },
        });
      })
      .catch(() => {
        // Script blocked or Cloudflare unreachable. Say so rather than leaving
        // someone staring at a disabled button: we never pretend to have
        // verified, but we do owe them an explanation.
        if (!cancelled) {
          clearTimeout(giveUp);
          onToken(undefined);
          onFailure?.();
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(giveUp);
      if (widgetRef.current && window.turnstile) {
        window.turnstile.remove(widgetRef.current);
        widgetRef.current = undefined;
      }
    };
  }, [siteKey, onToken, onFailure, attempt]);

  return <div ref={containerRef} className="flex justify-center" />;
}
