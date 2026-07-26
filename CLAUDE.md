# whatweearn

An anonymous salary survey for software engineers in Europe. Public results, open data,
no accounts. The approved design has been ported into the app; the original comp was removed
once Phase 4 landed, because it carried placeholder salary figures and this repository is the
thing people audit to check the site is telling the truth.

This file is the build plan and the standing context for work in this repo. Read it before
starting a task. Update it when a decision changes.

---

## 1. The promises we have to keep

The landing page makes specific, checkable claims. They are product constraints, not copy.
If an implementation choice breaks one of these, the implementation is wrong — or the claim
has to change on the page **before** the code ships.

| Promise | What it forces |
|---|---|
| "No account" | No auth, no session identity, ever |
| "No employer names" | Company size bracket + industry only; no free-text employer field |
| "Anything free-text — never" | Every answer is a bounded choice. No open text fields anywhere in the survey |
| "Your IP — never" | IPs are never written to durable storage; dedup uses a same-day expiring hash |
| "Fewer than five responses is withheld" | Cell suppression at n<5, enforced in the aggregation layer, not the UI |
| "The code is open" | Public repo from day one, including the suppression and outlier rules |
| "Dataset opens the moment you submit" | No drip-feed, no premium tier, no email wall — **and the claim is only made once something has actually published.** Before that it is false, so the hero and payoff copy switch to the seeding version automatically (`hasPublishedFigures`). Metadata never makes the claim at all, because crawlers cache it |
| "CC BY 4.0" | The published dataset carries that licence |
| "Nine questions" | Nine *screens*. See §5 — the honest question count is higher unless we group |
| "Email optional, never linked to your answers" | The two-store design in §4 is what makes this true. If the stores are ever joined, the page is lying |

---

## 2. Decisions made — 2026-07-25

Settled. Do not reopen without updating this file.

1. **Email is notification-only** — "tell me when results publish" and "tell me about next
   year's survey". Nothing else. The architecture in §4 is therefore viable, and the feature it
   rules out is permanent: we can never email anyone about *their own* response, because no
   link exists. State that on the confirmation page.
2. **Landing page says "Email optional, never linked to your answers."** Applied to
   the landing page. The old "No email" claim and the "Your email — never asked" bullet were
   false once email exists; both replaced (§4.4).
3. **Managed hosting.** Next.js + Tailwind v4 + pnpm, Postgres in an EU region, deployed to
   Vercel `fra1`. Self-hosting is rejected, not deferred.
4. **No gender collection in v1.** Consequence to accept: **we cannot publish any pay-gap
   analysis**, which is one of the more common reasons people take these surveys and one of the
   more common reasons journalists cite them. If that becomes a goal, it is a v2 schema change
   plus a fresh consent story — retrofitting it onto existing responses is impossible. No
   demographic fields of any kind ship in v1.

---

## 3. Stack

**Next.js + Tailwind v4 + pnpm + Postgres, all EU-region.** Settled 2026-07-25.

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js, App Router** | Chosen 2026-07-25 |
| Styling | **Tailwind CSS v4** | Chosen 2026-07-25. Adopted *fully* — see §10 for the token rule |
| Package manager | **pnpm** | Chosen 2026-07-25. `packageManager` field set, lockfile committed, `pnpm dlx` never `npx` |
| Host | **Vercel, single EU region (`fra1`), not edge** | Corrected 2026-07-25. Pages are static and aggregates are pre-built JSON, so there is almost no dynamic server work for the edge to accelerate. A single region pools cleanly to Postgres (edge runtimes need Hyperdrive or equivalent for connection pooling — real complexity for no gain here) and gives a far simpler data-residency story than compute running in hundreds of locations. Strip IPs in middleware at the app boundary |
| Primary DB | Postgres, EU region (Neon or Supabase, Frankfurt) | `percentile_cont` and `width_bucket` are the whole product. Do not use SQLite/D1 here — quantiles are the thing we compute constantly |
| Subscriber store | **Separate Postgres instance, separate provider account, separate credentials** | This is the anonymity boundary. See §4 |
| Published aggregates | Static JSON, rebuilt nightly | Explorer loads instantly, the raw DB is never query-exposed, and suppression is enforced at build time rather than trusted to a query |
| Bot defence | **Cloudflare Turnstile** + honeypot + minimum-completion-time | Corrected 2026-07-25. The earlier proof-of-work pick was argued from ethos, not threat model. Our actual threat is *coordinated manipulation*, and proof-of-work only raises attacker cost linearly — a cheap VPS defeats it, while the battery cost lands on honest mobile visitors. Turnstile's browser-integrity signals address the real threat. The "no third party sees our traffic" argument was hollow anyway if Cloudflare fronts the site. Disclose Turnstile on the privacy page |
| Email sending | **Resend, transport only** | Chosen 2026-07-25. Verified: Resend stores account data, contacts and logs **in the US** regardless of sending region — `eu-west-1` only controls dispatch origin. Legal via DPF certification + SCCs in their DPA, and low-stakes here because the list carries no salary data and no link to any response (§4). Two conditions: **never use Audiences/Contacts** (list lives only in our Frankfurt Postgres, so there is one source of truth and one deletion path), and disclose the US processing on the privacy page. Swap to SES `eu-central-1` if zero-asterisk EU residency is ever required — transport-only keeps that a small change |
| Analytics | Self-hosted Umami, or none | No third-party scripts on a privacy-branded site |

