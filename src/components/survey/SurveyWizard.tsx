"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  COMPANY_SIZES,
  COMPANY_STAGES,
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
  contractTypesFor,
  isRemoteSetup,
  type CountryCode,
} from "@/lib/survey/options";
import { STANDARD_BILLED_DAYS, STANDARD_HOURS_PER_DAY } from "@/lib/stats/dayRate";
import { isEmployeeContract } from "@/lib/stats/populations";
import { checkSalary } from "@/lib/survey/plausibility";
import { submittableResponseSchema } from "@/lib/survey/schema";
import type { Answered } from "@/lib/survey/standing";

import { cx } from "../ui";
import { Choice, Field, MoneyField, NumberField, Select } from "./controls";
import {
  FURTHEST_STEP_KEY,
  STEP_KEY,
  type Draft,
  answersOf,
  clearDraft,
  getDraft,
  getServerDraft,
  seedDraft,
  setDraftValue,
  setDraftValues,
  subscribeToDraft,
} from "./draftStore";
import { Confirmation } from "./Confirmation";
import { Turnstile } from "./Turnstile";

/**
 * The screens, by name rather than by number.
 *
 * Positions used to be hard-coded — nine steps, and a map of field to index.
 * They cannot be, now that the survey is shorter for some people: a contractor
 * skips two screens, so "equity is screen 8" is true for an employee and wrong
 * for them. Everything below derives from the list actually being shown.
 */
const STEP_IDS = [
  "where",
  "setup",
  "contract",
  "role",
  "level",
  "pay",
  "bonus",
  "equity",
  "company",
] as const;

type StepId = (typeof STEP_IDS)[number];

/**
 * Screens that ask an employee's question.
 *
 * Nobody invoices themselves a bonus, and equity is not what a client pays a
 * contractor. Neither reaches a contractor's published figure either — that is
 * a day rate, base only — so asking was two screens of questions we then
 * ignored, on half of the people who answer this survey.
 */
const EMPLOYEE_ONLY_STEPS: ReadonlySet<StepId> = new Set(["bonus", "equity"]);

/** Which screen asks for each answer, so a rejection can navigate there. */
const STEP_OF_FIELD: Record<string, StepId> = {
  country: "where",
  city: "where",
  workSetup: "setup",
  payLocationAdjusted: "setup",
  contractType: "contract",
  ftePercent: "contract",
  discipline: "role",
  primaryLanguage: "role",
  level: "level",
  yearsExperience: "level",
  baseSalary: "pay",
  currency: "pay",
  paymentsPerYear: "pay",
  bonus: "bonus",
  equityAnnual: "equity",
  companyStage: "equity",
  companySize: "company",
  industry: "company",
};

/**
 * The answers from screens this person was actually shown.
 *
 * A draft outlives a change of contract type, so somebody who filled in a
 * bonus as an employee and then switched to contracting would otherwise submit
 * it from a screen they can no longer see or correct. We ask, or we do not
 * record — sending an answer nobody was shown the question for is the same
 * mistake as recording one they never gave.
 */
