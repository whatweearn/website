import type { Metadata } from "next";

import { LegalPage, MissingController, Points, Section } from "@/components/legal";
import { SOURCE_URL, getController } from "@/lib/legal";
import { COUNTRY_PUBLISH_MIN, MIN_CELL_SIZE } from "@/lib/thresholds";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What whatweearn stores, what it cannot store, and why.",
  alternates: { canonical: "/privacy" },
};

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const controller = getController();

  return (
    <LegalPage
      title="Privacy"
      updated="25 July 2026"
      intro="Most privacy policies describe intentions. This one describes mechanisms, because the claims on this site are only worth anything if you can check them."
    >
      <Section heading="Who is responsible">
        {controller ? (
          <Points
            items={[
              ["Data controller", controller.name],
              ["Contact", controller.email],
              ...(controller.address ? ([["Address", controller.address]] as const) : []),
            ]}
          />
        ) : (
          <MissingController />
        )}
      </Section>

      <Section heading="Survey answers are anonymous, not pseudonymous">
        <p>
          There is no account, no login and no identifier of any kind attached to a response.
          When you submit, the server stores your answers and returns nothing — no id, no token,
          no receipt. There is deliberately no value you could later present to us that would
          point at your row.
        </p>
        <p>
          Because of that, survey responses are not personal data, and the rest of this policy
          is mostly about the two places where personal data does briefly appear.
        </p>
      </Section>

      <Section heading="Your IP address is never stored">
        <p>
          To stop the same person submitting fifty times, the server combines your IP address
          and browser with a secret that is scoped to a single calendar day, hashes the result
          one way, and stores only that digest. The address itself is never written to disk or
          to a log.
        </p>
        <p>
          The digest cannot be reversed into an address, and because the secret changes daily
          and is discarded, the same visitor hashes to something different tomorrow. It cannot
          be used to follow anyone over time. Its only purpose is spotting a duplicate before
          midnight.
        </p>
      </Section>

      <Section heading="Every answer is a bounded choice">
        <p>
          There is no free-text field anywhere in the survey. Every question is a list to pick
          from or a number, which means nothing personal can end up in the dataset by accident —
          not a name typed into a comment box, not an employer mentioned in passing.
        </p>
        <p>
          We never ask who you work for. Company size bracket and industry only.
        </p>
      </Section>

      <Section heading="If you give us an email address">
        <p>
          The notification list is optional, lives on the data page rather than inside the
          survey, and is stored in a <b>physically separate database</b> with its own
          credentials. There is no key, no timestamp and no shared value connecting the two, and
          no code in this project is permitted to open both connections — an automated test
          fails the build if any module tries.
        </p>
        <p>
          Both databases record dates rather than timestamps, and the subscriber table uses
          random identifiers instead of sequential ones, so a signup and a response cannot be
          matched up by when they arrived or by what order they were written in.
        </p>
        <p>
          The consequence is worth stating plainly: <b>we can never email you about your own
          answers</b>. Not as a policy, but because we genuinely cannot find them. Your address
          is used for two things — telling you when results publish, and telling you when the
          survey reopens.
        </p>
        <p>
          Nothing is stored until you follow the confirmation link. If you never do, the address
          is deleted within a fortnight. Every email carries a one-click unsubscribe.
        </p>
      </Section>

      <Section heading="Erasure, and the one right we cannot honour">
        <Points
          items={[
            [
              "Your email address",
              "Unsubscribe from any email, or ask us — we will delete it and confirm.",
            ],
            [
              "Your survey response",
              `We cannot delete a particular response, because we cannot tell which one is yours. That is the direct cost of the anonymity above, and we would rather say so than pretend otherwise. Please be sure before you submit.`,
            ],
          ]}
        />
      </Section>

      <Section heading="What we publish, and what we hold back">
        <p>
          Any slice of the data with fewer than {MIN_CELL_SIZE} responses is withheld entirely,
          and a country&rsquo;s figures are not published until it clears {COUNTRY_PUBLISH_MIN}.
          Withheld figures are absent from the published files rather than hidden by the
          interface, so a display bug cannot leak them.
        </p>
        <p>
          The downloadable dataset drops cities, bands experience into five-year ranges, rounds
          pay to the nearest €500 and withholds any combination of characteristics appearing
          fewer than {MIN_CELL_SIZE} times.
        </p>
      </Section>

      <Section heading="Third parties">
        <Points
          items={[
            [
              "Cloudflare Turnstile",
              "Confirms a submission came from a browser rather than a script. It sees your IP address as part of that check. We chose it over a proof-of-work alternative because the realistic threat is somebody submitting invented salaries at volume, which proof-of-work does not stop.",
            ],
            [
              "Resend",
              "Sends the confirmation and notification emails. Resend stores account data and logs in the United States under Standard Contractual Clauses and its Data Privacy Framework certification. We use it only to send: your address lives in our own EU database, never in Resend's contact storage.",
            ],
            [
              "Hosting",
              "The site and both databases run in the EU. No analytics, no advertising, no tracking scripts, and no cookies — which is why there is no cookie banner.",
            ],
          ]}
        />
      </Section>

      <Section heading="Check for yourself">
        <p>
          The mechanisms above are code, not promises. The suppression thresholds, the hashing,
          the two-database separation and the test that enforces it are all in the{" "}
          <a href={SOURCE_URL} className="text-accent underline underline-offset-2">
            public repository
          </a>
          . If this page and the code ever disagree, the code is what runs.
        </p>
      </Section>
    </LegalPage>
  );
}
