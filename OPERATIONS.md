# Operations

Deployment, backups, monitoring and what to do when something goes wrong.
Architecture and product decisions live in `CLAUDE.md`.

---

## 1. Launch checklist

Nothing here is optional. Several items are the difference between the site's
claims being true and being marketing.

### Legal — blocking

- [x] Controller configured — **Codeetry SRL**, Mont-Saint-Guibert, Belgium, enterprise
      number 0880.250.749. Set 2026-07-25; the "not ready to collect data" alert is gone.
- [x] Full geographic address set: 8 Boucle Jean-François Breuer, 1435 Mont-Saint-Guibert.
- [ ] A monitored inbox behind `privacy@whatweearn.eu`. Erasure requests arrive there, and an
      unanswered one is a complaint to the Belgian DPA waiting to happen.
- [ ] Confirm with a lawyer that the imprint satisfies Belgian Book XII, and that operating
      this through Codeetry does not collide with client work.
- [ ] Data Processing Agreements signed with the hosting provider, both database
      providers, and Resend.
- [ ] Records of processing written for the subscriber list. Survey responses are
      anonymous and fall outside GDPR, which is exactly why the anonymity must hold.

### GitHub Actions secrets — blocking for nightly figures

- [ ] `DATABASE_URL` and `DATABASE_URL_DIRECT` set as repository secrets.
- [ ] The subscriber credentials are **not** added. The aggregation has no
      reason to reach that database, and withholding the credential is how that
      stays true rather than being a matter of trust.

### Secrets — blocking

Generate with `openssl rand -base64 32`. The app refuses to start the survey
without the first two rather than falling back to development values.

- [x] `FORM_TOKEN_SECRET` — generated 2026-07-25
- [x] `IDENTITY_SECRET` — generated 2026-07-25
- [x] `SUBSCRIBER_TOKEN_SECRET` — generated 2026-07-25

  These live only in `.env.local`. **Set them again in the hosting environment** —
  Vercel does not read that file. Rotating `IDENTITY_SECRET` costs one day of
  duplicate detection; rotating `SUBSCRIBER_TOKEN_SECRET` invalidates every
  unsubscribe link already in someone's inbox, so treat that one as permanent.
- [x] `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — issued 2026-07-25,
      **secret rotated 2026-07-26** because the original had been pasted into a chat
      transcript, which is a copy nobody controls. Verified after rotating by posting a
      dummy token to Cloudflare's siteverify: a good secret answers
      `invalid-input-response`, a bad one answers `invalid-input-secret`, which tells the
      two apart without needing a browser.
      Add `localhost` to the key's allowed hostnames if you want the widget to solve during
      local development; without it the survey correctly shows the "could not check your
      browser" path, which is worth seeing once anyway.
- [x] `RESEND_API_KEY`, `EMAIL_FROM` — set 2026-07-25. `whatweearn.eu` is verified in
      Resend (`eu-west-1`), and a confirmation email sent through the app was delivered.
- [x] `NEXT_PUBLIC_SITE_URL=https://whatweearn.eu` — **must be set wherever mail is sent
      from.** Unset, every confirmation link points at localhost and is dead on arrival;
      the send itself succeeds, so nothing looks wrong. `sendEmail` now refuses rather
      than delivering a dead link.

### Databases — blocking

- [ ] `DATABASE_URL` and `SUBSCRIBER_DATABASE_URL` point at **two different
      instances** with **different credentials**. Same instance, different schema is
      not sufficient: the separation is what makes "never linked to your answers"
      true (`CLAUDE.md` §4). See §1a for what this means on Neon.
- [ ] `pnpm verify:separation` passes.
- [ ] `pnpm db:migrate` and `pnpm db:migrate:subscribers` both run.
- [x] A throwaway submission verified end to end, then deleted — done 2026-07-25 against
      Neon. The live driver had never run outside PGlite; it works. The stored row held
      only `submitted_on` (a date), the one-way handle, and the answers: no address, no
      user agent, no sub-day timestamp. Aggregation fetched 30 real ECB rates, published
      0 medians (below threshold) and withheld the lone row from the dataset for
      k-anonymity, all as designed.

---

## 1a. Provisioning on Neon

### Two projects, not two databases

Create **two separate Neon projects**, both in `aws-eu-central-1` (Frankfurt):

