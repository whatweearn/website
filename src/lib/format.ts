const EURO = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const COUNT = new Intl.NumberFormat("en-GB");

/** "€62,000" */
export function euro(value: number): string {
  return EURO.format(value);
}

/** "€62k" — for axis ticks, where the full figure is noise. */
export function euroCompact(value: number): string {
  return `€${Math.round(value / 1000)}k`;
}

/** "14,206" */
export function count(value: number): string {
  return COUNT.format(value);
}

/** "62nd", and "111th" rather than "111st". */
export function ordinal(n: number): string {
  const teens = n % 100;
  if (teens >= 11 && teens <= 13) return `${n}th`;
  const last = n % 10;
  if (last === 1) return `${n}st`;
  if (last === 2) return `${n}nd`;
  if (last === 3) return `${n}rd`;
  return `${n}th`;
}

/**
 * Country names that take a definite article in running text.
 *
 * Two of the twenty-nine, and both read as broken English without it:
 * "United Kingdom needs 58 more" is the kind of thing that makes a reader
 * assume the whole page was generated. It matters most in the share copy,
 * which goes out under somebody else's name.
 */
const ARTICLED = new Set(["Netherlands", "United Kingdom"]);

/** "the Netherlands", but "Germany". */
export function withArticle(name: string): string {
  return ARTICLED.has(name) ? `the ${name}` : name;
}

/** Plain-language reading of a percentile. */
export function percentilePhrase(p: number): string {
  if (p >= 95) return "percentile, top 5%";
  if (p >= 90) return "percentile, top 10%";
  if (p >= 75) return "percentile, upper quartile";
  if (p >= 56) return "percentile, above the middle";
  if (p >= 45) return "percentile, right on the median";
  if (p >= 25) return "percentile, below the middle";
  return "percentile, bottom quartile";
}

/**
 * Gap to the median, in words.
 *
 * This is the line that actually lands: "€12,400 below the median" reads far
 * harder than a percentile, because it names what the secrecy costs you.
 */
export function medianGapPhrase(value: number, median: number): string {
  const gap = value - median;
  if (Math.abs(gap) < 1500) return `level with the ${euro(median)} median`;
  return `${euro(Math.abs(gap))} ${gap > 0 ? "above" : "below"} the median`;
}
