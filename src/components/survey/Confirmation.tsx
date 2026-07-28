"use client";

import { useEffect, useState } from "react";

import { Share } from "@/components/Share";
import { count, ordinal, withArticle } from "@/lib/format";
import { gapMessage } from "@/lib/share";
import { COUNTRIES } from "@/lib/survey/options";
import { standingOf, trackOf, type Answered, type Standing } from "@/lib/survey/standing";

import { SubscribeForm } from "../SubscribeForm";
import { Button } from "../ui";

/**
 * The screen after submitting.
 *
 * This is the only moment where somebody has just spent two minutes on the
 * survey and feels good about it, and the project's hardest problem is that
 * nothing publishes until a country reaches sixty responses. So the screen's
 * job is not to thank people. It is to convert that goodwill into the next
 * response, and the only lever that does that is the person on this page
 * telling someone else.
 *
 * The order is deliberate: acknowledgement, then the gap, then the share, and
 * everything else below it. The email form used to sit directly under the
 * thanks; it now sits under the share, because a subscriber is worth one
 * reader later and a forward is worth a response now.
 */

type Progress = {
  country: string;
  responses: number;
  remaining: number;
  published: boolean;
  dayRates: number;
  dayRatesRemaining: number;
  dayRatesPublished: boolean;
};

export function Confirmation({ country, answer }: { country?: string; answer?: Answered }) {
  const [progress, setProgress] = useState<Progress | null>(null);

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
  // "engineer from United Kingdom" was reading as machine-written on two of
  // the twenty-nine countries. Article added everywhere the name appears in a
  // sentence, which is everywhere it appears on this screen.
  const named = withArticle(countryName);

  const message = progress
    ? gapMessage(countryName, progress.remaining, progress.published)
    : gapMessage("Europe", 0, true);

  // What this particular answer did, which is not always "joined the median".
  // Without an answer to judge — only reachable if the wizard stops passing
  // one — the screen says nothing personal rather than guessing.
  const standing = answer && progress ? standingOf(answer, progress.responses) : null;
  const onDayRates = standing !== null && trackOf(standing) === "day-rate";
  const track =
    progress && onDayRates
      ? {
          done: progress.dayRates,
          remaining: progress.dayRatesRemaining,
          published: progress.dayRatesPublished,
        }
      : progress && {
          done: progress.responses,
          remaining: progress.remaining,
          published: progress.published,
        };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-line bg-surface p-8 text-center shadow-lg">
        <h2 className="text-xl">That&rsquo;s in.</h2>

        {progress && track && (
          <div className="mx-auto mt-6 max-w-sm">
            <Placement standing={standing} named={named} />

            {track.published ? (
              <p className="mx-auto mt-4 max-w-[42ch] text-sm text-ink-2">
                {onDayRates ? (
                  <>
                    {named}&rsquo;s contractor day rates are published, and yours makes them
                    sharper. It joins {count(Math.max(0, track.done - 1))} others.
                  </>
                ) : standing === null || standing.kind === "position" || standing.kind === "counted" ? (
                  <>
                    {named}&rsquo;s figures are published, and yours makes them sharper. It joins{" "}
                    {count(Math.max(0, track.done - 1))} others.
                  </>
                ) : (
                  <>
                    {named}&rsquo;s figures are published, from {count(track.done)} full-time
                    employees.
                  </>
                )}
              </p>
            ) : (
              <>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-track"
                  role="img"
                  aria-label={
                    onDayRates
                      ? `${track.done} of the day rates ${named} needs`
                      : `${track.done} of the responses ${named} needs`
                  }
                >
                  <div
                    className="h-full rounded-full bg-coral transition-[width] duration-700"
                    style={{
                      width: `${Math.min(100, (track.done / Math.max(1, track.done + track.remaining)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-3 text-xs text-ink-2">
                  <b className="font-semibold text-ink">{count(track.remaining)} more</b>
                  {onDayRates ? (
                    <> and {named}&rsquo;s contractor day rates publish.</>
                  ) : (
                    <> and {named}&rsquo;s median publishes.</>
                  )}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Deliberately the largest thing on the page. Nothing else here changes
          the outcome of this project; this does. */}
      <Share
        prominent
        message={message}
        headline={
          progress && !progress.published ? (
            <>
              Now the part that actually decides whether {named} ever publishes.
            </>
          ) : (
            <>Now pass it on.</>
          )
        }
        blurb={
          progress && !progress.published ? (
            <>
              You are not asking anyone for a favour. Everyone you send it to gets the same two
              minutes and the same answer you just bought yourself, and those{" "}
              {count(progress.remaining)} responses arrive that way or not at all. One team
              channel or one group chat is genuinely most of the way there.
            </>
          ) : (
            <>
              Everyone you send it to gets what you just got, for the same two minutes, and
              every extra answer narrows the figures all of you negotiate against. One team
              channel does more for that than anything else in the next thirty seconds.
            </>
          )
        }
      />

      <div className="rounded-lg border border-line bg-surface p-6">
        <SubscribeForm />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button href="/data" variant="ghost" size="sm" arrow>
          See the data
        </Button>
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

/**
 * Where this answer landed, in one sentence.
 *
 * "You're the 4th engineer from Italy" is the line worth having, and it is
 * only true for an answer that is actually in that count. The other branches
 * exist because the alternative was telling a contractor they were the 0th
 * engineer from their country: their answer is deliberately kept out of the
 * employee median, so the count never moved for them. Saying which median an
 * answer does reach is both true and more use than an ordinal.
 */
function Placement({ standing, named }: { standing: Standing | null; named: string }) {
  if (standing === null || standing.kind === "counted") return null;

  if (standing.kind === "position") {
    return (
      <p className="text-sm text-ink-2">
        You&rsquo;re the{" "}
        <b className="figure-num font-semibold text-ink">{ordinal(standing.position)}</b> engineer
        from {named}.
      </p>
    );
  }

  return (
    <p className="mx-auto max-w-[46ch] text-sm text-ink-2">
      {standing.kind === "day-rate" ? (
        <>
          Your rate counts towards {named}&rsquo;s contractor day rates, not its employee median.
          Contractor gross carries the contributions an employer would otherwise pay, so the two
          are not the same number.
        </>
      ) : standing.kind === "part-time" ? (
        <>
          Your answer is in the dataset and the download. It stays out of {named}&rsquo;s median,
          which covers full-time contracts only, because scaling a part-time salary up to full time
          invents a figure nobody is paid.
        </>
      ) : (
        <>
          Your answer is in the dataset and the download. It stays out of {named}&rsquo;s median,
          which covers employees only, because your gross carries contributions an employer would
          otherwise pay and averaging the two describes nobody.
        </>
      )}
    </p>
  );
}
