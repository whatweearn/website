"use client";

import type { ReactNode } from "react";

import { SELECT_CONTROL, SHELL, cx } from "../ui";

/**
 * Label plus optional hint for a single control.
 *
 * `htmlFor` is not optional in practice: without it the control has no
 * accessible name, which is invisible until someone uses a screen reader —
 * or until an end-to-end test cannot find the field either.
 */
export function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-ink">
        {label}
        {required && (
          <span className="ml-1 text-accent" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && (
        <span id={hintId} className="max-w-[52ch] text-xs text-ink-3">
          {hint}
        </span>
      )}
      {children}
    </div>
  );
}

type Option = { value: string; label: string; hint?: string };

/**
 * Radio group styled as cards.
 *
 * Native radios under the hood — arrow-key navigation, form semantics and
 * screen-reader grouping all come free, and a div-based version would have to
 * reimplement them badly.
 *
 * `compact` sizes the cards to their content instead of the column. A card
 * holding "12" or "Yes" stretched to the full width reads as an empty slab
 * rather than a choice; one holding a label and a description earns it.
 */
export function Choice({
  name,
  label,
  hint,
  value,
  onChange,
  options,
  columns = false,
  compact = false,
  hideLabel = false,
}: {
  name: string;
  label: string;
  hint?: string;
  value?: string;
  onChange: (value: string) => void;
  options: readonly Option[];
  columns?: boolean;
  compact?: boolean;
  hideLabel?: boolean;
}) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className={cx("mb-2 text-xs font-semibold text-ink", hideLabel && "sr-only")}>
        {label}
      </legend>
      {hint && !hideLabel && <p className="mb-2 max-w-[52ch] text-xs text-ink-3">{hint}</p>}
      <div
        className={cx(
          "gap-2",
          compact ? "flex flex-wrap" : cx("grid", columns && "sm:grid-cols-2"),
        )}
      >
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={cx(
              "flex cursor-pointer rounded-md border px-4 py-3 transition-colors",
              compact ? "items-center gap-2.5" : "items-start gap-3",
              // The focus ring belongs on the card, not on the 16px radio
              // inside it. Keyboard users were being shown a dot while the
              // thing they were choosing gave no signal at all.
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-coral",
              // A 1px border alone is a weak scan target in a stack of eight.
              // The ring doubles the edge without moving anything.
              selected
                ? "border-coral bg-wash ring-1 ring-coral hover:border-accent hover:ring-accent"
                : "border-line bg-surface hover:border-line-2 hover:bg-tint",
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              // Outline suppressed only because the card above draws a larger
              // one in its place — never removed outright.
              className={cx("comp-radio focus-visible:outline-none", !compact && "mt-0.5")}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-ink">{option.label}</span>
              {option.hint && <span className="text-xs text-ink-3">{option.hint}</span>}
            </span>
          </label>
        );
      })}
      </div>
    </fieldset>
  );
}

export function Select({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly Option[];
}) {
  return (
    <span className="comp-select block w-full max-w-sm">
      <select
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(SELECT_CONTROL, "w-full")}
      >
        <option value="">Choose…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  );
}

export function NumberField({
  name,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  name: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
  suffix?: string;
}) {
  return (
    // The unit is part of the answer, so it sits inside the control for the
    // same reason the currency does — "100" floating next to loose grey text
    // reads as two things rather than one.
    <span className={cx(SHELL, "inline-flex w-fit max-w-full items-stretch")}>
      <input
        id={name}
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className={cx(
          "figure-num comp-number w-28 bg-transparent px-4 py-3 text-base text-ink",
          suffix ? "rounded-l-md" : "rounded-md",
        )}
      />
      {suffix && (
        <span className="flex items-center rounded-r-md border-l border-line px-4 py-3 text-xs text-ink-3">
          {suffix}
        </span>
      )}
    </span>
  );
}

/**
 * Amount plus currency.
 *
 * The two belong together: an amount without its currency is meaningless, and
 * splitting them across screens is how people end up reporting złoty as euro.
 */
export function MoneyField({
  name,
  label,
  value,
  onChange,
  currency,
  onCurrencyChange,
  currencies,
  period,
  onPeriodChange,
  periods,
}: {
  name: string;
  /**
   * The amount's accessible name. Required, and not optional by accident: this
   * field's only name used to be its `placeholder="0"`, which axe accepts and
   * which quietly disappeared the moment the placeholder was dropped for
   * looking like a real value. A screen reader now hears the question rather
   * than "edit text".
   */
  label: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  currency: string;
  onCurrencyChange?: (value: string) => void;
  currencies: readonly string[];
  /** When supplied, the amount is quoted per this period rather than per year. */
  period?: string;
  onPeriodChange?: (value: string) => void;
  periods?: readonly { value: string; label: string }[];
}) {
  return (
    // One bordered unit rather than three loose boxes: "5200 EUR a month" is a
    // single answer, and three controls at three type sizes read as three
    // unrelated widgets.
    //
    // It stacks below `sm` rather than wrapping. Wrapping left the segment
    // dividers stranded in whitespace at the end of each row; stacking turns
    // them into full-width rules, which is what a narrow screen wants anyway.
    // `w-fit` stops the surrounding flex column stretching the group and
    // undoing the point of grouping it.
    <span className={cx(SHELL, "grid w-fit max-w-full sm:flex sm:items-stretch")}>
      {/* Absolutely positioned by `sr-only`, so it is out of flow and adds no
          row to the group. */}
      <label htmlFor={name} className="sr-only">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        step={100}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className={cx(
          "figure-num comp-number bg-transparent px-4 py-3 text-lg text-ink",
          "w-full rounded-t-md sm:w-40 sm:rounded-t-none sm:rounded-l-md",
        )}
      />

      {onCurrencyChange ? (
        <Segment
          label="Currency"
          value={currency}
          onChange={onCurrencyChange}
          options={currencies.map((code) => ({ value: code, label: code }))}
        />
      ) : (
        <Note>{currency}</Note>
      )}

      {periods && onPeriodChange ? (
        <Segment
          label="Pay period"
          value={period ?? ""}
          onChange={onPeriodChange}
          options={periods}
          last
        />
      ) : (
        <Note last>gross, per year</Note>
      )}
    </span>
  );
}

/**
 * Divides one segment from the next: a rule above it when stacked, a rule
 * beside it when the group is laid out in a row.
 */
const SEGMENT_EDGE = "border-t border-line sm:border-t-0 sm:border-l";

function segmentRadius(last: boolean): string {
  return last ? "rounded-b-md sm:rounded-b-none sm:rounded-r-md" : "";
}

/** A select that lives inside the money group, so it carries no border of its own. */
function Segment({
  label,
  value,
  onChange,
  options,
  last = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  last?: boolean;
}) {
  const round = segmentRadius(last);
  return (
    // `grid` so the select stretches to the segment when stacked, which keeps
    // the chevron pinned to the right edge rather than floating mid-row.
    <span className={cx("comp-select grid", SEGMENT_EDGE, round)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          "cursor-pointer appearance-none bg-transparent py-3 pr-9 pl-4 text-base text-ink",
          round,
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  );
}

/** The fixed half of the group — a currency or period the survey already knows. */
function Note({ children, last = false }: { children: ReactNode; last?: boolean }) {
  return (
    <span
      className={cx(
        "flex items-center px-4 py-3 text-xs text-ink-3",
        SEGMENT_EDGE,
        segmentRadius(last),
      )}
    >
      {children}
    </span>
  );
}
