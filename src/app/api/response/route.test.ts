import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryRepository, setRepository } from "@/lib/repository";
import { FORM_TOKEN_LIMITS, issueFormToken } from "@/lib/security/formToken";
import { resetRateLimits } from "@/lib/security/rateLimit";

import { POST } from "./route";

const validResponse = {
  country: "DE",
  contractType: "permanent",
  level: "senior",
  baseSalary: 78_000,
  currency: "EUR",
};

/** Issued far enough in the past to clear the minimum-duration check. */
function goodToken() {
  return issueFormToken(Date.now() - FORM_TOKEN_LIMITS.MIN_FILL_MS - 1_000);
}

let repository: InMemoryRepository;

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("https://whatweearn.test/api/response", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "vitest", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  repository = new InMemoryRepository();
  setRepository(repository);
  resetRateLimits();
});

describe("POST /api/response", () => {
  it("accepts a valid submission and stores it", async () => {
    const res = await post({ response: validResponse, formToken: goodToken() });
    expect(res.status).toBe(204);
    expect(repository.size).toBe(1);
  });

  it("returns nothing that could link a person to their row", async () => {
    // The separate email store in CLAUDE.md §4 is only meaningful if the
    // client never receives a handle it could present back to us.
    const res = await post({ response: validResponse, formToken: goodToken() });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("stores no address or user agent", async () => {
    await post({ response: validResponse, formToken: goodToken() }, {
      "x-forwarded-for": "203.0.113.9",
      "user-agent": "Mozilla/5.0 Distinctive",
    });
    const stored = JSON.stringify(repository);
    expect(stored).not.toContain("203.0.113.9");
    expect(stored).not.toContain("Distinctive");
  });

  it("stores a date, not a precise timestamp", async () => {
    // Sub-second times are the correlation vector the whole design defends
    // against. See CLAUDE.md §4.
    await post({ response: validResponse, formToken: goodToken() });
    const record = JSON.parse(JSON.stringify(repository)) as {
      records: { submittedOn: string }[];
    };
    expect(record.records[0]!.submittedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("discards a filled honeypot without saying why", async () => {
    const res = await post({
      response: validResponse,
      formToken: goodToken(),
      website: "http://spam.example",
    });
    // Schema rejects it before the honeypot branch; either way nothing stores
    // and the bot learns nothing useful.
    expect([204, 400]).toContain(res.status);
    expect(repository.size).toBe(0);
  });

  it("refuses a submission faster than a human could produce", async () => {
    const res = await post({ response: validResponse, formToken: issueFormToken() });
    expect(res.status).toBe(400);
    expect(repository.size).toBe(0);
  });

  it("refuses a forged form token", async () => {
    const res = await post({ response: validResponse, formToken: "1700000000000.notasignature" });
    expect(res.status).toBe(400);
    expect(repository.size).toBe(0);
  });

  it("tells someone with a stale form that their answers survive a reload", async () => {
    const stale = issueFormToken(Date.now() - FORM_TOKEN_LIMITS.MAX_FILL_MS - 1_000);
    const res = await post({ response: validResponse, formToken: stale });
    expect(res.status).toBe(410);
    const body = (await res.json()) as { error: string };
    // Drafts are in localStorage, so this is true — and it stops someone
    // abandoning a completed survey out of fear of losing it.
    expect(body.error).toMatch(/reload/i);
  });

  it("rejects answers that are not bounded choices", async () => {
    const res = await post({
      response: { ...validResponse, country: "Neverland" },
      formToken: goodToken(),
    });
    expect(res.status).toBe(400);
    expect(repository.size).toBe(0);
  });

  it("rejects malformed JSON without throwing", async () => {
    const res = await POST(
      new Request("https://whatweearn.test/api/response", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("keeps the first answer when someone submits twice, and says so", async () => {
    const headers = { "x-forwarded-for": "198.51.100.4" };
    await post({ response: validResponse, formToken: goodToken() }, headers);
    const second = await post(
      { response: { ...validResponse, baseSalary: 999_999 }, formToken: goodToken() },
      headers,
    );

    // Silence here used to mean the confirmation screen reported the country's
    // progress as though this answer had moved it, when nothing was stored.
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ duplicate: true });
    expect(repository.size).toBe(1);
  });

  it("tells a duplicate nothing beyond the fact that it was one", async () => {
    // Still no identifier: a flag about this request cannot be presented back
    // to us later to point at a row. See CLAUDE.md §4.
    const headers = { "x-forwarded-for": "198.51.100.7" };
    await post({ response: validResponse, formToken: goodToken() }, headers);
    const second = await post({ response: validResponse, formToken: goodToken() }, headers);

    expect(Object.keys((await second.json()) as object)).toEqual(["duplicate"]);
  });

  it("rate limits a flood from one handle", async () => {
    const headers = { "x-forwarded-for": "198.51.100.55" };
    let last = await post({ response: validResponse, formToken: goodToken() }, headers);
    for (let i = 0; i < 10; i++) {
      last = await post({ response: validResponse, formToken: goodToken() }, headers);
    }
    expect(last.status).toBe(429);
    expect(last.headers.get("retry-after")).toMatch(/^\d+$/);
  });

  it("records cross-field flags without refusing the response", async () => {
    await post(
      {
        response: { ...validResponse, level: "junior", yearsExperience: 25 },
        formToken: goodToken(),
      },
    );
    const dump = JSON.parse(JSON.stringify(repository)) as {
      records: { flags: string[] }[];
    };
    expect(repository.size).toBe(1);
    expect(dump.records[0]!.flags).toContain("junior_with_long_tenure");
  });
});
