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
- [ ] **`LEGAL_CONTROLLER_ADDRESS` still holds only a town.** Belgian Book XII and the German
      DDG both require a *geographic* address — street and number — at which the operator can
      be reached. Fill it in before launch.
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

- [ ] `FORM_TOKEN_SECRET`
- [ ] `IDENTITY_SECRET`
- [ ] `SUBSCRIBER_TOKEN_SECRET`
- [ ] `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- [ ] `RESEND_API_KEY`, `EMAIL_FROM`
- [ ] `NEXT_PUBLIC_SITE_URL=https://whatweearn.eu`

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

- [ ] SPF, DKIM and DMARC configured for `whatweearn.eu` and verified.
- [ ] DMARC starts at `p=none` with reporting, tightened after a fortnight of clean data.
- [ ] A confirmation email received and its link followed, in a real client.
- [ ] One-click unsubscribe verified from a real client, not just by URL.

### Before flipping the repository public

- [ ] Privacy and methodology pages live and accurate.
- [ ] No secrets in history (`git log --all -p | grep -iE 'postgres://|re_[A-Za-z0-9]{24}'`).
- [ ] Licence confirmed: MIT for code, CC BY 4.0 for data.

---

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
