"use client";

import { useEffect, useState } from "react";

import { count } from "@/lib/format";
import { COUNTRIES } from "@/lib/survey/options";

import { SubscribeForm } from "../SubscribeForm";
import { Button, cx } from "../ui";

/**
 * The screen after submitting.
 *
 * This is the only moment where somebody has just spent two minutes on the
 * survey and feels good about it, and the project's hardest problem is that
 * nothing publishes until a country reaches sixty responses. So the screen's
 * job is not to thank people — it is to convert that goodwill into the next
 * response.
 *
 * The share carries the *gap*, not an achievement. "I answered a survey" asks
 * for a favour; "Germany needs 47 more before its median publishes" makes the
 * reader's action consequential, and points them at one country rather than
 * scattering responses across twenty-seven.
 */

type Progress = {
  country: string;
  responses: number;
  remaining: number;
  published: boolean;
};

const SITE = typeof window === "undefined" ? "" : window.location.origin;

export function Confirmation({ country }: { country?: string }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [shared, setShared] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    if (!country) return;
    const controller = new AbortController();
    fetch(`/api/country-progress?country=${encodeURIComponent(country)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Progress | null) => setProgress(data))
      .catch(() => {
        // A missing count costs the share its best line, not the page.
      });
    return () => controller.abort();
  }, [country]);

  const countryName =
    progress?.country ?? COUNTRIES.find((c) => c.code === country)?.name ?? "Europe";

  const shareText = progress
    ? progress.published
      ? `I just added my salary to whatweearn, an anonymous salary survey for engineers in Europe. ${countryName}'s figures are already published — add yours and make them sharper.`
      : `I just added my salary to whatweearn, an anonymous salary survey for engineers in Europe. ${countryName} needs ${progress.remaining} more before its median publishes.`
    : "I just added my salary to whatweearn, an anonymous salary survey for engineers in Europe.";

  async function share() {
    const url = SITE || "https://whatweearn.eu";
    // Native sheet where it exists; clipboard everywhere else. No social
    // buttons — those are third-party scripts, which the CSP forbids and the
    // privacy policy promises we do not load.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "whatweearn", text: shareText, url });
        return;
      } catch {
        // Dismissed, or unavailable. Fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      setShared("copied");
      setTimeout(() => setShared("idle"), 4000);
    } catch {
      setShared("idle");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-xl border border-line bg-surface p-8 text-center shadow-lg">
        <h2 className="text-xl">That&rsquo;s in.</h2>

        {progress && !progress.published && (
          <div className="mx-auto mt-6 max-w-sm">
            <p className="text-sm text-ink-2">
              You&rsquo;re the{" "}
              <b className="figure-num font-semibold text-ink">
                {ordinalShort(progress.responses)}
              </b>{" "}
              engineer from {countryName}.
            </p>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-track"
              role="img"
              aria-label={`${progress.responses} of the responses ${countryName} needs`}
            >
              <div
                className="h-full rounded-full bg-coral transition-[width] duration-700"
                style={{
                  width: `${Math.min(100, (progress.responses / (progress.responses + progress.remaining)) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-3 text-xs text-ink-2">
              <b className="font-semibold text-ink">{count(progress.remaining)} more</b> and{" "}
              {countryName}&rsquo;s median publishes.
            </p>
          </div>
        )}

        {progress?.published && (
          <p className="mx-auto mt-4 max-w-[42ch] text-sm text-ink-2">
            {countryName}&rsquo;s figures are published, and yours makes them sharper. It joins{" "}
            {count(progress.responses - 1)} others.
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={share}
            className={cx(
              "inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3",
              "font-display text-base font-semibold text-on-accent",
              "transition-[background-color,transform] hover:bg-accent-hover hover:-translate-y-px",
            )}
          >
            {shared === "copied" ? "Copied — go paste it" : "Ask someone else"}
          </button>
          <Button href="/data" variant="ghost" size="base" arrow>
            See the data
          </Button>
        </div>

        <p aria-live="polite" className="mt-3 min-h-4 text-xs text-ink-3">
          {shared === "copied" ? "The message and link are on your clipboard." : ""}
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface p-6">
        <SubscribeForm />
      </div>

      {/* The warning that matters was shown before submitting, where it could
          still change a decision. Here it is a reminder, not the headline. */}
      <p className="text-xs leading-relaxed text-ink-3">
        Nothing connects your answers to you, which is also why we cannot take one particular
        response back out later — we would have no way to tell which one was yours.
      </p>
    </div>
  );
}

function ordinalShort(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  const last = n % 10;
  return `${n}${last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th"}`;
}