### Toolchain — versions current at 2026-07-25

Pin these at scaffold; don't float on `latest`.

Installed at scaffold (Phase 0, 2026-07-25). The lockfile is the source of truth.

| | registry latest | **installed** |
|---|---|---|
| next | 16.2.11 | **16.2.11** |
| react | 19.2.8 | **19.2.4** |
| tailwindcss | 4.3.3 | **4.3.3** |
| pnpm | 11.17.0 | **11.15.1** |
| typescript | 7.0.2 | **5.9.3** |

- **We are on TypeScript 5.9.3, not 7.** `create-next-app` pins it, and that is the
  conservative path this file already recommended — Next's own template not shipping TS 7 is a
  useful signal about ecosystem readiness. Do not upgrade casually; if you do, run the full
  `pnpm check` gate and ESLint before committing.
- **React and pnpm are a patch behind latest** because the template and local install pinned
  them. Harmless; bump when there is a reason, not reflexively.
- **Tailwind v4 is CSS-first.** No `tailwind.config.js` — configuration lives in CSS via
  `@import "tailwindcss"` and `@theme`. v3 habits and v3-era examples will mislead you. Check
  the installed version's own docs.

**Rejected 2026-07-25:** self-hosting (Hetzner + Docker + Caddy). Managed it is.

**Rejected:** anything requiring a cookie banner. If we have no third-party scripts and no
tracking cookies, we don't need one — that is worth protecting.

---

## 4. The anonymity architecture

This is the part that is easy to get subtly wrong, so it is specified tightly.

### The threat

An attacker (or a future us, or a subpoena) with full database access should not be able to
determine which salary belongs to which email address. Two naive designs fail:

- `emails(response_id, …)` — a join defeats it outright.
- Separate tables, no FK, same database, written in the same request — **insertion-time
  correlation defeats it.** If response #4,812 is written at 14:03:22.418 and an email row at
  14:03:22.441, they are the same person with near-certainty.

Timing is the real attack. The design must break it.

### The design

```
  Browser                 App (fra1)               Response DB        Subscriber DB
     │                        │                     (project A)        (project B)
     │── POST /api/response ──▶ strip IP ──────────▶ INSERT ──┐
     │◀──────── 204 ──────────                                │  no id returned
     │                                                        │
     │   [ confirmation page renders; results unlocked ]      │
     │                                                        │
     │   user separately chooses to enter an email            │
     │── POST /api/subscribe ─▶ strip IP ─────────────────────┼──▶ queue
     │                                                        │      │ batched flush,
     │                                                        │      │ shuffled, ≥15 min
     │                                                        │      ▼
     │                                                        │    INSERT (date only)
```

Rules, all of which are testable:

1. **Two physically separate databases**, different provider projects, different credentials.
   The app holds two connection strings; neither role can read the other's schema.
