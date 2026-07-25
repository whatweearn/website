# whatweearn

An anonymous salary survey for software engineers in Europe. Public results, open data,
no accounts. `landing.html` is the approved landing-page design; everything else is to build.

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
| "Dataset opens the moment you submit" | No drip-feed, no premium tier, no email wall |
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
   `landing.html`. The old "No email" claim and the "Your email — never asked" bullet were
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
3. **Email is a second, user-initiated action on the confirmation page** — not a field in the
   survey payload. The two requests are minutes apart because the human took minutes.
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
| 6 | Base salary | Amount + currency + payments per year (12/13/14) | Label: **gross, annual** |
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

- Currency converted at **ECB daily reference rates** for the submission date; store the raw
  amount, the currency, the rate used, and the converted value. Never store only the converted
  figure.
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

**Phase 1 — the page.** Port `landing.html` into Next.js. Order matters: **tokens into `@theme`
first**, prove all four theme states, *then* build components — porting markup before the theme
system means restyling twice. Add `<head>`: charset, viewport, description, Open Graph,
canonical (the artifact build has none of these). **Strip every placeholder figure** — no
fabricated numbers in production, including `n = 14,206`, the country table, and the
`SEGMENTS` distribution model. Empty states instead.

**Phase 2 — survey.** Nine screens, validation, localStorage drafts, `/api/response`,
Turnstile, honeypot, rate limit. Playwright end-to-end.

**Phase 3 — stats.** Schema, ECB rate ingestion, aggregation job, suppression module with
tests, nightly static JSON build.

**Phase 4 — results.** Confirmation page that unlocks the data, explorer with filters, thin-cell
messaging, CSV download.

**Phase 5 — email.** Separate database, separate provider account, separate credentials, queued
shuffled writes, `DATE`-only columns, double opt-in, one-click unsubscribe. Write the
correlation test *first* — it is the acceptance criterion for the whole phase.

Deliverability is a real risk here and is independent of provider: the list lies **dormant for
~11 months and then receives a single blast to everyone**. Dormant lists generate spam
complaints because people genuinely forget signing up, and a large first send from a cold
domain is precisely what filters punish. Therefore: SPF/DKIM/DMARC configured well before the
first send; the double opt-in confirmation goes out immediately so the sender name is
recognised a year later; and a short mid-cycle note so the results blast is not the first
contact in twelve months. Add a lint/test asserting we never call Resend's Audiences API.

**Phase 6 — launch.** Legal pages, a11y audit (WCAG 2.2 AA), Lighthouse, load test, backups,
monitoring, incident plan.

**Phase 7 — cold start.** The hardest unsolved problem: the survey is worthless below ~500
responses and there is no data to attract them with. Plan the seeding push (HN, lobste.rs,
national dev communities, EU tech newsletters) as actual work, not an afterthought. Do not
launch with fake data to prime the pump — it would destroy the one asset this project has.

---

## 10. Conventions

### Styling

Tailwind v4, adopted fully. The rules that keep it from degrading:

- **One source of truth for tokens.** `landing.html`'s palette, type scale and spacing move into
  `@theme`. No hex literal appears in a component — ever. If a value isn't in the theme, add it
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
- Tests: unit for stats, property tests for percentiles, Playwright for the survey funnel,
  automated a11y checks. Plus a specific test asserting no response payload contains an email
  and no subscriber row carries a sub-day timestamp.
- Never log request bodies.

---

## 11. Open questions

- Language: English-only v1? A pan-European site in one language is a real limitation.
- Do we publish year-over-year, and how do we handle the same person answering twice?
- Verification: an unverifiable survey is gameable. Optional payslip verification would give a
  "verified" subset — but it collides hard with anonymity. Probably v2, probably no.
