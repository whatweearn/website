import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The anonymity boundary, as an executable rule.
 *
 * CLAUDE.md §4 promises an email address can never be linked to the answers
 * someone gave. Two databases with separate credentials is how that is meant
 * to hold — but the separation is only real while no code can reach both. A
 * single module importing each client would make joining them a two-line
 * change, and nothing else in the test suite would notice.
 *
 * This is the acceptance criterion for Phase 5. It is deliberately the first
 * test in the phase.
 */

const SRC = join(process.cwd(), "src");
const SCRIPTS = join(process.cwd(), "scripts");

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

const files = [...sourceFiles(SRC), ...sourceFiles(SCRIPTS)];

/** Modules that reach the responses database. */
const RESPONSES = /["'](?:@\/lib\/db\/|\.{1,2}\/(?:lib\/)?db\/|\.{1,2}\/)(?:client|responseRepository)["']/;
/** Modules that reach the subscriber database. */
const SUBSCRIBERS = /["'][^"']*subscribers\/(?:client|repository)["']/;

describe("database separation", () => {
  it("finds source files to check, so a broken glob cannot pass vacuously", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("has no module that can reach both databases", () => {
    const offenders = files.filter((path) => {
      // The boundary test itself names both, in strings, by necessity.
      if (path.endsWith("boundary.test.ts")) return false;
      const source = readFileSync(path, "utf8");
      return RESPONSES.test(source) && SUBSCRIBERS.test(source);
    });

    expect(offenders.map((p) => p.replace(process.cwd(), ""))).toEqual([]);
  });

  it("keeps the two clients on different connection strings", () => {
    const responses = readFileSync(join(SRC, "lib/db/client.ts"), "utf8");
    const subscribers = readFileSync(join(SRC, "lib/subscribers/client.ts"), "utf8");

    expect(responses).toContain("DATABASE_URL");
    expect(responses).not.toContain("SUBSCRIBER_DATABASE_URL");
    expect(subscribers).toContain("SUBSCRIBER_DATABASE_URL");
  });

  it("never references the responses schema from the subscriber schema", () => {
    // Comments stripped: the file explains the separation in prose, and
    // prose about responses is not a reference to them.
    const statements = readFileSync(join(process.cwd(), "db/subscribers/0001_init.sql"), "utf8")
      .toLowerCase()
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");

    // A foreign key here would not merely be a bug. It would make the central
    // claim on the landing page false.
    expect(statements).not.toContain("responses");
    expect(statements).not.toContain("references");
  });
});
