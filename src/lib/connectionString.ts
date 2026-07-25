/**
 * Validates a Postgres connection string without ever repeating it.
 *
 * ## Why this exists
 *
 * A deployment script copied `DATABASE_URL` out of `.env.local` with its
 * surrounding quotes and trailing comment still attached. The value reached
 * production, the first submission called `new URL()` on it, and Node threw
 * `ERR_INVALID_URL` — with the offending input included in the error, as it
 * always does. That error was written to the platform's log store, and the
 * database password went with it.
 *
 * The malformed value was one bug. The password in the logs was a second, worse
 * one, and it was caused entirely by letting a raw connection string reach any
 * code that formats errors. Nothing here ever puts the value in a message.
 *
 * The check runs before the string is handed to a driver, so the failure is a
 * clear startup error naming the variable rather than a stack trace from inside
 * a connection pool.
 */

const POSTGRES = new Set(["postgres:", "postgresql:"]);

export class ConnectionStringError extends Error {
  constructor(variable: string, problem: string) {
    super(`${variable} is not a usable Postgres connection string: ${problem}`);
    this.name = "ConnectionStringError";
  }
}

/**
 * @param variable Name of the environment variable, used only in error text.
 * @param value    The connection string. Never appears in any thrown message.
 * @returns The value unchanged, so callers can validate inline.
 */
export function assertConnectionString(variable: string, value: string): string {
  if (!value.trim()) {
    throw new ConnectionStringError(variable, "it is empty");
  }

  // The exact failure that caused this module. Worth naming precisely, because
  // "invalid URL" sends you looking at the database rather than at the copy.
  if (/^["']|["']$/.test(value.trim())) {
    throw new ConnectionStringError(
      variable,
      "it still has quote characters around it — the value was copied verbatim from a shell " +
        "or dotenv file instead of being parsed",
    );
  }

  if (/\s#/.test(value)) {
    throw new ConnectionStringError(
      variable,
      "it has a trailing comment attached — the value was copied verbatim from a dotenv file " +
        "instead of being parsed",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    // Deliberately not forwarding the cause: Node puts the whole string,
    // credentials included, into its own message.
    throw new ConnectionStringError(variable, "it is not a valid URL");
  }

  if (!POSTGRES.has(parsed.protocol)) {
    throw new ConnectionStringError(
      variable,
      `its scheme is "${parsed.protocol.replace(":", "")}", not postgres`,
    );
  }

  if (!parsed.hostname) {
    throw new ConnectionStringError(variable, "it has no host");
  }

  return value;
}

/** A form of the string safe to log: host and database only, never credentials. */
export function describeConnection(value: string): string {
  try {
    const parsed = new URL(value);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "(unparseable)";
  }
}
