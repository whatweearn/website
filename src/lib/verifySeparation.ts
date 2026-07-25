/**
 * Checks that the two databases really are two databases.
 *
 * The anonymity claim rests on responses and subscribers living on separate
 * instances. That is an operational property, and operational properties drift:
 * a copy-pasted connection string during a hurried deploy would silently
 * collapse the separation while every test still passed and the site kept
 * telling people their email could never be linked to their answers.
 *
 * Deliberately a pure string comparison in its own module. It never opens a
 * connection, so it does not breach the rule that no module may reach both
 * databases — it exists precisely to confirm that rule still means something.
 */

export type SeparationResult =
  | { ok: true; responsesHost: string; subscribersHost: string }
  | { ok: false; reason: string };

/**
 * Normalises a Postgres URL down to the instance it addresses.
 *
 * Neon exposes each project on two hosts — a pooled one carrying `-pooler` and
 * a direct one — so those are folded together. Two URLs differing only by the
 * pooler suffix are the *same* project, and treating them as separate would be
 * the exact mistake this guard exists to catch.
 */
export function instanceOf(url: string): string | null {
  try {
    const { hostname, port } = new URL(url);
    return `${hostname.replace(/-pooler(?=\.)/, "")}:${port || "5432"}`.toLowerCase();
  } catch {
    return null;
  }
}

export function verifySeparation(
  responsesUrl: string | undefined,
  subscribersUrl: string | undefined,
): SeparationResult {
  if (!responsesUrl) return { ok: false, reason: "DATABASE_URL is not set" };
  if (!subscribersUrl) return { ok: false, reason: "SUBSCRIBER_DATABASE_URL is not set" };

  const responses = instanceOf(responsesUrl);
  const subscribers = instanceOf(subscribersUrl);

  if (!responses) return { ok: false, reason: "DATABASE_URL is not a valid connection string" };
  if (!subscribers) {
    return { ok: false, reason: "SUBSCRIBER_DATABASE_URL is not a valid connection string" };
  }

  if (responses === subscribers) {
    return {
      ok: false,
      reason:
        `Both databases resolve to the same instance (${responses}). ` +
        "Separate schemas or database names on one instance are not sufficient: the site " +
        "tells people their email address can never be linked to their answers, and one " +
        "credential reaching both makes that untrue.",
    };
  }

  return { ok: true, responsesHost: responses, subscribersHost: subscribers };
}
