import type { Metadata } from "next";

import { LegalPage, Points, Section } from "@/components/legal";
import { SOURCE_URL } from "@/lib/legal";
import {
  COUNTRY_PUBLISH_MIN,
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
      intro="Every choice below changes the numbers. They are written down so you can disagree with them — and, if you do, recompute from the raw dataset yourself."
    >
      <Section heading="What counts as comparable">
        <p>
          Headline figures cover <b>employees on standard contracts only</b>. B2B and freelance
          gross carries the worker&rsquo;s own social contributions, so it is far higher for the
          same take-home pay. Averaging the two produces a number that describes nobody. This is
          the single most distorting mistake available in European pay data, and it is why the
          survey asks about contract type at all.
        </p>
        <p>
          <b>Part-time responses are excluded rather than scaled up.</b> Extrapolating a 60%
          contract to full time invents a salary nobody is paid. Those responses stay in the
          dataset; they just do not set the medians.
        </p>
        <p>
          Both groups remain in the downloadable file, so you can include them if you disagree.
        </p>
      </Section>

      <Section heading="What total compensation means here">
        <Points
          items={[
            ["Included", "Gross annual base salary, plus bonus actually paid in the last twelve months, plus annualised equity."],
            ["Not included", "Pension contributions, benefits, and anything not asked for. Employer social contributions are excluded, which is part of why B2B figures are not comparable."],
            [
              "Payments per year",
              "Asked because 13th and 14th month salaries are normal in Spain, Portugal, Italy, Austria and Greece. It is context, not a multiplier — the figure entered is already the annual total.",
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
          No cost-of-living adjustment is applied to the headline figures. €70,000 in Zurich and
          €70,000 in Lisbon are different lives, and pretending one number captures that would be
          worse than leaving you to make the comparison yourself.
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
          and samples below twenty are left alone — cutting the tails off a small sample removes
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
              `Fewer than ${COUNTRY_PUBLISH_MIN} responses`,
              "No median published for that slice. This is a statistical rule, deliberately much higher than the privacy one: a median over six people is not a median worth printing.",
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