2. **`/api/response` returns no identifier.** Nothing the client could later send back.
3. **Email is a second, user-initiated action, and never part of the survey payload.**

   *Amended 2026-07-25.* This originally required the form to live on a different page, minutes
   later, and that gap was cited as part of why the claim holds. Examining it honestly: the gap
   was never the mechanism. What defeats correlation is the storage — random UUID keys, dates
   only, and physical order randomised. Two writes five seconds apart are exactly as
   uncorrelatable as five hours apart, because **there is no time recorded to compare**. The
   form therefore sits on the confirmation screen, where it converts, and the argument for the
   delay is retired rather than quietly dropped.

   The real weakness is volume, not proximity: on a day with one response and one signup, dates
   match regardless. Signups are therefore recorded **by week** (`weekOf`), which multiplies the
   set an address could belong to by seven — and matters most during a cold start, when volume
   is lowest.
4. **Subscriber rows store a date, not a timestamp.** `subscribed_on DATE`. This alone destroys
   sub-second correlation.
5. **Batched, shuffled writes.** Queue subscribe events and flush on a ≥15-minute timer with
   the batch shuffled, so even ordering within a day carries no signal.
6. **Response rows store a coarse timestamp too** — `submitted_on DATE` plus an hour bucket at
   most. We never need more, and precise times are a correlation vector.
7. **No request-body logging anywhere.** Set this explicitly in the edge config; the default in
   most platforms logs too much.
8. **Consequence to accept:** we can never email someone about *their own* response. Not
   "we choose not to" — we structurally cannot. Say so on the page.

### Dedup without identity

Never use email for this. Use `hmac(daily_secret, ip ‖ user_agent)`, stored with a 24-hour TTL,
secret rotated daily and discarded. Catches casual double-submits; does not survive a
determined attacker, which is the correct trade for the anonymity promise.

---

## 5. The survey

### Why the naive question list produces wrong numbers

European pay data has traps that a US-shaped survey misses. Each of these silently corrupts
medians if unasked:

- **13th/14th month salary.** Standard in Spain, Portugal, Italy, Austria, Greece. Someone
  reporting "€3,000/month" may mean €36k or €42k.
- **Contract type.** Poland's B2B and Germany's Freiberufler contracts carry dramatically
  higher gross for the same net, because the worker bears social contributions. Mixing B2B and
  permanent gross figures in one median is meaningless.
- **Part-time.** 32-hour weeks are common in the Netherlands. Without FTE we understate.
- **Gross vs net.** Some countries habitually discuss net. Must be stated on every money screen.
- **Private-company equity** is a notional number. Public vs private has to be distinguished or
  the equity field is noise.

### The nine screens

Grouping tightly-related fields keeps the "nine questions" promise honest. Every input is a
bounded choice or a number — no free text.

| # | Screen | Fields | Notes |
|---|---|---|---|
| 1 | Where | Country (select), city (select of majors + "elsewhere in country") | City drives huge variance |
| 2 | Work setup | On-site / hybrid / remote-domestic / remote-international; is pay location-adjusted? | |
| 3 | Contract | Permanent / fixed-term / contractor / B2B; FTE % | **Essential.** See above |
| 4 | Role | Discipline (backend/frontend/full-stack/data/ML/infra/mobile/embedded/security/QA); primary language | |
| 5 | Seniority | Level (ladder with descriptions, not titles); years writing software professionally | Titles are not comparable across companies; descriptions are |
| 6 | Base salary | Amount + currency + period (year/month/day/hour), plus the multiplier that period needs | Freelancers think in day rates; forcing an annual figure made them guess a working year |
| 7 | Bonus | Amount actually paid last 12 months (0 allowed) | "Actually paid", never target |
| 8 | Equity | Annualised value; company public/private | Optional. Skip = no equity |
| 9 | Company | Headcount bracket; industry | No name, ever |

No demographic questions in v1 (§2.4). The survey ends at screen 9; the email prompt lives on
the confirmation page *after* submission, never inside the survey payload.

**Validation rules:** required = country, level, base salary, contract type. Everything else
optional — completion rate matters more than field coverage. Cross-field checks flag (never
block) implausible combinations: junior with 18 years' experience, base above p99.9 for country.

**UX:** one screen at a time, visible progress, back always allowed, partial state in
`localStorage` only (never server-side — a server-side draft is an identity). Pre-fill screens
1 and 5 from the landing page's `?country=&level=` params and start at screen 2.

---

## 6. Abuse and data quality

Layered, because no single measure works:

