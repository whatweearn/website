import type { RateTable } from "./convert";

/**
 * European Central Bank daily reference rates.
 *
 * Chosen over a commercial API because it is official, free, redistributable,
 * and published on a fixed schedule — which matters when the whole dataset is
 * meant to be reproducible by anyone who downloads it.
 */
const ECB_DAILY = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

export type EcbRates = {
  /** The date the ECB published these, not the date we fetched them. */
  date: string;
  rates: RateTable;
};

/**
 * Parses the ECB's daily XML.
 *
 * Deliberately a small regex reader rather than an XML dependency: the
 * document is a flat, stable list of `<Cube currency="X" rate="Y"/>` and has
 * been for two decades. If the shape ever changes this throws rather than
 * silently returning nothing, which is the behaviour we want — no rates is
 * recoverable, wrong rates are not.
 */
export function parseEcbDaily(xml: string): EcbRates {
  const date = /<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1];
  if (!date) throw new Error("ECB feed: no reference date found");

  const rates: Record<string, number> = {};
  const pattern = /<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g;
  for (const match of xml.matchAll(pattern)) {
    const value = Number(match[2]);
    if (Number.isFinite(value) && value > 0) rates[match[1]!] = value;
  }

  if (Object.keys(rates).length === 0) throw new Error("ECB feed: no rates found");

  // The feed quotes everything against the euro and so omits it.
  rates.EUR = 1;
  return { date, rates };
}

export async function fetchEcbDaily(url = ECB_DAILY): Promise<EcbRates> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`ECB feed: HTTP ${res.status}`);
  return parseEcbDaily(await res.text());
}
