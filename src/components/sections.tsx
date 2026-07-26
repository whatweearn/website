import { count } from "@/lib/format";
import { type SiteStats, publishableCountries } from "@/lib/stats";
import { COUNTRY_PUBLISH_MIN, MIN_CELL_SIZE, responsesUntilPublish } from "@/lib/thresholds";

import Link from "next/link";

import { Reveal } from "./Reveal";
import { Share } from "./Share";
import { Button, Container, Pill, SectionHead, TrustLine } from "./ui";
import { ThemeToggle } from "./ThemeToggle";

/* ------------------------------------------------------------------ nav -- */

export function Nav() {
  return (
    <Container>
      {/* Wraps rather than overflows. Font metrics differ enough between
          platforms — the same nav measures 149px on macOS and 161px on Linux —
          that any fixed budget is a guess; letting it drop to a second line
          cannot overflow at any width. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-[1.35rem]">
        {/* Wordmark only. "we" takes the accent — it separates the compound at
            the "wee" collision and says what the survey is: what WE earn. */}
        <a
          href="#top"
          aria-label="whatweearn, home"
          className="py-1 font-display text-[1.24rem] font-semibold tracking-[-0.03em] text-ink no-underline"
        >
          what<span className="text-accent">we</span>earn
        </a>
        <nav className="ml-auto flex min-w-0 items-center gap-3 text-xs min-[400px]:gap-6">
          <a
            href="#why"
            className="hidden text-ink-2 no-underline transition-colors hover:text-ink min-[900px]:inline"
          >
            Why bother
          </a>
          <a
            href="#survey"
            className="hidden text-ink-2 no-underline transition-colors hover:text-ink min-[760px]:inline"
          >
            The questions
          </a>
          <Link
            href="/data"
            className="hidden text-ink-2 no-underline transition-colors hover:text-ink min-[760px]:inline"
          >
            The data
          </Link>
          <ThemeToggle />
          <Button href="/survey" variant="ink" size="sm">
            {/* WCAG 2.2 reflow: at 320px the full label pushes the nav past
                the viewport. Same destination, fewer words. */}
            <span className="min-[400px]:hidden">Add yours</span>
            <span className="hidden min-[400px]:inline">Add your salary</span>
          </Button>
        </nav>
      </div>
    </Container>
  );
}

/* ----------------------------------------------------------------- hero -- */

/**
 * @param published Whether any figure exists yet. Before that, the promise
 *   that the dataset opens on submit is simply untrue, and the offer is a
 *   different one: being early is the contribution.
 */
export function Hero({ published }: { published: boolean }) {
  return (
    <Container className="flex flex-col items-center gap-6 pt-[clamp(2.25rem,5.5vw,4rem)] pb-[clamp(2rem,4vw,3rem)] text-center">
      <Pill>Anonymous · Europe-wide · Open data</Pill>
      <h1 className="max-w-[14ch] text-3xl leading-[1.02] tracking-[-0.038em]">
        Know what you&rsquo;re <em className="not-italic text-coral">actually</em> worth.
      </h1>
      {/* The lead is the asymmetry, not the method. Privacy is why this is safe
          to answer; it was never why anyone would want to. That argument moved
          down to the trust line and the survey preview, where it reassures
          somebody already interested rather than opening to a stranger with a
          list of things we promise not to do. */}
      <p className="max-w-[44ch] text-lg leading-snug text-ink-2">
        {published ? (
          <>
            The company across the table knows the market rate for your job. You are
            guessing at it. Nine questions, about two minutes, and the whole dataset opens
            the moment you&rsquo;re done.
          </>
        ) : (
          <>
            The company across the table knows the market rate for your job. You are
            guessing at it. Nine questions, about two minutes. Nothing is published yet — a
            country needs {COUNTRY_PUBLISH_MIN} answers before its median means anything, so
            the early ones count for most.
          </>
        )}
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-3 max-[560px]:w-full max-[560px]:flex-col">
        <Button id="cta-hero" href="/survey" size="lg" arrow className="max-[560px]:w-full">
          Add your salary
        </Button>
        <Button href="/data" variant="ghost" size="lg" className="max-[560px]:w-full">
          See the data first
        </Button>
      </div>
      <TrustLine items={["About two minutes", "Anonymous", "No account, no employer names"]} />
    </Container>
  );
}

/* --------------------------------------------------------------- stakes -- */

const STAKES = [
  {
    title: "Most engineers find out years late.",
    body: "The offer at the next company is the first honest signal a lot of people ever get about their own market rate, and by then the gap has been running for three or four years. Nobody sends you a letter when you fall behind.",
  },
  {
    title: "It is never just the salary.",
    body: "Starting a few thousand under does not stay a few thousand. Every raise is a percentage of it, every bonus is a fraction of it, and the next employer asks what you make now. A small gap set early keeps paying out for the rest of a career.",
  },
  {
    title: "The other side is not guessing.",
    body: "Compensation teams buy benchmark data. Recruiters have placed forty people in your role this year and know exactly where you sit. That data exists and it is priced for employers. It is simply not sold to you.",
  },
];