1. **Cloudflare Turnstile** on submit. Invisible to humans; behavioural and browser-integrity
   signals, which is what actually stops a motivated attacker (proof-of-work does not — see §3).
2. **Honeypot field** + minimum completion time (a sub-20-second submission is automated).
3. **Rate limit** on the rotating IP hash.
4. **Server-side plausibility bounds** per country/level; out-of-range goes to a review queue,
   not straight to rejection.
5. **Trimmed statistics.** Compute medians and quartiles after trimming at p1/p99. Publish the
   rule; never silently massage.
6. **Nightly publication, never live.** This is the strongest anti-manipulation measure we have:
   without immediate feedback, an attacker can't tell whether their submissions moved anything.
7. **Append-only responses table** with a separate revision log, so retrospective manipulation
   is detectable.
8. **Public anomaly log** — if we exclude a batch, we say so. Consistent with "the code is open".

---

## 7. Statistics and publication

- Currency converted at **ECB daily reference rates**; `fx_rates` is keyed by date so re-running
  the aggregation reproduces the same figures rather than drifting with today's rate. The raw
  amount and its currency are what get stored — never only a converted value.
- **`paymentsPerYear` is not a multiplier.** The entered base is already annual; it is context
  for local norms and a plausibility flag. Multiplying would inflate every Spanish and
  Portuguese salary by 17%.
- Cost-of-living view uses **Eurostat price level indices** (official, free, redistributable).
  Avoid Numbeo — licensing.
- **Suppression:** any cell with n<5 is withheld. A country publishes at n≥60. Both thresholds
  live in one module with tests, and the landing page quotes them — keep them in sync.
- Aggregation job emits static JSON per cut, plus the anonymised CSV for download.
- Percentiles via `percentile_cont`; property-test the stats module against a known distribution.

---

## 8. Legal

- **If responses are genuinely anonymous, GDPR does not apply to them.** That is the goal, and
  it is why §4 is strict. Get it wrong and we are processing personal data with no lawful basis.
- Email list: explicit consent, **double opt-in** (single opt-in is not defensible in Germany),
  one-click unsubscribe, deletion on request.
- Right to erasure for responses: **we cannot honour it** — we cannot identify which row is
  yours. Say this plainly before submission. It is a consequence of the design, not a dodge.
- Needed: privacy policy, methodology page, DPAs with hosting and email providers, records of
  processing for the subscriber list.
- Dataset licence CC BY 4.0, stated in the download and the repo.

---

## 9. Build plan

**Phase 0 — scaffold.** §2 is resolved. `pnpm create next-app` (TypeScript, App Router,
Tailwind), pin the versions in §3, public repo, licence, CI running lint + typecheck + tests.

**Phase 1 — the page.** Port the design comp into Next.js. Order matters: **tokens into `@theme`
first**, prove all four theme states, *then* build components — porting markup before the theme
system means restyling twice. Add `<head>`: charset, viewport, description, Open Graph,
canonical (the artifact build has none of these). **Strip every placeholder figure** — no
fabricated numbers in production, including `n = 14,206`, the country table, and the
`SEGMENTS` distribution model. Empty states instead.

**Phase 2 — survey.** Nine screens, validation, localStorage drafts, `/api/response`,
Turnstile, honeypot, rate limit. Playwright end-to-end.

**Phase 3 — stats.** *Done.* Schema, ECB ingestion, aggregation job, suppression, nightly
static build (`pnpm aggregate` → `src/data/stats.json`).

Two inclusion rules were settled here, and they decide whether the medians mean anything:

- **Headline figures cover employees only.** B2B and freelance gross carries the worker's own
  social contributions, so it is far higher for the same take-home; averaging it with employed
  gross produces a number describing nobody. Those responses stay in the dataset and get their
  own cut — they just do not contaminate "what a country pays".
- **Part-timers are excluded, not extrapolated.** Scaling a 60% contract to full time invents a
  salary nobody is paid.

The SQL now runs against real Postgres in tests, via PGlite (Postgres compiled to WebAssembly)
— `src/lib/db/migrations.test.ts` applies the migrations and exercises the unique index, the
check constraints and the `DISTINCT ON` rate lookup. Use it for any future migration: an
untested migration's first execution should never be in production.

