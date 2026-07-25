"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  COMPANY_SIZES,
  COMPANY_STAGES,
  CONTRACT_TYPES,
  COUNTRIES,
  CURRENCIES,
  DISCIPLINES,
  INDUSTRIES,
  LANGUAGES,
  LEVELS,
  PAYMENTS_PER_YEAR,
  SALARY_PERIODS,
  WORK_SETUPS,
  citiesFor,
  type CountryCode,
} from "@/lib/survey/options";
import { checkSalary } from "@/lib/survey/plausibility";
import { submittableResponseSchema } from "@/lib/survey/schema";

import { cx } from "../ui";
import { Choice, Field, MoneyField, NumberField, Select } from "./controls";
import {
  STEP_KEY,
  answersOf,
  clearDraft,
  getDraft,
  getServerDraft,
  seedDraft,
  setDraftValue,
  subscribeToDraft,
} from "./draftStore";
import { Confirmation } from "./Confirmation";
import { Turnstile } from "./Turnstile";

const TOTAL_STEPS = 9;

/** Which screen asks for each answer, so a rejection can navigate there. */
const STEP_OF_FIELD: Record<string, number> = {
  country: 0,
  city: 0,
  workSetup: 1,
  payLocationAdjusted: 1,
  contractType: 2,
  ftePercent: 2,
  discipline: 3,
  primaryLanguage: 3,
  level: 4,
  yearsExperience: 4,
  baseSalary: 5,
  currency: 5,
  paymentsPerYear: 5,
  bonus: 6,
  equityAnnual: 7,
  companyStage: 7,
  companySize: 8,
  industry: 8,
};

