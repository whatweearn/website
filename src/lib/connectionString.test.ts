import { describe, expect, it } from "vitest";

import {
  ConnectionStringError,
  assertConnectionString,
  describeConnection,
} from "./connectionString";

const REAL = "postgresql://neondb_owner:sup3rs3cret@ep-cold-mud-123.eu-central-1.aws.neon.tech/db";

describe("rejects the values that actually broke production", () => {
  it("catches a value copied with its quotes", () => {
    // Exactly what a `while IFS='=' read` loop produced from .env.local.
    expect(() => assertConnectionString("DATABASE_URL", `'${REAL}'`)).toThrow(/quote characters/);
  });

  it("catches a value copied with its trailing comment", () => {
    expect(() => assertConnectionString("DATABASE_URL", `${REAL}    # responses, pooled`)).toThrow(
      /trailing comment/,
    );
  });

  it("names the variable, so the message points at the cause", () => {
    expect(() => assertConnectionString("SUBSCRIBER_DATABASE_URL", "'x'")).toThrow(
      /^SUBSCRIBER_DATABASE_URL/,
    );
  });
});

describe("never repeats the credential", () => {
  const password = "sup3rs3cret";

  const broken = [
    `'${REAL}'`,
    `${REAL}   # comment`,
    `htp://${REAL}`,
    `mysql://neondb_owner:${password}@host/db`,
    `not a url at all ${password}`,
  ];

  it.each(broken)("keeps the password out of the error for %#", (value) => {
    // The whole point. Node's own ERR_INVALID_URL includes the input, which is
    // how this password reached a log store in the first place.
    let message = "";
    try {
      assertConnectionString("DATABASE_URL", value);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toBe("");
    expect(message).not.toContain(password);
    expect(message).not.toContain("neondb_owner");
  });

  it("throws a typed error so callers can handle it deliberately", () => {
    expect(() => assertConnectionString("DATABASE_URL", "")).toThrow(ConnectionStringError);
  });
});

describe("accepts what is valid", () => {
  it.each([
    REAL,
    "postgres://user:pw@localhost:5432/db",
    `${REAL}?sslmode=require&channel_binding=require`,
  ])("passes %#", (value) => {
    expect(assertConnectionString("DATABASE_URL", value)).toBe(value);
  });
});

describe("describeConnection", () => {
  it("gives something loggable", () => {
    expect(describeConnection(REAL)).toBe("ep-cold-mud-123.eu-central-1.aws.neon.tech/db");
  });

  it("drops the credentials", () => {
    const described = describeConnection(REAL);
    expect(described).not.toContain("sup3rs3cret");
    expect(described).not.toContain("neondb_owner");
  });

  it("does not throw on rubbish", () => {
    expect(describeConnection("nonsense")).toBe("(unparseable)");
  });
});