| Project | Purpose | Env vars |
|---|---|---|
| `whatweearn-responses` | Survey answers | `DATABASE_URL`, `DATABASE_URL_DIRECT` |
| `whatweearn-subscribers` | Notification list | `SUBSCRIBER_DATABASE_URL`, `SUBSCRIBER_DATABASE_URL_DIRECT` |

Two databases inside one project, or two branches of one project, are **not**
sufficient. They share a compute and a credential, and the separation is the
entire basis for the claim on the landing page.

### Decided: two Neon organisations — 2026-07-25

The two projects live in **separate Neon organisations, owned by separate
logins**. One console credential therefore does not reach both, which is what
keeps the landing page's claim literally true rather than dependent on nobody
misbehaving.

| | Organisation | Project | Region |
|---|---|---|---|
| Responses | `whatweearn` | `whatweearn-responses` | `aws-eu-central-1` |
| Subscribers | *(separate org, separate login)* | `whatweearn-subscribers` | `aws-eu-central-1` |

Rules that come with that choice:

- **Do not add the responses login as a member of the subscriber organisation**,
  or vice versa. Convenience during an incident is exactly when this gets
  undone, and it would undo the property silently.
- Both logins get hardware 2FA. The separation is only as good as the weaker
  account.
- Store the subscriber credentials somewhere the responses credentials are not.

Rejected: two projects under one account (one console reaches both) and two
providers (stronger, but more moving parts than this stage warrants). If either
is ever reconsidered, change this section in the same commit — an undocumented
downgrade of this property is how a site ends up making a claim that stopped
being true.

### Verify it, do not assume it

```bash
pnpm verify:separation
```

Compares the two connection strings and fails if they resolve to one instance —
including the subtle cases: same host with different database names, or a
pooled endpoint paired with the direct endpoint of the same project. Run it
before any deploy that touches connection strings.

### Connection strings

Neon gives a pooled host (containing `-pooler`) and a direct one.

- **App** → pooled. Neon's PgBouncer supports protocol-level prepared
  statements, so `postgres.js` needs no configuration change; the earlier
  advice to disable prepared statements is obsolete.
- **Migrations** → direct, via `*_DIRECT`. Schema changes are long single
  transactions and do not belong behind a transaction-mode pooler.

### Scale to zero

Neon suspends idle computes, so the first request after quiet time pays a cold
start. Acceptable everywhere here except the nightly aggregation, which should
simply tolerate it. Do not add a keep-alive ping: it defeats the point and
costs compute hours for no benefit on a site with this traffic shape.

### Standalone scripts and `.env.local`

Next.js loads `.env.local` itself; `tsx` does not. Every script therefore runs
with `--env-file-if-exists=.env.local`. Without it the checklist fails with
"DATABASE_URL is not set" while it is plainly set, which is a genuinely
confusing five minutes.

### Order of operations

```bash
# 1. Both projects created, connection strings in .env.local
pnpm db:migrate               # responses
pnpm db:migrate:subscribers   # subscriber list

# 2. Prove the live driver works — never exercised outside PGlite
pnpm dev
#    submit the survey once, then:
pnpm aggregate                # should report 1 response, 0 published

# 3. Delete the test row before anything real arrives
#    psql "$DATABASE_URL_DIRECT" -c "DELETE FROM responses;"
```

### Email — blocking before any broadcast

- [x] SPF and DKIM configured — Resend reports the domain verified, and mail is delivering.
- [ ] DMARC still to add.
- [ ] DMARC starts at `p=none` with reporting, tightened after a fortnight of clean data.
- [ ] A confirmation email received and its link followed, in a real client.
- [ ] One-click unsubscribe verified from a real client, not just by URL.

### Before flipping the repository public

- [ ] Privacy and methodology pages live and accurate.
- [ ] No secrets in history (`git log --all -p | grep -iE 'postgres://|re_[A-Za-z0-9]{24}'`).
- [ ] Licence confirmed: MIT for code, CC BY 4.0 for data.

---

### 1b-bis. Credential rotation — 2026-07-26

Both Neon passwords and the Turnstile secret were rotated on 2026-07-26.

The responses password had to be: a malformed `DATABASE_URL` reached production,
`new URL()` threw `ERR_INVALID_URL`, and Node puts the offending input in that
error — so the connection string, password included, was written to Vercel's log
store. See `src/lib/connectionString.ts`, which now validates before the string
reaches a driver and never repeats the value in anything it throws.

