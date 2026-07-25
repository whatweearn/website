# whatweearn

An anonymous salary survey for software engineers in Europe. Public results, open data,
no accounts.

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

## Licence

Code is MIT — see [`LICENSE`](./LICENSE).

The **published dataset** is CC BY 4.0, a deliberately different licence: the data should stay
freely reusable with attribution regardless of what happens to this codebase.

## Status

Pre-launch. No responses have been collected, and no figure anywhere on the site is real yet.

`landing.html` at the repo root is the original approved design, now ported into the app. It
is retained only as a reference for the interactive distribution card, which returns in Phase 4
once there is real data to draw. It still contains the comp's placeholder statistics —
a fabricated response count and country table — so treat nothing in it as real. A test
(`src/app/markup.test.ts`) asserts none of those figures can reach a build. Delete the file
once Phase 4 lands.
