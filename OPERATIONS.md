# Operations

Deployment, backups, monitoring and what to do when something goes wrong.
Architecture and product decisions live in `CLAUDE.md`.

---

## 1. Launch checklist

Nothing here is optional. Several items are the difference between the site's
claims being true and being marketing.

### Legal — blocking

- [ ] `LEGAL_CONTROLLER_NAME` and `LEGAL_CONTACT_EMAIL` set. **The privacy page
      renders a visible "not ready to collect data" alert until they are**, because
      a policy that silently omits its controller looks compliant and is not.
- [ ] A monitored inbox behind `LEGAL_CONTACT_EMAIL`. Erasure requests arrive there.
- [ ] Data Processing Agreements signed with the hosting provider, both database
      providers, and Resend.
- [ ] Records of processing written for the subscriber list. Survey responses are
      anonymous and fall outside GDPR, which is exactly why the anonymity must hold.

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
      true (`CLAUDE.md` §4).
- [ ] `pnpm db:migrate` and `pnpm db:migrate:subscribers` both run.
- [ ] A throwaway submission verified end to end, then deleted. `PostgresResponseRepository`
      is covered by PGlite for schema and query shape, but the live driver's
      parameter binding has never run against a real server.

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
| Nightly | `pnpm aggregate` — rebuilds figures and the dataset |
| Weekly | Check aggregation ran; check ECB rate freshness |
| Fortnightly | `purgeUnconfirmed()` — drops addresses that never confirmed |
| Monthly | `compactDay()` over recent days; dependency updates |
| Quarterly | Restore both databases into scratch instances and verify |
| Annually | Reopen the survey; re-read this document |