The subscriber password did not demonstrably leak, and was rotated anyway. The
reasoning is worth keeping: the subscribe form is on `/data` as well as the
confirmation screen, so it was reachable during the window when that credential
was also malformed, and the evidence that nothing hit it rests on log retention
rather than on anything structural. For the database that *is* the anonymity
boundary, a two-minute rotation beats a probabilistic argument.

After any rotation, in order:

```
pnpm verify:separation                     # still two instances, not one twice
pnpm dlx tsx scripts/vercel-env.ts         # copy to Vercel
pnpm dlx vercel deploy --prod

# CI holds its own copy. Piped, never pasted — see below.
node -e 'process.stdout.write(require("node:util").parseEnv(require("node:fs").readFileSync(".env.local","utf8")).DATABASE_URL)' \
  | gh secret set DATABASE_URL
node -e 'process.stdout.write(require("node:util").parseEnv(require("node:fs").readFileSync(".env.local","utf8")).DATABASE_URL_DIRECT)' \
  | gh secret set DATABASE_URL_DIRECT
```

`verify:separation` matters most here. A copy-paste during a hurried rotation is
all it takes to point both variables at one database, and every test would still
pass while the site kept promising the two can never be joined.

**The CI step is here because omitting it broke the nightly aggregation on
2026-07-26.** Vercel is not the only consumer of the responses credential:
`.github/workflows/aggregate.yml` needs `DATABASE_URL` and `DATABASE_URL_DIRECT`
to rebuild the published figures, and those secrets are a separate copy that
`scripts/vercel-env.ts` does not reach. The rotation updated the application and
left CI on the previous day's password. Nothing alerted, because a scheduled job
that goes red on a repo nobody is watching is indistinguishable from one that
never ran. It would have surfaced as "why has nothing published?" after the
seeding push, which is the worst moment to discover it.

Two failures were stacked, and the order matters when fixing it: the secret was
*stale* **and** *malformed*, because the value had been pasted out of
`.env.local` with its trailing comment. `assertConnectionString` runs before the
driver, so the format error fires first and hides the authentication failure
underneath. Fixing only the format reveals a second, different error.

Pipe, never paste. The commands above read through Node's `parseEnv` — the same
grammar `scripts/vercel-env.ts` uses, and for the same reason its docstring
gives: quoting and comments are a grammar, not a regex. `gh secret set` takes
the value on stdin, so it reaches neither the terminal nor shell history. Every
connection string in `.env.local` carries a trailing comment, so a hand-copied
line is guaranteed to be wrong; this is designed out rather than warned about.

The subscriber credentials are deliberately absent from CI. The aggregation job
has no reason to reach that database, and not giving it the credential is how
that stays true — so `SUBSCRIBER_DATABASE_URL` must never be added as an Actions
secret, whatever a future job seems to need.

### 1b-ter. Test data purged before launch — 2026-07-26

The responses table held four rows from development, deleted on 2026-07-26
before any announcement. Two were byte-identical German rows (senior,
permanent, EUR 78,000, every optional field null); the others exercised the
day-rate feature, one of them as a permanent employee reporting a day rate,
which is not a combination a real respondent produces.

Deleted rather than marked with `excluded_reason`, because nothing had been
published or announced and launch is the natural zero point. Carrying four
permanently-excluded rows would have meant explaining test data in a public
anomaly log, where it reads as though real people were removed. Nothing was
written to `anomaly_log` for the same reason: that log is for exclusions from a
live dataset, and this predates one.

The subscriber list keeps its single confirmed row. It is a genuine completed
double opt-in belonging to the operator, it affects no published figure, and it
is a useful canary for the first real send.

### 1c. Vercel

The repo is public, so Hobby can deploy it from the org. Note that Vercel's
Hobby terms are for non-commercial use: this site is free and carries no ads,
but it is operated by a company, so if that ever stops being obviously true,
Pro is the honest answer.

```
pnpm dlx vercel@latest login
pnpm dlx vercel@latest link      # scope: whatweearn
./scripts/vercel-env.sh          # copies .env.local, with the URLs corrected
pnpm dlx vercel@latest --prod
```

Vercel does not read `.env.local`. Every variable missing from its own store is
a production-only failure, which is why the copy is scripted rather than done
by hand.

**Unlike GitHub, Vercel gets both sets of database credentials.** The
aggregation workflow is deliberately given only `DATABASE_URL` so it cannot
reach subscribers; the web app cannot work that way, because it serves both
`/api/response` and `/api/subscribe`. The separation there is enforced at the
module level instead — no file may import both clients, asserted by
`src/lib/subscribers/boundary.test.ts` on every CI run. That is a weaker
guarantee than withholding the credential, and it is the reason that test
exists.

