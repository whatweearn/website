"use client";

import type { ReactNode } from "react";

import { cx } from "../ui";

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
 */
export function Choice({
  name,
  label,
  hint,
  value,
  onChange,
  options,
  columns = false,
  hideLabel = false,
}: {
  name: string;
  label: string;
  hint?: string;
  value?: string;
  onChange: (value: string) => void;
  options: readonly Option[];
  columns?: boolean;
  hideLabel?: boolean;
}) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className={cx("mb-2 text-xs font-semibold text-ink", hideLabel && "sr-only")}>
        {label}
      </legend>
      {hint && !hideLabel && <p className="mb-2 max-w-[52ch] text-xs text-ink-3">{hint}</p>}
      <div className={cx("grid gap-2", columns && "sm:grid-cols-2")}>
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={cx(
              "flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors",
              selected
                ? "border-coral bg-wash"
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
              className="mt-1 size-4 shrink-0 accent-[var(--wwe-coral)]"
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
    <select
      id={name}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full max-w-sm rounded-md border border-line bg-surface px-4 py-3 text-base text-ink transition-colors hover:border-line-2"
    >
      <option value="">Choose…</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
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
    <span className="inline-flex items-center gap-3">
      <input
        id={name}
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="figure-num w-32 rounded-md border border-line bg-surface px-4 py-3 text-base text-ink transition-colors hover:border-line-2"
      />
      {suffix && <span className="text-xs text-ink-3">{suffix}</span>}
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
    <span className="inline-flex flex-wrap items-center gap-3">
      <input
        id={name}
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        step={100}
        placeholder="0"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="figure-num w-48 rounded-md border border-line bg-surface px-4 py-3 text-lg text-ink transition-colors hover:border-line-2"
      />
      {onCurrencyChange ? (
        <select
          aria-label="Currency"
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-3 text-base text-ink transition-colors hover:border-line-2"
        >
          {currencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-ink-3">{currency}</span>
      )}

      {periods && onPeriodChange ? (
        <select
          aria-label="Pay period"
          value={period}
          onChange={(e) => onPeriodChange(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-3 text-base text-ink transition-colors hover:border-line-2"
        >
          {periods.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-ink-3">gross, per year</span>
      )}
    </span>
  );
}
