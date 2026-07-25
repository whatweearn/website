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

/** "62nd" */
export function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  const last = n % 10;
  if (last === 1) return `${n}st`;
  if (last === 2) return `${n}nd`;
  if (last === 3) return `${n}rd`;
  return `${n}th`;
}

/** Plain-language reading of a percentile. */
export function percentilePhrase(p: number): string {
  if (p >= 95) return "percentile — top 5%";
  if (p >= 90) return "percentile — top 10%";
  if (p >= 75) return "percentile — upper quartile";
  if (p >= 56) return "percentile — above the middle";
  if (p >= 45) return "percentile — right on the median";
  if (p >= 25) return "percentile — below the middle";
  return "percentile — bottom quartile";
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