## 2. Backups

**Two databases, two policies.** They fail independently and matter differently.

| | Responses | Subscribers |
|---|---|---|
| Loss impact | Irreplaceable. Nobody can re-answer a survey they filled in anonymously. | Recoverable but rude — people would have to re-subscribe. |
| Retention | 30 days point-in-time recovery, plus a monthly export held for a year. | 30 days point-in-time recovery. |
| Restore test | Quarterly, into a scratch instance. | Quarterly, same. |

Two rules that are easy to get wrong:

- **Never restore one database from a backup taken at a different moment than the
  other.** Skewed restore points make insertion-order correlation possible again.
  In practice: never restore only one of them from an old snapshot while the other
  stays current.
- **Backups inherit the anonymity promise.** They live in the EU, encrypted at
  rest, with access logged. A backup is a copy of the thing the whole design
  protects.

An untested backup is a hope. The quarterly restore is the part people skip.

---

## 3. Monitoring

Deliberately thin — no analytics, no session recording, nothing that would
undermine the privacy claims to watch traffic.

| Signal | Why | Alert |
|---|---|---|
| `/api/response` 5xx rate | Submissions failing silently is the worst outcome; people do not retry a two-minute survey. | > 1% over 5 min |
| `/api/response` 403 rate | A spike means Turnstile is rejecting real people — or an attack. | > 10% over 15 min |
| Nightly aggregation job | Silent failure means stale figures presented as current. | Any non-zero exit, or no run in 26 h |
| ECB rate freshness | Rates older than a few days quietly skew every converted figure. | Newest `fx_rates` row > 4 days old |
| Certificate expiry | | < 14 days |
| Both databases reachable | | 2 consecutive failures |

**Never log**: request bodies, IP addresses, email addresses, or full query
parameters from the subscribe and unsubscribe routes — those carry an address.

---

## 4. Incident response

### Suspected correlation leak — the one that ends the project

Any evidence that a response could be tied to an email address. Treat as
critical regardless of how it arrived.

1. Disable `/api/subscribe` first. Stop adding to the exposed set.
2. Establish scope: is the link *possible* or *realised*? A shared credential is
   the former; an actual join in a log is the latter.
3. Do not delete evidence while establishing scope.
4. If realised, notify the supervisory authority within 72 hours and tell every
   affected person plainly.
5. Publish a post-mortem regardless of the outcome. A project asking strangers to
   trust it with salary data does not get to handle this quietly.

### Coordinated manipulation

Suspected mass submission of invented figures.

1. Do **not** hot-fix the published numbers. Nightly publication means there is
   time to think, which is exactly why it is nightly.
2. Identify the batch by same-day handle, submission date and flags.
3. Set `excluded_reason` — never `DELETE`. The table is append-only so exclusions
   are auditable.
4. Record it in `anomaly_log` and say so publicly. An unexplained shift in a
   median is worse for trust than an explained exclusion.
5. Re-run `pnpm aggregate`.

### Database compromise

1. Rotate the affected credential; rotate both if in any doubt.
2. Rotate `IDENTITY_SECRET` and `FORM_TOKEN_SECRET`. Cost: one day of duplicate
   detection and every open form needing a reload. Cheap.
3. Responses carry no personal data, so a breach of that database is not a
   personal-data breach. A breach of the **subscriber** database is, and starts
   the 72-hour clock.

### Turnstile or Resend outage

Both fail closed by design. Turnstile unreachable means submissions are refused
— correct, but every refusal is a lost respondent, so treat a sustained outage
as user-facing and say so on the site.

---

## 5. Routine

| When | What |
|---|---|
| Nightly | GitHub Actions `aggregate.yml` at 03:20 UTC — rebuilds the figures, verifies the suppression invariants, and commits only if they changed. The commit is what redeploys the site: `stats.json` is bundled at build time, so recomputing without a rebuild changes nothing a visitor sees. |
| Weekly | Check aggregation ran; check ECB rate freshness |
| Fortnightly | `purgeUnconfirmed()` — drops addresses that never confirmed (3-week window, since signups are recorded by week) |
| Monthly | `compactWeek()` over recent weeks; dependency updates |
| Quarterly | Restore both databases into scratch instances and verify |
| Annually | Reopen the survey; re-read this document |
