"use client";

import { useMemo, useState } from "react";

import { count, euro, euroCompact, medianGapPhrase, ordinal, percentilePhrase } from "@/lib/format";
import { type Distribution, percentileAt } from "@/lib/stats";
import { COUNTRY_PUBLISH_MIN } from "@/lib/thresholds";

import { Button, cx } from "./ui";

const AXIS_TICKS = 5;
const STEP = 500;

/** Percent position of a value along the axis, clamped off both edges. */
function positionOf(value: number, d: Distribution): number {
  return Math.min(99, Math.max(1, ((value - d.lo) / (d.hi - d.lo)) * 100));
}

function edgeOf(position: number): "start" | "end" | undefined {
  if (position < 16) return "start";
  if (position > 84) return "end";
  return undefined;
}

function Marker({
  kind,
  position,
  label,
  hidden = false,
}: {
  kind: "median" | "you";
  position: number;
  label: string;
  hidden?: boolean;
}) {
  return (
    <div
      className="plot-mark"
      data-kind={kind}
      data-edge={edgeOf(position)}
      style={{ left: `${position}%`, opacity: hidden ? 0 : 1 }}
    >
      <b>{label}</b>
    </div>
  );
}

/**
 * @param lifted Pulls the card up over the band boundary behind it. Only the
 *   landing page wants that; anywhere else it would ride over the content
 *   above.
 */
function CardShell({ children, lifted }: { children: React.ReactNode; lifted?: boolean }) {
  return (
    <div
      className={cx(
        "rounded-xl border border-line bg-surface p-[clamp(1.25rem,2.6vw,1.9rem)] shadow-lg",
        lifted && "mt-[calc(-1*var(--card-lift))]",
      )}
    >
      {children}
    </div>
  );
}

/**
 * Pre-launch state.
 *
 * There is no distribution because there are no responses. Rather than invent
 * one, the card changes job: it explains what will appear here and why it
 * isn't here yet. Being early is the offer.
 */
function AwaitingData({ lifted }: { lifted?: boolean }) {
  return (
    <CardShell lifted={lifted}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-5">
        <p className="font-display text-lg font-semibold tracking-[-0.02em]">
          Where would you land?
        </p>
        <p className="text-xs text-ink-3">Not enough answers yet</p>
      </div>

      {/* An empty plot frame rather than flat bars: a dashed baseline reads as
          "nothing here yet", where a row of stubs reads as "something broke". */}
      <div className="mt-6 grid h-[clamp(96px,12vw,124px)] place-items-center rounded-md border border-dashed border-line-2">
        <p className="text-xs text-ink-3">No distribution yet</p>
      </div>

      <p className="mt-5 max-w-[48ch] text-xs leading-relaxed text-ink-2">
        {`This is where your salary gets placed against everyone else's. It stays empty until a country clears ${COUNTRY_PUBLISH_MIN} responses — a median over six people isn't a median worth printing, and we'd rather show nothing than something invented.`}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-[1.1rem]">
        <p className="text-xs text-ink-2">Be one of the first.</p>
        <Button href="/survey" variant="ghost" size="sm" arrow>
          Add your number
        </Button>
      </div>
    </CardShell>
  );
}

function Interactive({ distribution, lifted }: { distribution: Distribution; lifted?: boolean }) {
  const [value, setValue] = useState(() => distribution.median);

  const peak = useMemo(
    () => Math.max(...distribution.bins.map((b) => b.count), 1),
    [distribution],
  );

  const percentile = percentileAt(distribution, value);
  const litUpTo = distribution.bins.findIndex((b) => value < b.hi);
  const youPosition = positionOf(value, distribution);
  const medianPosition = positionOf(distribution.median, distribution);

  const ticks = Array.from(
    { length: AXIS_TICKS },
    (_, i) => distribution.lo + ((distribution.hi - distribution.lo) * i) / (AXIS_TICKS - 1),
  );

  return (
    <CardShell lifted={lifted}>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line pb-5">
        <p className="font-display text-lg font-semibold tracking-[-0.02em]">
          Where would you land?
        </p>
        <p className="ml-auto text-xs text-ink-3">
          <span className="figure-num">{count(distribution.n)}</span> responses
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pt-6 pb-2.5">
        <div>
          <span className="mb-[0.45rem] block text-xs text-ink-3">Your total comp</span>
          <span className="figure-num block text-2xl leading-none font-semibold tracking-[-0.04em]">
            {euro(value)}
          </span>
        </div>
        <div className="ml-auto text-right max-[560px]:ml-0 max-[560px]:text-left">
          <span className="mb-[0.45rem] block text-xs text-ink-3">That puts you at</span>
          <span className="figure-num block text-xl leading-none font-semibold tracking-[-0.035em] text-coral">
            {ordinal(percentile)}
          </span>
          <span className="mt-1.5 block text-xs text-ink-2">{percentilePhrase(percentile)}</span>
          <span className="mt-0.5 block text-xs text-ink-3">
            {medianGapPhrase(value, distribution.median)}
          </span>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="relative mt-[2.1rem] flex h-[clamp(112px,15vw,150px)] items-end gap-[3px] max-[560px]:gap-0.5"
      >
        {distribution.bins.map((bin, i) => (
          <div
            key={bin.lo}
            className={cx(
              "min-w-0 flex-1 rounded-t transition-colors duration-150",
              litUpTo === -1 || i <= litUpTo ? "bg-coral" : "bg-track",
            )}
            style={{ height: `${Math.max(3, (bin.count / peak) * 100)}%` }}
          />
        ))}
        <Marker
          kind="median"
          position={medianPosition}
          label={`median ${euro(distribution.median)}`}
        />
        <Marker
          kind="you"
          position={youPosition}
          label="you"
          hidden={Math.abs(youPosition - medianPosition) < 7}
        />
      </div>

      <div className="figure-num mt-[0.7rem] flex justify-between text-2xs text-ink-3">
        {ticks.map((tick) => (
          <span key={tick}>{euroCompact(tick)}</span>
        ))}
      </div>

      <div className="mt-6">
        <label htmlFor="comp" className="mb-[0.35rem] block text-xs text-ink-2">
          Drag to your total comp — gross annual, base plus bonus and equity
        </label>
        <input
          id="comp"
          type="range"
          className="comp-slider"
          min={distribution.lo}
          max={distribution.hi}
          step={STEP}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          aria-valuetext={`${euro(value)}, ${ordinal(percentile)} percentile, ${medianGapPhrase(
            value,
            distribution.median,
          )}`}
        />
      </div>

      <div className="mt-[1.35rem] flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line pt-[1.1rem]">
        <p className="text-xs text-ink-2">
          Based on {count(distribution.n)} responses across Europe.
        </p>
        <Button href="/survey" variant="ghost" size="sm" arrow>
          Add your number
        </Button>
      </div>
    </CardShell>
  );
}

export function DistributionCard({
  distribution,
  lifted,
}: {
  distribution: Distribution | null;
  lifted?: boolean;
}) {
  return distribution ? (
    <Interactive distribution={distribution} lifted={lifted} />
  ) : (
    <AwaitingData lifted={lifted} />
  );
}