**Phase 4 — results.** *Done.* Confirmation page, `/data` explorer with country and level
filters, thin-cell messaging, CSV download.

**The microdata tension, resolved.** The site promises a per-response CSV *and* that nothing
below five people is published. A raw row is a cut of one — releasing rows verbatim would break
the suppression promise the moment somebody sorted the file. The dataset is therefore released
under k-anonymity: cities dropped entirely (the most identifying field we hold), experience
banded into fives, pay rounded to €500 so an exact figure cannot fingerprint a row, and any
quasi-identifier combination appearing fewer than `MIN_CELL_SIZE` times withheld. See
`src/lib/stats/microdata.ts`.

**Phase 5 — email.** *Done.* Separate database and credential, `DATE`-only columns, double
opt-in, RFC 8058 one-click unsubscribe, Resend as transport only.

**Deviation from the plan, deliberate.** This phase specified queueing signups and flushing
them in shuffled batches every fifteen minutes. On a serverless platform an in-process queue
holding writes for fifteen minutes loses every pending signup when an instance recycles, which
is routine — silently discarding something a person explicitly asked for is a worse failure
than the one being defended against. The same guarantee is reached without the data loss:
random UUID primary keys (so identifiers carry no ordering), date-only columns (no sub-day
precision), and `compactDay()` rewriting a day's rows in random physical order. Residual risk
is write-ahead-log or filesystem access to *both* databases, which no application-level design
defeats.

The acceptance criterion — `src/lib/subscribers/boundary.test.ts` — was written first and is
verified to fail: a scratch module importing both clients was added, the test named it, and
passed again on removal. A guard that cannot fail is worth nothing.

Deliverability is a real risk here and is independent of provider: the list lies **dormant for
~11 months and then receives a single blast to everyone**. Dormant lists generate spam
complaints because people genuinely forget signing up, and a large first send from a cold
domain is precisely what filters punish. Therefore: SPF/DKIM/DMARC configured well before the
first send; the double opt-in confirmation goes out immediately so the sender name is
recognised a year later; and a short mid-cycle note so the results blast is not the first
contact in twelve months. Add a lint/test asserting we never call Resend's Audiences API.

**Phase 6 — launch.** *Shipped 2026-07-26 — the site is live at `whatweearn.eu` and taking
responses.* Privacy and methodology pages, security headers, WCAG 2.2 AA audit, robots/sitemap.
Operational runbook in `OPERATIONS.md` (launch checklist, backups, monitoring, incident
response). Public repository, nightly aggregation running from GitHub Actions.

Live does not mean finished, and the remaining checklist items in `OPERATIONS.md` §1 are the
current list: a monitored `privacy@` inbox, DMARC, the DPAs, and a lawyer's read of the
imprint. None of them block a response being submitted; the email ones block the first
broadcast, which is eleven months out.

The accessibility audit found real defects, not cosmetic ones:

- **The light palette had never been contrast-checked.** `--wwe-ink-3` sat at 2.89:1 on tinted
  backgrounds — every caption on the site. Dark passed because that is the theme it was designed
  and reviewed in. Tokens were re-solved numerically rather than adjusted by eye.
- **Hover states promoted the decorative coral to a text background**, giving white-on-coral at
  3.38:1 on every small and medium button. Fixed with a dedicated `--wwe-accent-hover` that
  darkens in light and brightens in dark.
- **`color-scheme` was never declared**, so native selects and inputs kept light-mode chrome
  under a dark theme.
- **The nav overflowed at 320px**, failing WCAG 2.2 reflow.
- **Large coral buttons were failing 4.5:1 the whole time, and the suite could not
  see it.** White on `--wwe-coral` is 3.38:1, which only passes under WCAG's large-text
  rule, and that rule needs 18.66px **bold** or 24px at any weight. `text-lg` is 19.3px
  and the shared button base set `font-semibold`, so it was never large text. It stayed
  hidden because the hero button sits on `hero-glow`: axe cannot resolve a gradient to one
  background colour, so it files the result as **incomplete** rather than a violation, and
  every scan here asserts only `violations`. Putting the same button on a flat surface
  failed instantly. **Treat axe `incomplete` as unreviewed, not as passing**, and re-check
  any token you have only ever seen against a gradient.

  Fixed by deleting the `coralLarge` variant rather than by forcing `font-bold`: every
  filled button is now `--wwe-accent` at 5.08:1, so size and weight are ordinary design
  choices again instead of load-bearing contrast machinery. That restores what §10 and
  `globals.css` both already said — **coral is decorative (bars, marks, washes), accent
  carries interactive text and fills.** No filled control uses the decorative token now;
  keep it that way. Weight still lives on `SIZES` in `ui.tsx` rather than `BUTTON_BASE`,
  because two competing `font-*` weight utilities on one element resolve by emission order
  and not class order, so a variant adding `font-bold` over a `font-semibold` base loses
  silently.

