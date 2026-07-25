"use client";

import { useState } from "react";

import { cx } from "./ui";

/**
 * The optional email.
 *
 * Lives on the data page, not inside the survey. That is not cosmetic: the
 * two requests being minutes apart, from different pages, to different
 * databases, is a large part of what makes "never linked to your answers"
 * true rather than merely stated.
 */
export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string>();
  /** Only ever populated by a development server with no mail credentials. */
  const [devLink, setDevLink] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(undefined);

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setState("error");
        setError(body?.error ?? "That did not work. Please try again.");
        return;
      }
      const body = (await res.json().catch(() => null)) as { devLink?: string } | null;
      if (body?.devLink) setDevLink(body.devLink);
      setState("sent");
    } catch {
      setState("error");
      setError("We could not reach the server. Check your connection and try again.");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-lg border border-line bg-surface p-5 text-xs leading-relaxed text-ink-2">
        <p>
          <b className="font-semibold text-ink">Check your inbox.</b> There is a link to confirm.
          Until you follow it we hold nothing, and if you ignore it the address is deleted within
          a fortnight.
        </p>
        {devLink && (
          <p className="mt-4 border-t border-line pt-4">
            <b className="font-semibold text-ink">Development:</b> no mail credentials are
            configured, so nothing was sent.{" "}
            <a href={devLink} className="break-all text-accent underline underline-offset-2">
              Follow the confirmation link
            </a>
            .
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="subscribe-email" className="text-xs font-semibold text-ink">
        Email me when results publish
      </label>
      <p className="max-w-[52ch] text-xs leading-relaxed text-ink-2">
        Optional, and never linked to your answers — it goes to a different database entirely,
        which is also why we can never email you about your own numbers.
      </p>
      <div className="flex flex-wrap gap-3">
        <input
          id="subscribe-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full max-w-xs rounded-md border border-line bg-surface px-4 py-3 text-base text-ink transition-colors hover:border-line-2"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className={cx(
            "rounded-full bg-accent px-6 py-3 font-display text-xs font-semibold text-on-accent",
            "transition-colors hover:bg-accent-hover disabled:opacity-40",
          )}
        >
          {state === "sending" ? "Sending…" : "Notify me"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-accent">
          {error}
        </p>
      )}
    </form>
  );
}
