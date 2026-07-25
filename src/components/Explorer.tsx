"use client";

import { useState } from "react";

import { count, euro } from "@/lib/format";
import { type SiteStats, findCut } from "@/lib/stats";
import { COUNTRIES, LEVELS } from "@/lib/survey/options";
import { COUNTRY_PUBLISH_MIN, responsesUntilPublish } from "@/lib/thresholds";

import { DistributionCard } from "./DistributionCard";
import { Button } from "./ui";

const ANY = "*";

export function Explorer({ stats }: { stats: SiteStats }) {
  const [country, setCountry] = useState(ANY);
  const [level, setLevel] = useState(ANY);

  const cut = findCut(stats, country === ANY ? null : country, level === ANY ? null : level);
  const responses = cut?.responses ?? 0;
  const published = cut?.median !== null && cut?.median !== undefined;

  const countryName = COUNTRIES.find((c) => c.code === country)?.name ?? "Europe";
  const levelName = LEVELS.find((l) => l.value === level)?.label.toLowerCase() ?? "all levels";
  const describing = `${levelName === "all levels" ? "engineers" : `${levelName} engineers`} in ${countryName}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-2 text-xs font-semibold text-ink">
          Country
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-md border border-line bg-surface px-4 py-3 text-base font-normal text-ink transition-colors hover:border-line-2"
          >
            <option value={ANY}>All of Europe</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-xs font-semibold text-ink">
          Level
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-md border border-line bg-surface px-4 py-3 text-base font-normal text-ink transition-colors hover:border-line-2"
          >
            <option value={ANY}>All levels</option>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
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
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-2">
            Total compensation for {describing}, from {count(cut.responses)} responses. Employees
            on standard contracts only — B2B and freelance gross is not comparable, and
            part-time is not scaled up.
          </p>
          {cut.distribution && <DistributionCard distribution={cut.distribution} />}
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
              : `${count(responses)} ${describing} have answered — ${responsesUntilPublish(responses)} more and this publishes. We hold figures back below ${COUNTRY_PUBLISH_MIN} rather than print a median that could be wrong by thousands.`}
          </p>
          <Button href="/survey" size="sm" arrow className="mt-6">
            Add yours
          </Button>
        </div>
      )}
    </div>
  );
}
