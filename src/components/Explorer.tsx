"use client";

import { useState } from "react";

import { count, euro } from "@/lib/format";
import {
  POPULATIONS,
  POPULATION_LABELS,
  type Population,
  type SiteStats,
  findCut,
  populationCounts,
} from "@/lib/stats";
import { COUNTRIES, LEVELS } from "@/lib/survey/options";
import { publishMinFor, untilPublish } from "@/lib/thresholds";

import { DistributionCard } from "./DistributionCard";
import { Button, SELECT_CONTROL, cx } from "./ui";

const ANY = "*";

/**
 * The data explorer.
 *
 * It opens with no population chosen, and that is the deliberate part. There
 * used to be a headline — employees on full-time standard contracts — and
 * everyone else was a footnote further down the page, which told half the
 * people who answer this survey that they were the exception. Making the
 * choice explicit costs one click and removes the hierarchy: employees,
 * part-timers and contractors are three questions the same data answers, in
 * three different units, and none of them is the default.
 */
export function Explorer({ stats }: { stats: SiteStats }) {
  const [population, setPopulation] = useState<Population | null>(null);
  const [country, setCountry] = useState(ANY);
  const [level, setLevel] = useState(ANY);

  if (population === null) {
    return <PopulationChoice stats={stats} onChoose={setPopulation} />;
  }

  const words = POPULATION_LABELS[population];
  const cut = findCut(
    stats,
    population,
    country === ANY ? null : country,
    level === ANY ? null : level,
  );
  const responses = cut?.responses ?? 0;
  const published = cut?.median !== null && cut?.median !== undefined;

  const countryName = COUNTRIES.find((c) => c.code === country)?.name ?? "Europe";
  const levelName = LEVELS.find((l) => l.value === level)?.label.toLowerCase() ?? "all levels";
  const who =
    population === "contractor"
      ? levelName === "all levels"
        ? "contractors"
        : `${levelName} contractors`
      : levelName === "all levels"
        ? `${population === "part_time" ? "part-time " : ""}engineers`
        : `${levelName} ${population === "part_time" ? "part-time " : ""}engineers`;
  const describing = `${who} in ${countryName}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end gap-4">
        {/* The label wraps the select, so the control is named implicitly.
            The span sits inside that wrapping so `.comp-select` positions its
            chevron against the select rather than the label's text above it. */}
        <label className="flex flex-col gap-2 text-xs font-semibold text-ink">
          Who
          <span className="comp-select inline-block">
            <select
              value={population}
              onChange={(e) => setPopulation(e.target.value as Population)}
              className={cx(SELECT_CONTROL, "w-full font-normal")}
            >
              {POPULATIONS.map((p) => (
                <option key={p} value={p}>
                  {POPULATION_LABELS[p].long}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className="flex flex-col gap-2 text-xs font-semibold text-ink">
          Country
          <span className="comp-select inline-block">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={cx(SELECT_CONTROL, "w-full font-normal")}
            >
              <option value={ANY}>All of Europe</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className="flex flex-col gap-2 text-xs font-semibold text-ink">
          Level
          <span className="comp-select inline-block">
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className={cx(SELECT_CONTROL, "w-full font-normal")}
            >
              <option value={ANY}>All levels</option>
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>

      {published && cut ? (
        <>
          <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
            {(
              [
                ["Median", cut.median],
                ["Lower quartile", cut.p25],
                ["Upper quartile", cut.p75],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="bg-surface p-5">
                <span className="block text-xs text-ink-3">{label}</span>
                <span className="figure-num mt-2 block text-xl font-semibold tracking-[-0.03em]">
                  {value === null ? "—" : euro(value)}
                  <small className="ml-1 text-xs font-normal text-ink-3">{words.unit}</small>
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-2">
            {population === "contractor" ? (
              <>
                Day rates quoted by {describing}, from {count(cut.responses)} answers. A rate
                given per year or per hour is converted at a standard 220-day year and 8-hour
                day, never at the days somebody happened to bill, so this is a price rather than
                a measure of how much they worked.
              </>
            ) : population === "part_time" ? (
              <>
                Total compensation for {describing}, from {count(cut.responses)} answers, as
                actually paid. Never scaled up to full time, because that would invent a salary
                nobody receives.
              </>
            ) : (
              <>
                Total compensation for {describing}, from {count(cut.responses)} answers.
                Full-time employment contracts only, so nothing here carries the social
                contributions a contractor pays out of their own gross.
              </>
            )}
          </p>
          {cut.distribution && (
            <DistributionCard distribution={cut.distribution} unit={words.unit} />
          )}
        </>
      ) : (
        /* Thin cuts say how thin, and what would fix it. "No data" is a dead
           end; "nine more" is an invitation. */
        <div className="rounded-lg border border-dashed border-line-2 bg-surface p-8 text-center">
          <p className="font-display text-lg font-semibold">
            {responses === 0 ? "Nobody here yet." : "Not enough answers here yet."}
          </p>
          <p className="mx-auto mt-3 max-w-[46ch] text-xs leading-relaxed text-ink-2">
            {responses === 0
              ? `No ${describing} have answered. Yours would be the first.`
              : `${count(responses)} ${describing} have answered — ${untilPublish(population, responses)} more and this publishes. We hold figures back below ${publishMinFor(population)} rather than print a median that could be wrong by thousands.`}
          </p>
          <Button href="/survey" size="sm" arrow className="mt-6">
            Add yours
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The opening question, and the only screen with no default answer.
 *
 * Each option carries its own response count, so the page states plainly how
 * much data stands behind each population rather than implying they are equal.
 */
function PopulationChoice({
  stats,
  onChoose,
}: {
  stats: SiteStats;
  onChoose: (population: Population) => void;
}) {
  const counts = populationCounts(stats);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">
        Three groups, three different numbers. Employee pay and contractor rates are not the
        same quantity, so they are never averaged together. Which do you want?
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {POPULATIONS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChoose(p)}
            // `translate`, not `transform` — see the note on BUTTON_BASE in ui.tsx.
            className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-5 text-left transition-[translate,box-shadow,border-color] duration-200 hover:-translate-y-[2px] hover:border-line-2 hover:shadow-md"
          >
            <span className="font-display text-lg font-semibold">
              {POPULATION_LABELS[p].long}
            </span>
            <span className="text-xs text-ink-3">
              {counts[p] === 0
                ? "No answers yet"
                : `${count(counts[p])} ${counts[p] === 1 ? "answer" : "answers"}, in euro ${POPULATION_LABELS[p].unit}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