The CSP is the "no third-party scripts" promise made enforceable: Cloudflare Turnstile is the
only external origin allowed anywhere, so an analytics snippet added later gets blocked rather
than quietly shipped. `'unsafe-inline'` on `script-src` is a deliberate, documented trade — see
the comment in `next.config.ts`.

**Not done:** Lighthouse budgets in CI, and a load test. The site is static plus one write
endpoint, so the load profile is thin; the honest gap is that neither has been measured.

**Phase 7 — cold start.** *Current phase.* The hardest unsolved problem: the survey is worthless
below ~500 responses and there is no data to attract them with. Plan the seeding push (HN,
lobste.rs, national dev communities, EU tech newsletters) as actual work, not an afterthought.
Do not launch with fake data to prime the pump — it would destroy the one asset this project has.

The site being live changes the shape of this, not the difficulty. Everything technical is in
place and the count is zero, so from here the only thing that moves the project is reach.
Two things follow for whoever picks this up:

- **The seeding copy is load-bearing while the count is low.** `hasPublishedFigures` swaps the
  hero and payoff text automatically, so nothing needs flipping by hand — but it also means the
  first publication changes the page's claims. Re-read §1 against the live page on the day that
  happens rather than assuming the switch got every claim right.
- **The page now argues value first and privacy second, 2026-07-26.** It used to run
  hero → what we never ask → what you get, which put two screens of things we promise not
  to do in front of any reason to care. Privacy is what makes this safe to answer; it was
  never why anyone would want to. `Stakes` in `sections.tsx` carries the argument (you
  find out years late, the gap compounds, the other side already buys this data) and sits
  above `SurveyPreview`. The seeding-copy gate still applies to every claim in it: nothing
  here may promise a payoff that `hasPublishedFigures` says does not exist yet.
- **Sharing is a mechanism, not a courtesy button.** `Share` in `components/Share.tsx`
  appears on the confirmation screen (dominant, `prominent`), the landing page and the
  explorer. The message is pre-written, visible rather than hidden behind the button, and
  carries the *gap* — "Germany needs 47 more" makes the reader's two minutes consequential
  where "I answered a survey" asks for a favour. Message text lives in `lib/share.ts` with
  its own tests, because it is the only copy on the site that goes out under somebody
  else's name: third person wherever the reader may not have answered, no em dashes, and
  short enough for X once the URL takes its 23 characters. Every channel is a plain
  outbound link to a public intent URL — **never add a share SDK**, the CSP would block it
  and an e2e test asserts no third-party script reaches that page.
- **Per-country funnel data from the push is the evidence the translation question waits on**
  (§11). It only exists if the push is instrumented enough to tell where people arrived from,
  which self-hosted Umami or nothing at all makes awkward. Decide that before posting, not after.

---

## 10. Conventions

### Styling

Tailwind v4, adopted fully. The rules that keep it from degrading:

- **One source of truth for tokens.** The palette, type scale and spacing live in
  `@theme` in `src/app/globals.css`. No hex literal appears in a component — ever. If a value isn't in the theme, add it
  to the theme.
- **Theming must work in both directions.** The design responds to `prefers-color-scheme` *and*
  to an explicit `data-theme` attribute that overrides it either way. Tailwind v4 handles this
  with a custom dark variant rather than v3's `darkMode` config; **verify the exact mechanism
  against the installed version's docs at implementation time** — this is the single most
  likely thing to be silently half-broken, so test all four states (OS light/dark × attribute
  light/dark) explicitly.
