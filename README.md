# whatweearn

An anonymous salary survey for software engineers in Europe. Public results, open data,
no accounts.

**Live at [whatweearn.eu](https://whatweearn.eu).**

The survey is anonymous by construction rather than by policy: there are no accounts, IP
addresses are never stored, every answer is a bounded choice, and any cut of the data with
fewer than five responses is withheld. If you leave an email address to hear when results
publish, it goes to a physically separate database with no link back to your answers — which
also means we can never email you about your own numbers.

The mechanisms behind those claims are in [`CLAUDE.md`](./CLAUDE.md), which is the project's
build plan and the record of every architectural decision. Read it before contributing.

## Getting started

```bash
pnpm install
pnpm dev
```

## Scripts

| | |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest, once |
| `pnpm test:watch` | Vitest, watching |
| `pnpm check` | Lint + typecheck + test — the same gate CI runs |
| `pnpm e2e` | Playwright, desktop and mobile |
| `pnpm db:migrate` | Apply response-database migrations |
| `pnpm db:migrate:subscribers` | Apply subscriber-database migrations (separate instance) |
| `pnpm verify:separation` | Prove the two databases are two instances, not one twice |
| `pnpm aggregate` | Rebuild `src/data/stats.json` from the database |

## Operations

Deployment, backups, monitoring and incident response are in
[`OPERATIONS.md`](./OPERATIONS.md), including the launch checklist and the items
still open on it. A deployment without a configured data controller says so
loudly on the pages that need one, rather than rendering a privacy policy with a
hole in it.

## Licence

Code is MIT — see [`LICENSE`](./LICENSE).

The **published dataset** is CC BY 4.0, a deliberately different licence: the data should stay
freely reusable with attribution regardless of what happens to this codebase.

## Status

**Live and open for responses. Nothing has published yet.** No responses have been collected,
so no figure anywhere on the site is real: every cut is an empty state, and the landing copy is
the seeding version, which does not make the "dataset opens the moment you submit" claim
because that claim would be false today. Both switch over on their own the first time an
aggregation publishes anything — `hasPublishedFigures` in `src/lib/stats.ts` decides, so there
is no flag to remember to flip.

Attracting the first few hundred responses is the open problem, not a finished launch. Until
then the explorer says "Nobody here yet" rather than showing a number, which is the honest
thing for it to say.

The site renders from `src/data/stats.json`, rebuilt nightly by `pnpm aggregate` — GitHub
Actions at 03:20 UTC, committing only when the figures change, because the commit is what
redeploys. Suppression is applied when that file is written, so anything withheld is genuinely
absent from it rather than hidden by the UI. Without a `DATABASE_URL` the job writes the empty
dataset, which is why a fresh clone shows empty states rather than stale numbers.

The original design comp has been removed now that it is fully ported. It contained
placeholder salary figures, and a repository whose whole purpose is verifying that the site
tells the truth is no place to leave invented numbers lying around. It remains in git history
(`git show 116180c:landing.html`) if the styling of the distribution card ever needs checking
against the original.