/**
 * The argument for spending the two minutes.
 *
 * Everything else on this page describes what the site *is*. This is the only
 * part that says why answering is worth anything to the person reading, which
 * is the actual reason somebody starts a survey. It sits above the privacy
 * section on purpose.
 */
export function Stakes() {
  return (
    <section id="why" className="py-[clamp(3rem,5.5vw,4.5rem)]">
      <Container>
        <Reveal>
          <SectionHead title="Two minutes is not the cost. Not knowing is.">
            Pay in this industry stays secret because everyone assumes everyone else already
            knows. Almost nobody does.
          </SectionHead>
        </Reveal>

        <Reveal className="grid gap-[clamp(1rem,2.5vw,1.5rem)] min-[800px]:grid-cols-3">
          {STAKES.map((item, index) => (
            <article key={item.title} className="flex flex-col gap-2.5">
              <span
                aria-hidden="true"
                className="figure-num text-lg leading-none font-semibold text-coral"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-lg">{item.title}</h3>
              <p className="text-xs leading-relaxed text-ink-2">{item.body}</p>
            </article>
          ))}
        </Reveal>

        <Reveal>
          <p className="mt-[clamp(2rem,3.5vw,2.75rem)] max-w-[54ch] border-t border-line pt-6 text-ink-2">
            <b className="font-semibold text-ink">
              The only reason engineers do not have this is that engineers do not tell each
              other.
            </b>{" "}
            Which makes it a two-minute problem, and one of the very few where doing the
            selfish thing and the useful thing are the same action.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------------- proof -- */

/**
 * Social proof, shown only once it exists. Three zeros would be worse than
 * nothing, and inventing a count is off the table.
 */
export function Proof({ stats }: { stats: SiteStats }) {
  if (stats.totalResponses === 0) return null;

  return (
    <Reveal className="grid gap-8 pt-[clamp(2rem,3.5vw,2.75rem)] text-center min-[620px]:grid-cols-3">
      <div>
        <span className="figure-num block text-2xl leading-none font-semibold tracking-[-0.04em]">
          {count(stats.totalResponses)}
        </span>
        <span className="mt-2 block text-xs text-ink-3">engineers have answered</span>
      </div>
      <div>
        <span className="figure-num block text-2xl leading-none font-semibold tracking-[-0.04em]">
          {count(stats.countriesCovered)}
        </span>
        <span className="mt-2 block text-xs text-ink-3">countries covered</span>
      </div>
      <div>
        <span className="figure-num block text-2xl leading-none font-semibold tracking-[-0.04em]">
          9
        </span>
        <span className="mt-2 block text-xs text-ink-3">questions, no free text</span>
      </div>
    </Reveal>
  );
}

/* -------------------------------------------------------------- survey -- */

const ASKS = [
  { label: "Country and city" },
  { label: "Remote, hybrid, or on-site" },
  { label: "Permanent, contract, or B2B" },
  { label: "What you work on, and in what" },
  { label: "Level and years of experience" },
  { label: "Base salary — yearly, monthly, daily or hourly" },
  { label: "Bonus actually paid last year" },
  { label: "Equity, annualised", optional: true },
  { label: "Company size and industry" },
];

const NEVERS = [
  ["Your name", ", or anything that could rebuild it."],
  ["Your employer.", " Headcount bracket only — never a logo."],
  [
    "Anything free-text.",
    " Every answer is a bounded choice, so nothing personal can land in the data by accident.",
  ],
  ["Your IP.", " Duplicates are caught with a hash that expires the same day."],
] as const;

export function SurveyPreview() {
  return (
    <section id="survey" className="py-[clamp(3rem,5.5vw,4.5rem)]">
      <Container>
        <Reveal>
          <SectionHead title="Here's the entire survey.">
            Every question, in order. Nothing else appears once you start.
          </SectionHead>
        </Reveal>

        <div className="grid gap-[clamp(1rem,2.5vw,1.5rem)] min-[880px]:grid-cols-[1.1fr_1fr] min-[880px]:items-start">
          <Reveal>
            <div className="rounded-lg border border-line bg-surface p-[clamp(1.35rem,2.6vw,1.9rem)] shadow-sm">
              <h3 className="mb-[1.1rem] text-lg">What we ask</h3>
              <ul className="m-0 list-none p-0">
                {ASKS.map((ask) => (
                  <li
                    key={ask.label}
                    className="flex items-center gap-3 border-t border-line py-[0.62rem] first:border-t-0"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-5 shrink-0 place-items-center rounded-full bg-wash text-[11px] font-bold text-accent"
                    >
                      ✓
                    </span>
                    {ask.label}
                    {ask.optional && (
                      <span className="ml-auto rounded-full bg-tint-2 px-2.5 py-0.5 text-2xs whitespace-nowrap text-ink-3">
                        optional
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal>
            <div className="rounded-lg border border-line bg-surface p-[clamp(1.35rem,2.6vw,1.9rem)] shadow-sm">
              <h3 className="mb-[1.1rem] text-lg">What we never ask</h3>
              <ul className="m-0 grid list-none gap-4 p-0">
                {NEVERS.map(([lead, rest]) => (
                  <li key={lead} className="flex items-start gap-3 text-xs leading-relaxed text-ink-2">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-line-2 text-[10px] text-ink-3"
                    >
                      ✕
                    </span>
                    <span>
                      <b className="font-semibold text-ink">{lead}</b>
                      {rest}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-5 border-t border-line pt-[1.1rem] text-xs leading-relaxed text-ink-2">
                {/* Explicit {" "} — JSX trims a text node's first line, so a
                    space after a closing tag is silently lost when the
                    sentence wraps. */}
                <b className="font-semibold text-ink">The one optional extra:</b>{" "}
                after you submit, you can leave an email to hear when the results publish. It goes to a
                separate database with no link back to your answers — which also means we can
                never email you about your own numbers. That&rsquo;s the trade, and it&rsquo;s
                structural, not a policy.
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------- payoff -- */

const TILES = [
  {
    title: "Find out where you sit",
    body: "Medians and quartiles by country, level and experience, so \"am I underpaid\" stops being a feeling and becomes a percentile — cost-of-living adjusted if you want it, raw if you don't.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
      </>
    ),
  },
  {
    title: "A number for the actual conversation",
    body: `Senior backend, Go, 200-person fintech, Lisbon, hybrid. Narrow it to your exact seat and walk in with a quartile instead of a hunch. Filter until the sample thins below ${MIN_CELL_SIZE} and we say so instead of guessing.`,
    icon: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
        <circle cx="9" cy="7" r="2.2" />
        <circle cx="15" cy="12" r="2.2" />
        <circle cx="8" cy="17" r="2.2" />
      </>
    ),
  },
  {
    title: "The raw file",
    body: "The full anonymised dataset as CSV under CC BY 4.0. Plot it, audit it, argue with it. Rebuilt nightly.",
    icon: (
      <>
        <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <path d="M14 3v5h5" />
        <path d="M12 12v6M9.5 15.5 12 18l2.5-2.5" />
      </>
    ),
  },
];

export function Payoff({ published }: { published: boolean }) {
  return (
    <section className="bg-tint py-[clamp(3rem,5.5vw,4.5rem)]">
      <Container>
        <Reveal>
          {published ? (
            <SectionHead title="Submit, and everything opens.">
              No drip-feed, no premium tier. It stays open.
            </SectionHead>
          ) : (
            <SectionHead title="It opens for everyone, the moment there is enough.">
              No drip-feed, no premium tier, no email wall. The only thing between you and the
              data is how many people have answered.
            </SectionHead>
          )}
        </Reveal>

        <Reveal className="grid gap-[clamp(1rem,2.5vw,1.5rem)] min-[800px]:grid-cols-3">
          {TILES.map((tile) => (
            <article
              key={tile.title}
              className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-6 shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-md"
            >
              <span
                aria-hidden="true"
                className="mb-2 grid size-[38px] place-items-center rounded-md bg-wash text-accent"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {tile.icon}
                </svg>
              </span>
              <h3 className="text-lg">{tile.title}</h3>
              <p className="text-xs leading-relaxed text-ink-2">{tile.body}</p>
            </article>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}

/* --------------------------------------------------------------- table -- */

export function CountryTable({ stats }: { stats: SiteStats }) {
  const published = publishableCountries(stats);
  const pending = stats.countries.filter((c) => !published.includes(c));

  return (
    <section id="data" className="py-[clamp(3rem,5.5vw,4.5rem)]">
      <Container>
        <Reveal>
          <SectionHead title="What each country pays.">
            A country publishes once it clears {COUNTRY_PUBLISH_MIN} responses — enough for the
            median to mean something.
          </SectionHead>
        </Reveal>

        <Reveal>
          {stats.countries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-2 bg-surface p-[clamp(1.5rem,4vw,2.5rem)] text-center">
              <p className="font-display text-lg font-semibold">Nothing published yet.</p>
              <p className="mx-auto mt-2 max-w-[44ch] text-xs leading-relaxed text-ink-2">
                No country has reached {COUNTRY_PUBLISH_MIN} responses. Until one does, this
                table stays empty — we publish medians when they mean something, not before.
              </p>
              <Button href="/survey" size="sm" arrow className="mt-6">
                Add the first
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
              <div className="table-scroll">
                <table className="w-full border-collapse max-[560px]:min-w-0 min-[561px]:min-w-[560px]">
                  <thead>
                    <tr>
                      <th className="border-b border-line px-5 py-[0.85rem] text-left text-2xs font-medium tracking-wider text-ink-3 uppercase whitespace-nowrap max-[560px]:px-[0.8rem]">
                        Country
                      </th>
                      <th className="border-b border-line px-5 py-[0.85rem] text-right text-2xs font-medium tracking-wider text-ink-3 uppercase whitespace-nowrap max-[560px]:px-[0.8rem]">
                        Median
                      </th>
                      <th className="border-b border-line px-5 py-[0.85rem] text-right text-2xs font-medium tracking-wider text-ink-3 uppercase whitespace-nowrap max-[560px]:hidden">
                        Middle half
                      </th>
                      <th className="border-b border-line px-5 py-[0.85rem] text-right text-2xs font-medium tracking-wider text-ink-3 uppercase whitespace-nowrap max-[560px]:px-[0.8rem]">
                        Responses
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...published, ...pending].map((row) => (
                      <CountryRowCells key={row.name} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Reveal>
      </Container>
    </section>
  );
}

function CountryRowCells({ row }: { row: ReturnType<typeof publishableCountries>[number] }) {
  const pending = row.median === null;
  const cell = "border-b border-line px-5 py-[0.85rem] text-xs max-[560px]:px-[0.8rem] max-[560px]:text-2xs";
  const num = `${cell} figure-num text-right whitespace-nowrap`;

  return (
    <tr className={pending ? "text-ink-3" : undefined}>
      <td className={`${cell} font-semibold whitespace-nowrap max-[560px]:whitespace-normal ${pending ? "" : "text-ink"}`}>
        {row.name}
        <small className="ml-2 text-2xs font-normal tracking-wide text-ink-3 max-[560px]:ml-0 max-[560px]:block">
          {row.currency}
        </small>
      </td>
      {pending ? (
        <>
          <td className={num}>{responsesUntilPublish(row.responses)} more to publish</td>
          <td className={`${num} max-[560px]:hidden`}>—</td>
        </>
      ) : (
        <>
          <td className={num}>{row.median}</td>
          <td className={`${num} max-[560px]:hidden`}>
            {row.p25} – {row.p75}
          </td>
        </>
      )}
      <td className={num}>{count(row.responses)}</td>
    </tr>
  );
}

/* --------------------------------------------------------------- close -- */

export function Closing({ shareMessage }: { shareMessage: string }) {
  return (
    <section id="start" className="pb-[clamp(2rem,5vw,3rem)]">
      <Container slim>
        <Reveal>
          <div className="flex flex-col items-center gap-5 rounded-xl bg-wash px-[clamp(1.5rem,4vw,3rem)] py-[clamp(2.5rem,6vw,4.25rem)] text-center">
            <h2 className="max-w-[18ch] text-2xl tracking-[-0.034em]">
              The number only helps if enough of us say it.
            </h2>
            <p className="max-w-[40ch] text-ink-2">
              Every answer makes the next engineer&rsquo;s negotiation less of a guess. Yours
              included.
            </p>
            <Button href="/survey" size="lg" arrow>
              Start the survey
            </Button>
            <TrustLine items={["Anonymous", "9 questions", "~2 minutes"]} className="mt-0.5" />
          </div>
        </Reveal>

        {/* Second only to answering, and for some visitors it is first: a
            hiring manager or a lurker cannot add a salary, but they can put
            this in front of thirty people who can. */}
        <Reveal>
          <Share
            className="mt-[clamp(1rem,2.5vw,1.5rem)]"
            message={shareMessage}
            headline="Or send it to someone who will."
            blurb={
              <>
                Nothing is being advertised anywhere and there is no budget behind this. It
                reaches the next engineer because somebody forwarded it, or it does not reach
                them at all.
              </>
            }
          />
        </Reveal>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------- footer -- */

export function SiteFooter() {
  return (
    <Container>
      <footer className="mt-[clamp(3rem,6vw,4.5rem)] flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-line py-8 text-xs text-ink-3">
        <span>whatweearn — open salary data for European engineers. CC BY 4.0.</span>
        <nav className="flex flex-wrap gap-6">
          <a href="/methodology" className="no-underline hover:text-ink">
            Methodology
          </a>
          <a href="/source" className="no-underline hover:text-ink">
            Source
          </a>
          <a href="/privacy" className="no-underline hover:text-ink">
            Privacy
          </a>
          <a href="/imprint" className="no-underline hover:text-ink">
            Imprint
          </a>
        </nav>
      </footer>
    </Container>
  );
}