- **Some components stay hand-written CSS, and that's correct.** Range-input thumbs
  (`::-webkit-slider-thumb`), the marker label edge-flip, the table's
  `background-attachment: local` scroll shadows. Utilities express these badly. Keep them in a
  component stylesheet that reads the same theme tokens — that is not "two systems", it's
  Tailwind for layout and CSS for the parts CSS does better.
- No arbitrary values (`w-[347px]`) outside those component styles. If it recurs, it's a token.
- TypeScript strict. No `any` in the stats or anonymity modules.
- Thresholds (n<5, n≥60, trim points) are named constants in one module, never inlined.
- The two database clients are separate modules with separate credentials. **A single file must
  never import both.** Enforce with a lint rule — this is the anonymity boundary in code form.
- No third-party scripts on any page.
- **Icons are inline SVG, and they all live in `src/components/icons.tsx`.** The CSP rules
  out an icon font or a CDN sprite sheet, so every glyph is hand-inlined — which is why the
  site drifted into using bare Unicode codepoints (`☀ ☾ ◐ ✓ ✕`) wherever an icon belonged.
  That is not a style choice, it is a rendering bug waiting to happen: `☀` has an emoji
  presentation on several platforms, and the rest fall back to whatever font carries them.
  Draw it instead. Icons are decorative, so they are `aria-hidden` with the control
  carrying a visible label or an `aria-label` — never an icon as the only name.
  `→` and `←` stay as text: they sit inline in a sentence, inherit font size, and one is
  animated by a transform on a text span.
- **Brand marks are copied from source, never redrawn.** Paths come from simple-icons
  (CC0) verbatim; a hand-approximated logo looks worse than no logo. LinkedIn is pinned
  from simple-icons 11.14.0, the last release before they removed it at LinkedIn's request.
- Tests: unit for stats, property tests for percentiles, Playwright for the survey funnel,
  automated a11y checks. Plus a specific test asserting no response payload contains an email
  and no subscriber row carries a sub-day timestamp.
- Never log request bodies.

---

## 11. Open questions

- Language: **English-only in v1, decided 2026-07-26** — but the contract-type options are named
  in local legal terms once the country is known (`CONTRACT_LOCAL_TERMS` in
  `src/lib/survey/options.ts`). That is a data-quality fix, not a step towards translation. The
  four categories are generic; the boundary that decides whether a response reaches a headline
  median — employee versus not — is drawn by *local* law under local names. Someone on a Polish
  umowa zlecenie or an Italian co.co.co. is not an employee, yet "Fixed-term employee" reads
  like a fair description of their situation, and choosing it puts a non-employee gross figure
  into the employees-only median where nothing downstream can detect it. Values are never
  localised, so the dataset stays comparable across countries; `options.test.ts` enforces that
  and the e2e covers the wiring.

  Full translation was rejected *for now*, not on principle, for three reasons: the seeding copy
  is temporary by design (`hasPublishedFigures` swaps it once anything publishes, so translating
  now means translating it twice); every claim in §1 would become N copies that must stay in
  sync with the code, and a stale translation is a false claim in a language we cannot audit;
  and with zero responses the bottleneck is reach, not comprehension. Revisit at first
  publication, using per-country funnel data from the seeding push as the evidence. If the
  answer becomes yes, translate the nine survey screens first — bounded choices make them
  ~200 short stable strings — and **never** machine-translate `/privacy` or `/imprint`, where
  multiple versions raise which-version-governs against a named controller.

  Outstanding, and **the site went live without it**: the local terms are researched, not
  authoritative, and still want a native speaker's review per country — a wrong contract form
  here corrupts the headline figure silently. This is now the highest-value item on the list,
  because it is the one open question that degrades data already being collected rather than
  waiting harmlessly. It is not urgent in the sense of hours: at zero responses nothing is
  wrong yet, and the seeding push naturally puts the right native speakers in front of the
  question country by country. It is urgent in the sense that the review has to keep pace with
  the first responses from each country, not trail them. Switzerland is deliberately absent
  (three working languages; picking one misleads the other two), as are BG, EE, HR, HU, LT, LV,
  RS, SI, SK and UA.
- Do we publish year-over-year, and how do we handle the same person answering twice?
- Verification: an unverifiable survey is gameable. Optional payslip verification would give a
  "verified" subset — but it collides hard with anonymity. Probably v2, probably no.
