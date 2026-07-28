/**
 * Finding the drafts on disk.
 *
 * Split out from `facts.ts` because that module is pure and this one touches
 * `node:fs`. **Node only.** It is imported by `scripts/outreach.ts` and by the
 * guard test, never by anything the browser gets.
 *
 * It walks `outreach/` rather than `outreach/reddit/` because the push stopped
 * being Reddit-only on 2026-07-27. CLAUDE.md §9 always named four channels and
 * only one of them had drafts, which turned out to be most of why the first
 * week went the way it did.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Files under `outreach/` that are working notes rather than things to post. */
const NOT_A_POST = new Set(["README.md", "modmail.md", "do-not-post.md"]);

export type Draft = {
  /** Path relative to the outreach root, e.g. `reddit/tier-2-UK.md`. */
  name: string;
  path: string;
  /** The directory under `outreach/`, e.g. `reddit` or `hackernews`. */
  channel: string;
};

export function findDrafts(root: string): Draft[] {
  if (!existsSync(root)) return [];

  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return entry.endsWith(".md") && !NOT_A_POST.has(entry) ? [full] : [];
    });

  return walk(root)
    .map((path) => {
      const name = relative(root, path);
      return { name, path, channel: name.split("/")[0] ?? "" };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function readDraft(draft: Draft): string {
  return readFileSync(draft.path, "utf8");
}