function answersShown(draft: Draft, stepIds: readonly StepId[], employed: boolean): Draft {
  const shown = new Set<StepId>(stepIds);
  return Object.fromEntries(
    Object.entries(answersOf(draft)).filter(([field]) => {
      // A contractor has no full-time equivalent: they bill days. The field is
      // hidden for them, so a stale value from before must not travel either.
      if (field === "ftePercent" && !employed) return false;
      // Same shape one screen earlier, and this one reaches the published CSV:
      // answer it as a remote worker, go back, pick on-site, and the boolean
      // would otherwise be submitted from a question no longer on the screen.
      if (field === "payLocationAdjusted" && !isRemoteSetup(draft.workSetup as string | undefined))
        return false;
      const id = STEP_OF_FIELD[field];
      return id === undefined || shown.has(id);
    }),
  );
}

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

  // An employee is asked nine questions and a contractor seven. Which screens
  // exist therefore depends on an answer given *on* one of them, so a saved
  // position can outlive the screen it pointed at: reach equity as an
  // employee, go back, switch to contractor, and step 7 no longer exists.
  // Every position below is clamped for that reason.
  //
  // Unanswered counts as employed, so the survey starts at its full length and
  // can only get shorter. The count must never *grow* as somebody answers:
  // "question 3 of 7" becoming "of 9" reads as the form adding work, where the
  // reverse is a small gift. It also keeps the nine the landing page promises
  // true for anyone who has not reached the contract question yet.
  const contractType = draft.contractType as string | undefined;
  const employed = contractType === undefined || isEmployeeContract(contractType);
  const stepIds = STEP_IDS.filter((id) => employed || !EMPLOYEE_ONLY_STEPS.has(id));
  const totalSteps = stepIds.length;
  const lastStep = totalSteps - 1;

  const savedStep = draft[STEP_KEY];
  const step =
    typeof savedStep === "number" && savedStep >= 0
      ? Math.min(savedStep, lastStep)
      : prefilled === 2
        ? 1
        : 0;
  // The furthest screen ever reached, so revisiting an earlier one to fix or
  // double-check an answer can return there in one step rather than replaying
  // every screen in between.
  const savedFurthestStep = draft[FURTHEST_STEP_KEY];
  const furthestStep = Math.max(
    typeof savedFurthestStep === "number" && savedFurthestStep >= 0
      ? Math.min(savedFurthestStep, lastStep)
      : 0,
    step,
  );
  const [status, setStatus] = useState<"editing" | "sending" | "done" | "error">("editing");
  // Captured before the draft is cleared: the confirmation screen needs the
  // country to show how close it is to publishing, and the contract to know
  // which of the two published cuts this answer actually joined.
  const [submittedCountry, setSubmittedCountry] = useState<string>();
  const [submittedAnswer, setSubmittedAnswer] = useState<Answered>();
  const [wasDuplicate, setWasDuplicate] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [turnstileFailed, setTurnstileFailed] = useState(false);
  const [turnstileAttempt, setTurnstileAttempt] = useState(0);
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
  // eight questions in is its own reason to abandon a survey. Also tracks the
  // furthest screen reached so a later revisit can jump back to it directly.
  const goTo = useCallback((next: number) => {
    const prevFurthest = getDraft()[FURTHEST_STEP_KEY];
    const nextFurthest = Math.max(typeof prevFurthest === "number" ? prevFurthest : 0, next);
    setDraftValues({ [STEP_KEY]: next, [FURTHEST_STEP_KEY]: nextFurthest });
  }, []);
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

  // Defaulted from the contract, because the two groups think in different
  // units: an employee knows their annual or monthly salary, and a contractor
  // knows their day rate. It is also the unit each one's figures are published
  // in, so the default quietly lines up with what we can actually use.
  //
  // Like the currency default, this has to be *submitted* rather than merely
  // shown — see the payload below. A default the server never receives is a
  // silent corruption: a €650 day rate stored as a yearly salary.
  const salaryPeriod = (draft.salaryPeriod as string | undefined) ?? (employed ? "year" : "day");

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

    const parsed = submittableResponseSchema.safeParse({
      ...answersShown(draft, stepIds, employed),
      currency,
      salaryPeriod,
    });
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? "");
      // Resolved against the screens this person is actually being shown, not
      // against a fixed numbering: equity is question 8 for an employee and
      // does not exist for a contractor.
      const target = stepIds.indexOf(STEP_OF_FIELD[field] as StepId);
      setStatus("error");
      setError(
        target === -1
          ? "Something in your answers could not be accepted. Please check and try again."
          : `We still need one answer from question ${target + 1}.`,
      );
      // Take them there rather than telling them to find it.
      if (target !== -1) goTo(target);
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

      // 200 with a body means nothing was stored: this browser already
      // answered today. Anything else is a 204 with no body at all.
      const body =
        res.status === 200
          ? ((await res.json().catch(() => null)) as { duplicate?: boolean } | null)
          : null;
      setWasDuplicate(Boolean(body?.duplicate));

      setSubmittedCountry(parsed.data.country);
      setSubmittedAnswer({
        contractType: parsed.data.contractType,
        ftePercent: parsed.data.ftePercent ?? null,
        salaryPeriod: parsed.data.salaryPeriod ?? null,
      });
      clearDraft();
      setStatus("done");
    } catch {
      setStatus("error");
      setError("We could not reach the server. Check your connection and try again.");
    }
  }

  if (status === "done") {
    return (
      <Confirmation
        country={submittedCountry}
        answer={submittedAnswer}
        duplicate={wasDuplicate}
      />
    );
  }

  const allSteps = [
    {
      id: "where",
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
      id: "setup",
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
          {/* Only remote workers live somewhere their employer is not, which
              is the whole of what this asks. See `isRemoteSetup`. */}
          {isRemoteSetup(draft.workSetup as string | undefined) && (
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
              compact
            />
          )}
        </>
      ),
      complete: true,
    },
    {
      id: "contract",
      title: "What kind of contract?",
      hint: "This decides which figures your answer joins. Employee salaries and contractor day rates are published separately, because the same gross means something different under each.",
      body: (
        <>
          <Choice
            name="contractType"
            label="Contract type"
            value={draft.contractType as string}
            onChange={(v) => set("contractType", v)}
            options={contractTypesFor(country)}
          />
          {/* A contractor has no full-time equivalent — they bill days, and
              nothing reads this for them: `populationOf` returns "contractor"
              before it ever looks at the percentage. */}
          {employed && (
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
          )}
        </>
      ),
      complete: Boolean(draft.contractType),
    },
    {
      id: "role",
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
      id: "level",
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
      // A contractor does not have a base salary, they have a rate they quote
      // clients. Asking the wrong noun invites the wrong number.
      id: "pay",
      title: employed ? "What is your base salary?" : "What do you charge?",
      hint: employed
        ? "Gross, before tax. Quote it however you normally think about it."
        : "Gross, before tax and before your own contributions. Quote it however you bill it.",
      body: (
        <>
          <MoneyField
            name="baseSalary"
            label={employed ? "Base salary, gross" : "Your rate, gross"}
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
              compact
            />
          )}

          {/* Asked of an employee, optional for everybody else. An employee's
              published figure is a year's income, so the days they worked
              belong in it and we will not guess them. A contractor's published
              figure is a price at a standard year, which their billed days do
              not enter: requiring it made them answer a question we ignored,
              and taking August off does not make anyone cheaper. */}
          {salaryPeriod === "day" && (
            <Field
              label="Days you billed last year"
              htmlFor="daysPerYear"
              hint={
                employed
                  ? "Actual billed days, not a target — we multiply by this rather than guess a working year."
                  : `Optional. Rates publish at a standard ${STANDARD_BILLED_DAYS}-day year, so this only sharpens the check below and the published dataset.`
              }
              required={employed}
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
              hint={
                employed
                  ? "Actual billed hours. Around 1,600 is a full year at 40 hours a week with holidays."
                  : `Optional. Rates publish at a standard ${STANDARD_HOURS_PER_DAY}-hour day, so this only sharpens the check below and the published dataset.`
              }
              required={employed}
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
          (salaryPeriod === "day" && (!employed || draft.daysPerYear != null)) ||
          (salaryPeriod === "hour" && (!employed || draft.hoursPerYear != null))),
    },
    {
      id: "bonus",
      title: "Any bonus?",
      hint: "What was actually paid in the last twelve months, not what was on target.",
      body: (
        <MoneyField
          name="bonus"
          label="Bonus paid in the last twelve months"
          value={draft.bonus as number}
          onChange={(v) => set("bonus", v)}
          currency={currency}
          currencies={CURRENCIES}
        />
      ),
      complete: true,
    },
    {
      id: "equity",
      title: "Any equity?",
      hint: "Annualised value. Skip if none — most people have none, and that is useful to know.",
      body: (
        <>
          <MoneyField
            name="equityAnnual"
            label="Annualised equity value"
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
              compact
            />
        </>
      ),
      complete: true,
    },
    {
      id: "company",
      // A contractor's "company" is whoever they invoice.
      title: employed ? "About the company" : "About the client",
      hint: employed
        ? "Size bracket and industry only. We never ask which company."
        : "Size bracket and industry only. We never ask which client.",
      body: (
        <>
          <Choice
              name="companySize"
              label={employed ? "Company size" : "Client size"}
              value={draft.companySize as string}
              onChange={(v) => set("companySize", v)}
              options={COMPANY_SIZES}
              compact
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

  // Built in full, then narrowed, so each screen's `complete` rule and body
  // read the same however many are shown.
  const steps = allSteps.filter((s) => stepIds.includes(s.id as StepId));
  const current = steps[step]!;
  const last = step === lastStep;

  // When Turnstile is configured, wait for its token rather than letting
  // someone submit a finished survey and be told afterwards that we could not
  // verify them. Most people never see the widget; they just wait a moment.
  const awaitingVerification =
    last && Boolean(turnstileSiteKey) && !turnstileToken && !turnstileFailed;

  // Once this screen is filled in and we're behind where we've already been —
  // typically right after a validation error sent us back to fix one field —
  // the next click should return us there instead of replaying every screen.
  const canSkipAhead = !last && step < furthestStep && current.complete;
  const nextTarget = canSkipAhead ? furthestStep : step + 1;
  const nextLabel = canSkipAhead
    ? furthestStep === lastStep
      ? "Continue to submit"
      : "Continue"
    : "Next";

  return (
    <div>
      <div className="mb-8">
        <div className="mb-2 flex items-baseline justify-between text-xs text-ink-3">
          <span>
            Question {step + 1} of {totalSteps}
          </span>
          {prefilled === 2 && step === 1 && <span>Two answered from the last page</span>}
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-track"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-label="Survey progress"
        >
          <div
            className="h-full rounded-full bg-coral transition-[width] duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
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
          onClick={() => (last ? submit() : goTo(nextTarget))}
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
                : nextLabel}
          {!last && <span aria-hidden="true">→</span>}
        </button>
      </div>

      {turnstileSiteKey && (
        <div className="mt-8">
          <Turnstile
            siteKey={turnstileSiteKey}
            attempt={turnstileAttempt}
            onToken={(token) => {
              setTurnstileToken(token);
              if (token) setTurnstileFailed(false);
            }}
            onFailure={() => setTurnstileFailed(true)}
          />

          {turnstileFailed && (
            <div
              role="alert"
              className="mx-auto mt-4 max-w-[52ch] rounded-md bg-wash px-4 py-3 text-xs leading-relaxed text-ink-2"
            >
              <b className="font-semibold text-ink">We could not check your browser.</b> This is
              almost always a privacy extension or network filter blocking{" "}
              <code className="font-mono">challenges.cloudflare.com</code>. Allow it and try
              again — your answers are still here.
              <button
                type="button"
                onClick={() => {
                  setTurnstileFailed(false);
                  setTurnstileToken(undefined);
                  setTurnstileAttempt((n) => n + 1);
                }}
                className="mt-3 block rounded-full border border-line-2 px-4 py-2 font-semibold text-ink transition-colors hover:bg-tint"
              >
                Try the check again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lives here rather than on the page around it, because the page also
          renders the confirmation screen — which carries its own version of
          this, and the two stacked one above the other read as a page that had
          not been proofread. This is the copy that matters: it is the one shown
          while the decision can still be changed. The confirmation's is a
          reminder afterwards. */}
      <p className="mt-12 border-t border-line pt-6 text-xs leading-relaxed text-ink-3">
        Nothing here identifies you. Because of that, we cannot delete one particular response
        later — we would have no way to tell which one is yours.
      </p>
    </div>
  );
}

function defaultCurrency(country?: CountryCode): string {
  return COUNTRIES.find((c) => c.code === country)?.currency ?? "EUR";
}
