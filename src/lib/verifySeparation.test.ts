import { describe, expect, it } from "vitest";

import { instanceOf, verifySeparation } from "./verifySeparation";

const RESPONSES = "postgresql://u:p@ep-aaa-111-pooler.eu-central-1.aws.neon.tech/main?sslmode=require";
const SUBSCRIBERS = "postgresql://u:p@ep-bbb-222-pooler.eu-central-1.aws.neon.tech/main?sslmode=require";

describe("instanceOf", () => {
  it("folds Neon's pooled and direct hosts onto one instance", () => {
    // The pooled and direct endpoints of a project are the same project.
    // Treating them as separate is the exact mistake this guard exists to stop.
    expect(instanceOf("postgresql://u:p@ep-aaa-111-pooler.eu.aws.neon.tech/main")).toBe(
      instanceOf("postgresql://u:p@ep-aaa-111.eu.aws.neon.tech/main"),
    );
  });

  it("ignores credentials and database name", () => {
    expect(instanceOf("postgresql://alice:x@host.example/responses")).toBe(
      instanceOf("postgresql://bob:y@host.example/subscribers"),
    );
  });

  it("distinguishes ports", () => {
    expect(instanceOf("postgresql://u:p@host.example:5432/db")).not.toBe(
      instanceOf("postgresql://u:p@host.example:5433/db"),
    );
  });

  it("returns null for nonsense rather than throwing", () => {
    expect(instanceOf("not a url")).toBeNull();
  });
});

describe("verifySeparation", () => {
  it("passes when the two point at different instances", () => {
    const result = verifySeparation(RESPONSES, SUBSCRIBERS);
    expect(result.ok).toBe(true);
  });

  it("fails when both point at the same instance", () => {
    const result = verifySeparation(RESPONSES, RESPONSES);
    expect(result.ok).toBe(false);
  });

  it("fails when they differ only by database name on one instance", () => {
    // The tempting shortcut, and the one that quietly makes the site's central
    // claim false while every test still passes.
    const result = verifySeparation(
      "postgresql://u:p@one.host/responses",
      "postgresql://u:p@one.host/subscribers",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/same instance/);
  });

  it("fails when one is a pooled endpoint of the other's project", () => {
    const result = verifySeparation(
      "postgresql://u:p@ep-aaa-111-pooler.eu.aws.neon.tech/main",
      "postgresql://u:p@ep-aaa-111.eu.aws.neon.tech/main",
    );
    expect(result.ok).toBe(false);
  });

  it("names which variable is missing", () => {
    expect(verifySeparation(undefined, SUBSCRIBERS)).toMatchObject({
      ok: false,
      reason: expect.stringContaining("DATABASE_URL"),
    });
    expect(verifySeparation(RESPONSES, undefined)).toMatchObject({
      ok: false,
      reason: expect.stringContaining("SUBSCRIBER_DATABASE_URL"),
    });
  });

  it("rejects a malformed connection string rather than passing it through", () => {
    expect(verifySeparation("garbage", SUBSCRIBERS).ok).toBe(false);
  });
});
