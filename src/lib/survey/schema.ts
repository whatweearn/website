import { z } from "zod";

import { checkSalary } from "./plausibility";
import {
  COMPANY_SIZES,
  COMPANY_STAGES,
  CONTRACT_TYPES,
  COUNTRY_CODES,
  CURRENCIES,
  DISCIPLINES,
  INDUSTRIES,
  LANGUAGES,
  LEVELS,
  SALARY_PERIODS,
  WORK_SETUPS,
  valuesOf,
} from "./options";

/**
 * What a submission may contain.
 *
 * Required: country, contract type, level, base salary. Everything else is
 * optional — completion rate matters more than field coverage, and a partial
 * response is still a useful data point.
 *
 * Bounds are deliberately generous. They exist to reject nonsense
 * (a negative salary, a 400-year career), not to judge what someone earns;
 * outlier handling happens later, in the aggregation layer, where it can be
 * applied transparently rather than by silently refusing a submission.
 */

const money = z.number().int().min(0).max(10_000_000);

export const responseSchema = z.object({
  // 1 — where
  country: z.enum(COUNTRY_CODES),
  city: z.string().max(64).optional(),

  // 2 — work setup
  workSetup: z.enum(valuesOf(WORK_SETUPS)).optional(),
  payLocationAdjusted: z.boolean().optional(),

  // 3 — contract
  contractType: z.enum(valuesOf(CONTRACT_TYPES)),
  ftePercent: z.number().int().min(10).max(100).optional(),

  // 4 — role
  discipline: z.enum(valuesOf(DISCIPLINES)).optional(),
  primaryLanguage: z.enum(LANGUAGES).optional(),

  // 5 — seniority
  level: z.enum(valuesOf(LEVELS)),
  yearsExperience: z.number().int().min(0).max(60).optional(),

  // 6 — base salary, as the person actually thinks about it
  baseSalary: money,
  currency: z.enum(CURRENCIES),
  salaryPeriod: z.enum(valuesOf(SALARY_PERIODS)).optional(),
  paymentsPerYear: z.union([z.literal(12), z.literal(13), z.literal(14)]).optional(),
  /** Days actually billed last year, for a day rate. */
  daysPerYear: z.number().int().min(1).max(365).optional(),
  /** Hours actually billed last year, for an hourly rate. */
  hoursPerYear: z.number().int().min(1).max(4000).optional(),

  // 7 — bonus
  bonus: money.optional(),

  // 8 — equity
  equityAnnual: money.optional(),
  companyStage: z.enum(valuesOf(COMPANY_STAGES)).optional(),

  // 9 — company
  companySize: z.enum(valuesOf(COMPANY_SIZES)).optional(),
  industry: z.enum(valuesOf(INDUSTRIES)).optional(),
});

export type SurveyResponse = z.infer<typeof responseSchema>;

/**
 * A rate needs its multiplier.
 *
 * Rejected at submission rather than annualised on a guess later, so the
 * person can still fix it while they are looking at the question.
 */
export const submittableResponseSchema = responseSchema
  .refine((r) => checkSalary(r).verdict !== "impossible", {
    // Refused, not flagged. A figure a hundred times off is a typo, and
    // accepting it would put a €200-a-year salary into a median.
    message: "That salary does not look right once converted to a yearly figure.",
    path: ["baseSalary"],
  })
  .refine(
  (r) =>
    r.salaryPeriod === "month" ? r.paymentsPerYear != null
    : r.salaryPeriod === "day" ? r.daysPerYear != null
    : r.salaryPeriod === "hour" ? r.hoursPerYear != null
    : true,
  { message: "A rate quoted per month, day or hour needs its count.", path: ["baseSalary"] },
  );

/** What the client actually posts: the answers plus the anti-abuse envelope. */
export const submissionSchema = z.object({
  response: submittableResponseSchema,
  /** Signed at page render; proves the form was served by us and when. */
  formToken: z.string().min(1),
  /** Turnstile result. Absent only when Turnstile is not configured. */
  turnstileToken: z.string().optional(),
  /**
   * Honeypot. Hidden from people, irresistible to naive bots. Must be empty —
   * any content at all means the submission is discarded.
   */
  website: z.string().max(0).optional(),
});

export type Submission = z.infer<typeof submissionSchema>;

/**
 * Cross-field checks that flag rather than block.
 *
 * A junior with 18 years' experience is more likely a mis-tap than a lie, and
 * refusing the submission would lose a real data point to protect against a
 * problem the aggregation layer already handles. These land on the stored row
 * so the review queue can look at them later.
 */
export function implausibilities(response: SurveyResponse): string[] {
  const flags: string[] = [];

  if (response.level === "junior" && (response.yearsExperience ?? 0) > 12) {
    flags.push("junior_with_long_tenure");
  }
  if (response.level === "principal" && (response.yearsExperience ?? 99) < 3) {
    flags.push("principal_with_short_tenure");
  }
  // Was a bare `baseSalary < 3_000`, which is currency-blind: 3,000 forint is
  // about €7.50, so an ordinary Hungarian salary passed and a normal euro
  // monthly figure was flagged. Judged on the annualised euro value instead.
  const salary = checkSalary(response);
  if (salary.verdict === "suspect") {
    flags.push(
      salary.annualEuro !== null && salary.annualEuro < 10_000
        ? "annual_pay_unusually_low"
        : "annual_pay_unusually_high",
    );
  }
  if (response.bonus !== undefined && response.bonus > response.baseSalary * 3) {
    flags.push("bonus_exceeds_3x_base");
  }
  if (response.equityAnnual !== undefined && response.equityAnnual > response.baseSalary * 10) {
    flags.push("equity_exceeds_10x_base");
  }

  return flags;
}
