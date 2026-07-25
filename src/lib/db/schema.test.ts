import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards on the schema itself.
 *
 * The database is unreachable from this test environment, so the queries are
 * not exercised here — that is honest and worth stating. What *is* checkable
 * is the shape of the schema, and that is where the anonymity promises either
 * hold or quietly stop holding. A column added in a hurry is exactly how a
 * design like this decays.
 */
const schema = readFileSync(join(process.cwd(), "db/migrations/0001_init.sql"), "utf8");
const normalised = schema.toLowerCase();

/** Strips comments, so prose about IP addresses does not trip the checks. */
const statements = normalised
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("responses schema", () => {
  it.each([
    ["ip", /\bip(_address)?\b\s+(text|inet|varchar)/],
    ["email", /\bemail\b/],
    ["user agent", /user_agent/],
    ["name", /\b(full_name|first_name|last_name)\b/],
    ["employer", /\bemployer\b/],
  ])("has no column for %s", (_label, pattern) => {
    expect(statements).not.toMatch(pattern);
  });

  it("stores a date, never a timestamp, for when a response arrived", () => {
    // Sub-second times are the correlation vector the entire two-store design
    // in CLAUDE.md §4 exists to defeat. A `timestamptz` here would undo it.
    expect(statements).toMatch(/submitted_on\s+date\s+not null/);
    expect(statements).not.toMatch(/submitted_on\s+timestamp/);
  });

  it("enforces one response per handle per day in the database", () => {
    // Application-level checks lose to two browser tabs; a unique index does
    // not.
    expect(statements).toMatch(
      /create unique index[\s\S]*responses[\s\S]*\(handle,\s*submitted_on\)/,
    );
  });

  it("keeps an append-only trail rather than allowing silent edits", () => {
    expect(statements).toContain("superseded_by");
    expect(statements).toContain("anomaly_log");
  });

  it("never references the subscriber store", () => {
    // The two databases are separate instances with separate credentials. A
    // foreign key between them would not merely be a bug — it would make the
    // page's central claim false.
    expect(statements).not.toMatch(/subscriber|mailing|newsletter/);
  });

  it("stores exchange rates per day so a re-run reproduces the same figures", () => {
    expect(statements).toMatch(/fx_rates/);
    expect(statements).toMatch(/primary key\s*\(rate_date,\s*currency\)/);
  });
});