export function SurveyWizard({
  formToken,
  turnstileSiteKey,
  initialCountry,
  initialLevel,
}: {
  formToken: string;
  turnstileSiteKey?: string;
  initialCountry?: string;
  initialLevel?: string;
}) {
  // Pre-filled from the landing page's segmenter links, so someone who has
  // already told us where they are does not answer it twice.
  const prefilled = Number(Boolean(initialCountry)) + Number(Boolean(initialLevel));
  const draft = useSyncExternalStore(subscribeToDraft, getDraft, getServerDraft);
  const savedStep = draft[STEP_KEY];
  const step =
    typeof savedStep === "number" && savedStep >= 0 && savedStep < TOTAL_STEPS
      ? savedStep
      : prefilled === 2
        ? 1
        : 0;
  const [status, setStatus] = useState<"editing" | "sending" | "done" | "error">("editing");
  // Captured before the draft is cleared: the confirmation screen needs it to
  // show how close that country is to publishing.
  const [submittedCountry, setSubmittedCountry] = useState<string>();
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [error, setError] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    seedDraft({
      ...(initialCountry ? { country: initialCountry } : {}),
      ...(initialLevel ? { level: initialLevel } : {}),
    });
  }, [initialCountry, initialLevel]);

  // Restores where they were, not just what they answered. Losing your place
  // eight questions in is its own reason to abandon a survey.
  const goTo = useCallback((next: number) => setDraftValue(STEP_KEY, next), []);
  const set = useCallback((key: string, value: unknown) => setDraftValue(key, value), []);

  // Move focus to the new question so keyboard and screen-reader users are not
  // left at the bottom of the page after advancing.
  useEffect(() => {
    if (status === "editing") headingRef.current?.focus();
  }, [step, status]);

  const country = (draft.country as CountryCode | undefined) ?? undefined;

  // The currency select shows the country's currency as its default. That
  // default has to be a real answer too — otherwise someone who accepts it
  // sails through nine screens and is refused at Submit for a field they were
  // shown as already filled in.
  const currency = (draft.currency as string | undefined) ?? defaultCurrency(country);

  // Defaults to a yearly figure: what most employees will answer, and what the
  // survey asked for before periods existed.
  const salaryPeriod = (draft.salaryPeriod as string | undefined) ?? "year";

  // Checked as they type. Catching a mistyped figure on the screen that asks
  // for it is worth far more than refusing the whole survey eight questions
  // later, when they have already stopped thinking about the number.
  const salaryCheck =
    typeof draft.baseSalary === "number"
      ? checkSalary({
          baseSalary: draft.baseSalary,
          salaryPeriod: salaryPeriod as never,
          paymentsPerYear: draft.paymentsPerYear as number | undefined,
          daysPerYear: draft.daysPerYear as number | undefined,
          hoursPerYear: draft.hoursPerYear as number | undefined,
          currency,
        })
      : null;

  async function submit() {
    setStatus("sending");
    setError(undefined);

    const parsed = submittableResponseSchema.safeParse({ ...answersOf(draft), currency });
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? "");
      const target = STEP_OF_FIELD[field];
      setStatus("error");
      setError(
        target === undefined
          ? "Something in your answers could not be accepted. Please check and try again."
          : `We still need one answer from question ${target + 1}.`,
      );
      // Take them there rather than telling them to find it.
      if (target !== undefined) goTo(target);
      return;
    }

    try {
      const res = await fetch("/api/response", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          response: parsed.data,
          formToken,
          turnstileToken,
          website: "",
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus("error");
        setError(body?.error ?? "Something went wrong sending your answers. Please try again.");
        return;
      }

      setSubmittedCountry(parsed.data.country);
      clearDraft();
      setStatus("done");
    } catch {
      setStatus("error");
      setError("We could not reach the server. Check your connection and try again.");
    }
  }

  if (status === "done") {
    return <Confirmation country={submittedCountry} />;
  }

  const steps = [
    {
      title: "Where do you work?",
      body: (
        <>
          <Field label="Country" htmlFor="country" required>
            <Select
              name="country"
              value={(draft.country as string) ?? ""}
              onChange={(v) => {
                set("country", v);
                set("city", undefined);
              }}
              options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
            />
          </Field>
          {country && (
            <Field label="City" htmlFor="city" hint="Pick the nearest — pay varies a lot within a country.">
              <Select
                name="city"
                value={(draft.city as string) ?? ""}
                onChange={(v) => set("city", v)}
                options={citiesFor(country).map((c) => ({ value: c, label: c }))}
              />
            </Field>
          )}
        </>
      ),
      complete: Boolean(draft.country),
    },
    {
      title: "How do you work?",
      body: (
        <>
          <Choice
            name="workSetup"
            label="Where do you work from?"
            value={draft.workSetup as string}
            onChange={(v) => set("workSetup", v)}
            options={WORK_SETUPS}
          />
          <Choice
              name="payLocationAdjusted"
              label="Is your pay adjusted for where you live?"
              value={
                draft.payLocationAdjusted === undefined
                  ? undefined
                  : draft.payLocationAdjusted
                    ? "yes"
                    : "no"
              }
              onChange={(v) => set("payLocationAdjusted", v === "yes")}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
            />
        </>
      ),
      complete: true,
    },
    {
      title: "What kind of contract?",
      hint: "This matters more than it looks: B2B and freelance gross figures are not comparable with employed ones.",
      body: (
        <>
          <Choice
            name="contractType"
            label="Contract type"
            value={draft.contractType as string}
            onChange={(v) => set("contractType", v)}
            options={CONTRACT_TYPES}
          />
          <Field label="Hours" htmlFor="ftePercent" hint="Leave at 100 for full time.">
            <NumberField
              name="ftePercent"
              value={draft.ftePercent as number}
              onChange={(v) => set("ftePercent", v)}
              min={10}
              max={100}
              suffix="% of full time"
            />
          </Field>
        </>
      ),
      complete: Boolean(draft.contractType),
    },
    {
      title: "What do you work on?",
      body: (
        <>
          <Choice
            name="discipline"
            label="Discipline"
            value={draft.discipline as string}
            onChange={(v) => set("discipline", v)}
            options={DISCIPLINES}
            columns
          />
          <Field label="Main language" htmlFor="primaryLanguage">
            <Select
              name="primaryLanguage"
              value={(draft.primaryLanguage as string) ?? ""}
              onChange={(v) => set("primaryLanguage", v)}
              options={LANGUAGES.map((l) => ({ value: l, label: l }))}
            />
          </Field>
        </>
      ),
      complete: true,
    },
    {
      title: "How senior are you?",
      hint: "Pick by what you do, not by your title — titles are not comparable between companies.",
      body: (
        <>
          <Choice
            name="level"
            label="Level"
            value={draft.level as string}
            onChange={(v) => set("level", v)}
            options={LEVELS}
          />
          <Field label="Years writing software professionally" htmlFor="yearsExperience">
            <NumberField
              name="yearsExperience"
              value={draft.yearsExperience as number}
              onChange={(v) => set("yearsExperience", v)}
              min={0}
              max={60}
              suffix="years"
            />
          </Field>
        </>
      ),
      complete: Boolean(draft.level),
    },
    {
      title: "What is your base salary?",
      hint: "Gross, before tax. Quote it however you normally think about it.",
      body: (
        <>
          <MoneyField
            name="baseSalary"
            value={draft.baseSalary as number}
            onChange={(v) => set("baseSalary", v)}
            currency={currency}
            onCurrencyChange={(v) => set("currency", v)}
            currencies={CURRENCIES}
            period={salaryPeriod}
            onPeriodChange={(v) => set("salaryPeriod", v)}
            periods={SALARY_PERIODS}
          />

          {/* The follow-up appears only when the period needs one, so an
              employee on an annual salary sees exactly what they saw before,
              and a freelancer is never asked to do the arithmetic. */}
          {salaryCheck?.message && (
            <p
              role="status"
              className={cx(
                "max-w-[52ch] rounded-md px-4 py-3 text-xs leading-relaxed",
                salaryCheck.verdict === "impossible"
                  ? "bg-wash text-accent"
                  : "bg-tint text-ink-2",
              )}
            >
              {salaryCheck.message}
            </p>
          )}

          {salaryPeriod === "month" && (
            <Choice
              name="paymentsPerYear"
              label="Payments per year"
              hint="Spain, Portugal, Italy, Austria and Greece often pay 13 or 14."
              value={draft.paymentsPerYear ? String(draft.paymentsPerYear) : undefined}
              onChange={(v) => set("paymentsPerYear", Number(v))}
              options={PAYMENTS_PER_YEAR.map((p) => ({ value: String(p), label: String(p) }))}
            />
          )}

          {salaryPeriod === "day" && (
            <Field
              label="Days you billed last year"
              htmlFor="daysPerYear"
              hint="Actual billed days, not a target — we multiply by this rather than guess a working year."
              required
            >
              <NumberField
                name="daysPerYear"
                value={draft.daysPerYear as number}
                onChange={(v) => set("daysPerYear", v)}
                min={1}
                max={365}
                suffix="days"
              />
            </Field>
          )}

          {salaryPeriod === "hour" && (
            <Field
              label="Hours you billed last year"
              htmlFor="hoursPerYear"
              hint="Actual billed hours. Around 1,600 is a full year at 40 hours a week with holidays."
              required
            >
              <NumberField
                name="hoursPerYear"
                value={draft.hoursPerYear as number}
                onChange={(v) => set("hoursPerYear", v)}
                min={1}
                max={4000}
                suffix="hours"
              />
            </Field>
          )}
        </>
      ),
      complete:
        typeof draft.baseSalary === "number" &&
        Boolean(currency) &&
        salaryCheck?.verdict !== "impossible" &&
        (salaryPeriod === "year" ||
          (salaryPeriod === "month" && draft.paymentsPerYear != null) ||
          (salaryPeriod === "day" && draft.daysPerYear != null) ||
          (salaryPeriod === "hour" && draft.hoursPerYear != null)),
    },
    {
      title: "Any bonus?",
      hint: "What was actually paid in the last twelve months, not what was on target.",
      body: (
        <MoneyField
          name="bonus"
          value={draft.bonus as number}
          onChange={(v) => set("bonus", v)}
          currency={currency}
          currencies={CURRENCIES}
        />
      ),
      complete: true,
    },
    {
      title: "Any equity?",
      hint: "Annualised value. Skip if none — most people have none, and that is useful to know.",
      body: (
        <>
          <MoneyField
            name="equityAnnual"
            value={draft.equityAnnual as number}
            onChange={(v) => set("equityAnnual", v)}
            currency={currency}
            currencies={CURRENCIES}
          />
          <Choice
              name="companyStage"
              label="Is the company listed?"
              hint="Private-company equity is a notional number."
              value={draft.companyStage as string}
              onChange={(v) => set("companyStage", v)}
              options={COMPANY_STAGES}
            />
        </>
      ),
      complete: true,
    },
    {
      title: "About the company",
      hint: "Size bracket and industry only. We never ask which company.",
      body: (
        <>
          <Choice
              name="companySize"
              label="Company size"
              value={draft.companySize as string}
              onChange={(v) => set("companySize", v)}
              options={COMPANY_SIZES}
            />
          <Field label="Industry" htmlFor="industry">
            <Select
              name="industry"
              value={(draft.industry as string) ?? ""}
              onChange={(v) => set("industry", v)}
              options={INDUSTRIES.map((i) => ({ value: i.value, label: i.label }))}
            />
          </Field>
        </>
      ),
      complete: true,
    },
  ];

  const current = steps[step]!;
  const last = step === TOTAL_STEPS - 1;

  // When Turnstile is configured, wait for its token rather than letting
  // someone submit a finished survey and be told afterwards that we could not
  // verify them. Most people never see the widget; they just wait a moment.
  const awaitingVerification = last && Boolean(turnstileSiteKey) && !turnstileToken;

  return (
    <div>
      <div className="mb-8">
        <div className="mb-2 flex items-baseline justify-between text-xs text-ink-3">
          <span>
            Question {step + 1} of {TOTAL_STEPS}
          </span>
          {prefilled === 2 && step === 1 && <span>Two answered from the last page</span>}
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-track"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-label="Survey progress"
        >
          <div
            className="h-full rounded-full bg-coral transition-[width] duration-300"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      <h2 ref={headingRef} tabIndex={-1} className="text-xl outline-none">
        {current.title}
      </h2>
      {current.hint && <p className="mt-2 max-w-[52ch] text-xs text-ink-2">{current.hint}</p>}

      <div className="mt-6 flex flex-col gap-6">{current.body}</div>

      {/* Honeypot: off-screen, not display:none, so bots that skip hidden
          fields still fill it. Never shown to people, never focusable. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-md bg-wash px-4 py-3 text-xs text-accent">
          {error}
        </p>
      )}

      <div className="mt-10 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => goTo(Math.max(0, step - 1))}
          disabled={step === 0}
          className="rounded-full px-4 py-2 text-xs text-ink-2 transition-colors hover:text-ink disabled:invisible"
        >
          <span aria-hidden="true">←</span> Back
        </button>

        <button
          type="button"
          onClick={() => (last ? submit() : goTo(step + 1))}
          disabled={!current.complete || status === "sending" || awaitingVerification}
          className={cx(
            "inline-flex items-center gap-2 rounded-full px-6 py-3 font-display text-base font-semibold",
            "bg-accent text-on-accent transition-[background-color,transform] hover:bg-accent-hover",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent",
          )}
        >
          {status === "sending"
            ? "Sending…"
            : awaitingVerification
              ? "Checking your browser…"
              : last
                ? "Submit"
                : "Next"}
          {!last && <span aria-hidden="true">→</span>}
        </button>
      </div>

      {turnstileSiteKey && (
        <div className="mt-8">
          <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
        </div>
      )}
    </div>
  );
}

function defaultCurrency(country?: CountryCode): string {
  return COUNTRIES.find((c) => c.code === country)?.currency ?? "EUR";
}
