import type { Metadata } from "next";

import { LegalPage, Points, Section } from "@/components/legal";
import { SOURCE_URL } from "@/lib/legal";
import { STANDARD_BILLED_DAYS, STANDARD_HOURS_PER_DAY } from "@/lib/stats/dayRate";
import {
  COUNTRY_PUBLISH_MIN,
  DAY_RATE_PUBLISH_MIN,
  MIN_CELL_SIZE,
  TRIM_LOWER_PERCENTILE,
  TRIM_UPPER_PERCENTILE,
} from "@/lib/thresholds";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How whatweearn turns survey responses into published figures: what is counted, what is excluded, and why.",
  alternates: { canonical: "/methodology" },
};

/**
 * Every threshold on this page is imported from the module the aggregation
 * uses. The page cannot drift from the behaviour it describes.
 */
export default function MethodologyPage() {
  return (
    <LegalPage
      title="Methodology"
      updated="25 July 2026"
      intro="Every choice below changes the numbers. They are written down so you can disagree with them, and if you do, recompute from the raw dataset yourself."
    >
      <Section heading="Three groups, never averaged together">
        <p>
          Every response is published, and each belongs to exactly one of three groups:{" "}
          <b>full-time employees</b>, <b>part-time employees</b>, and{" "}
          <b>contractors and B2B</b>. Each has its own figures, its own count and its own
          threshold. Nothing is left out for being the wrong kind of contract.
        </p>
        <p>
          They are never averaged into one number, because they are not one quantity. A
          contractor&rsquo;s gross carries social contributions an employer would otherwise pay,
          so it is far higher for the same take-home; mixing it with employed gross is the single
          most distorting mistake available in European pay data. A part-time salary is published
          exactly as it is paid and never scaled up to full time, because extrapolating a 60%
          contract invents a salary nobody receives.
        </p>
        <p>
          <b>Contractors are measured per day.</b> A day rate is the number that actually
          describes self-employed work: it is a single negotiated price, with no bonus, equity,
          thirteenth month or part-time fraction in it. Where somebody quoted a rate per day, it
          is used exactly as given. Where they quoted an annual or monthly figure, it is divided
          by a standard {STANDARD_BILLED_DAYS}-day year; an hourly rate is multiplied by a
          standard {STANDARD_HOURS_PER_DAY}-hour day.
        </p>
        <p>
          The standard year is the important part. Dividing by the days somebody personally
          billed would fold their holidays, parental leave and dry spells into the median, which
          would report time off as though it were a discount on the rate. Taking six weeks off
          does not make you cheaper. The raw amount and its period are what we store, so anyone
          who prefers different standards can recompute the whole thing from the dataset.
        </p>
      </Section>

      <Section heading="What total compensation means here">
        <Points
          items={[
            [
              "Included",
              "Gross base pay, plus bonus actually paid in the last twelve months, plus annualised equity.",
            ],
            [
              "However you are paid",
              "Base pay can be quoted per year, month, day or hour. Asking everyone for an annual figure forced a conversion in their head, worst of all for freelancers and B2B contractors, who think in day rates and would have had to guess a working year.",
            ],
            ["Not included", "Pension contributions, benefits, and anything not asked for. Employer social contributions are excluded, which is part of why employee and contractor figures are published separately."],
            [
              "The multiplier is asked for, never assumed",
              "A monthly figure needs the number of payments (12, 13 or 14, the last two being normal in Spain, Portugal, Italy, Austria and Greece). A day rate needs the days actually billed last year; an hourly rate, the hours. €600 a day is €120,000 over 200 days and €138,000 over 230, and picking between those on someone's behalf would be publishing a figure nobody supplied. Where the count is missing, the response is left out of the figures rather than annualised on a guess.",
            ],
          ]}
        />
      </Section>

      <Section heading="Currency">
        <p>
          Everything is converted to euro using the European Central Bank&rsquo;s daily reference
          rates. Rates are stored per day, so re-running the aggregation reproduces the same
          numbers rather than drifting with today&rsquo;s exchange rate. The raw amount and its
          original currency are what we store; the converted figure is derived.
        </p>
        <p>
          No cost-of-living adjustment is applied to any published figure. €70,000 in Zurich and
          €70,000 in Lisbon are different lives, and pretending one number captures that would be
          worse than leaving you to make the comparison yourself.
        </p>
      </Section>

      <Section heading="Obvious mistakes">
        <p>
          A figure is checked once it has been annualised and roughly converted to euro, because
          neither check works alone: 200 a year is nonsense while 200 a day is an ordinary
          contractor, and 3,000 is a fine monthly salary in euro but about €7.50 in forint.
        </p>
        <p>
          Anything that lands outside roughly €1,000 to €3,000,000 a year is refused at
          submission. That is a typo, and one of them in a small sample moves a median. Merely
          unusual figures are accepted and flagged for review: the lowest-paid junior in Ukraine
          and the highest-paid principal in Zurich are both real people whose answers we want.
        </p>
        <p>
          The rates used for that check are approximate and never touch published figures, which
          convert at the European Central Bank&rsquo;s stored daily rates.
        </p>
      </Section>

      <Section heading="Outliers">
        <p>
          Before any figure is computed, the lowest {TRIM_LOWER_PERCENTILE}% and highest{" "}
          {TRIM_UPPER_PERCENTILE === 99 ? 1 : 100 - TRIM_UPPER_PERCENTILE}% of a sample are
          dropped. Trimming rather than capping: a mistyped €10,000,000 should leave the sample
          entirely, not be pulled down to the 99th percentile where it still drags the average.
        </p>
        <p>
          The rule is symmetric, so it cannot be tuned to push a median in a preferred direction,
          and samples below twenty are left alone, because cutting the tails off a small sample removes
          a meaningful share of it and does more harm than the outliers would.
        </p>
      </Section>

      <Section heading="When a figure gets published">
        <Points
          items={[
            [
              `Fewer than ${MIN_CELL_SIZE} responses`,
              "Withheld entirely. This is the privacy rule: it is what stops \"principal engineer, Ljubljana, 15 years\" from being one identifiable person.",
            ],
            [
              `Fewer than ${COUNTRY_PUBLISH_MIN} salaries`,
              "No median published for that slice, for full-time or part-time employees. This is a statistical rule, deliberately much higher than the privacy one: a median over six people is not a median worth printing.",
            ],
            [
              `Fewer than ${DAY_RATE_PUBLISH_MIN} contractor day rates`,
              `No day-rate median for that slice. Lower than the ${COUNTRY_PUBLISH_MIN} a salary median needs, because a day rate is a single negotiated price with no bonus, equity, thirteenth month or part-time fraction in it. Less of that variance means the median settles on fewer answers; it is not a lower standard applied to get something on the page sooner.`,
            ],
          ]}
        />
        <p>
          Suppression is applied when the published files are generated, so a withheld figure is
          genuinely absent rather than hidden by the interface.
        </p>
      </Section>

      <Section heading="Publishing schedule">
        <p>
          Figures are rebuilt nightly, never live. That is partly cost and partly defence: with
          no immediate feedback, somebody submitting invented salaries cannot tell whether it
          moved anything, which removes most of the incentive to try.
        </p>
      </Section>

      <Section heading="The downloadable dataset">
        <p>
          Releasing one row per response would contradict the {MIN_CELL_SIZE}-response rule,
          because a single row is a slice of one. So the file is released under k-anonymity:
          cities are dropped, experience is banded into five-year ranges, pay is rounded to the
          nearest €500 so an exact figure cannot fingerprint a row, and any combination of
          characteristics appearing fewer than {MIN_CELL_SIZE} times is withheld.
        </p>
        <p>Licensed CC BY 4.0. Plot it, audit it, argue with it.</p>
      </Section>

      <Section heading="Known limitations">
        <Points
          items={[
            ["Self-selection", "People who answer salary surveys are not a random sample of engineers. They skew towards the engaged, the online, and often the better paid. Treat every figure as a description of who responded, not of the profession."],
            ["No verification", "Nothing here is checked against a payslip. The defences are against automated and repeated submission, not against one person being untruthful once."],
            ["No demographics", "Gender is not collected, so no pay-gap analysis is possible. That is a real cost of keeping the dataset as thin as it is."],
            ["Thin cells", "Small countries and senior levels will stay unpublished for a long time. That is the design working, not a bug."],
            ["A standard working year", `Contractor rates derived from an annual figure assume a ${STANDARD_BILLED_DAYS}-day year for everybody. It is the same assumption for everybody, which is what makes the medians comparable, but it is still an assumption: somebody who bills 180 days a year and somebody who bills 240 are not described equally well by it.`],
          ]}
        />
      </Section>

      <Section heading="Check the code">
        <p>
          Every threshold on this page is read from the same module the aggregation uses, so this
          description cannot drift from the behaviour. All of it is in the{" "}
          <a href={SOURCE_URL} className="text-accent underline underline-offset-2">
            public repository
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
