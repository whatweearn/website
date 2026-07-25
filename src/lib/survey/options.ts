/**
 * Every answer the survey accepts.
 *
 * All bounded choices — there is no free-text field anywhere in this file, and
 * there must never be one. That is a promise the landing page makes, and it is
 * what stops anything personal reaching the dataset by accident.
 */

export const COUNTRIES = [
  { code: "AT", name: "Austria", currency: "EUR" },
  { code: "BE", name: "Belgium", currency: "EUR" },
  { code: "BG", name: "Bulgaria", currency: "BGN" },
  { code: "CH", name: "Switzerland", currency: "CHF" },
  { code: "CZ", name: "Czechia", currency: "CZK" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "DK", name: "Denmark", currency: "DKK" },
  { code: "EE", name: "Estonia", currency: "EUR" },
  { code: "ES", name: "Spain", currency: "EUR" },
  { code: "FI", name: "Finland", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "GR", name: "Greece", currency: "EUR" },
  { code: "HR", name: "Croatia", currency: "EUR" },
  { code: "HU", name: "Hungary", currency: "HUF" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "IT", name: "Italy", currency: "EUR" },
  { code: "LT", name: "Lithuania", currency: "EUR" },
  { code: "LV", name: "Latvia", currency: "EUR" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "NO", name: "Norway", currency: "NOK" },
  { code: "PL", name: "Poland", currency: "PLN" },
  { code: "PT", name: "Portugal", currency: "EUR" },
  { code: "RO", name: "Romania", currency: "RON" },
  { code: "RS", name: "Serbia", currency: "RSD" },
  { code: "SE", name: "Sweden", currency: "SEK" },
  { code: "SI", name: "Slovenia", currency: "EUR" },
  { code: "SK", name: "Slovakia", currency: "EUR" },
  { code: "UA", name: "Ukraine", currency: "UAH" },
  { code: "UK", name: "United Kingdom", currency: "GBP" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as unknown as [
  CountryCode,
  ...CountryCode[],
];

/**
 * Major hubs only. City drives enormous variance (Munich vs Leipzig), but a
 * long tail of small towns would make cells too thin to publish, so anything
 * else collapses into one bucket.
 */
export const CITIES: Partial<Record<CountryCode, readonly string[]>> = {
  AT: ["Vienna", "Graz", "Linz"],
  BE: ["Brussels", "Antwerp", "Ghent"],
  CH: ["Zurich", "Geneva", "Basel", "Lausanne", "Bern", "Zug"],
  CZ: ["Prague", "Brno", "Ostrava"],
  DE: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart", "Düsseldorf", "Leipzig"],
  DK: ["Copenhagen", "Aarhus"],
  ES: ["Madrid", "Barcelona", "Valencia", "Seville", "Málaga", "Bilbao"],
  FI: ["Helsinki", "Tampere", "Turku"],
  FR: ["Paris", "Lyon", "Toulouse", "Bordeaux", "Nantes", "Lille", "Marseille"],
  IE: ["Dublin", "Cork", "Galway"],
  IT: ["Milan", "Rome", "Turin", "Bologna", "Naples"],
  NL: ["Amsterdam", "Rotterdam", "Utrecht", "The Hague", "Eindhoven"],
  NO: ["Oslo", "Bergen", "Trondheim"],
  PL: ["Warsaw", "Kraków", "Wrocław", "Poznań", "Gdańsk", "Katowice", "Łódź"],
  PT: ["Lisbon", "Porto", "Braga"],
  RO: ["Bucharest", "Cluj-Napoca", "Timișoara", "Iași"],
  SE: ["Stockholm", "Gothenburg", "Malmö"],
  UK: ["London", "Manchester", "Edinburgh", "Cambridge", "Bristol", "Glasgow", "Leeds", "Birmingham"],
};

export const ELSEWHERE = "Elsewhere" as const;

export function citiesFor(country: CountryCode): readonly string[] {
  return [...(CITIES[country] ?? []), ELSEWHERE];
}

export const WORK_SETUPS = [
  { value: "onsite", label: "On-site", hint: "In an office nearly every day" },
  { value: "hybrid", label: "Hybrid", hint: "Split between office and home" },
  { value: "remote_domestic", label: "Remote, same country", hint: "Employer is in your country" },
  { value: "remote_international", label: "Remote, another country", hint: "Employer is abroad" },
] as const;

/**
 * Contract type is the field a US-shaped survey omits and the one that most
 * distorts European medians: Poland's B2B and Germany's Freiberufler carry far
 * higher gross for the same net, because the worker bears the contributions.
 */
export const CONTRACT_TYPES = [
  { value: "permanent", label: "Permanent employee", hint: "Open-ended employment contract" },
  { value: "fixed_term", label: "Fixed-term employee", hint: "Employment contract with an end date" },
  { value: "contractor", label: "Contractor / freelance", hint: "You invoice for your work" },
  { value: "b2b", label: "B2B", hint: "Company-to-company, e.g. Polish B2B or Freiberufler" },
] as const;

export const DISCIPLINES = [
  { value: "backend", label: "Backend" },
  { value: "frontend", label: "Frontend" },
  { value: "fullstack", label: "Full-stack" },
  { value: "mobile", label: "Mobile" },
  { value: "data", label: "Data / analytics" },
  { value: "ml", label: "ML / AI" },
  { value: "infra", label: "Infrastructure / SRE / DevOps" },
  { value: "security", label: "Security" },
  { value: "embedded", label: "Embedded" },
  { value: "qa", label: "QA / test" },
  { value: "other", label: "Something else" },
] as const;

export const LANGUAGES = [
  "TypeScript / JavaScript",
  "Python",
  "Java",
  "C#",
  "Go",
  "Rust",
  "PHP",
  "Ruby",
  "C / C++",
  "Kotlin",
  "Swift",
  "Scala",
  "Elixir",
  "SQL",
  "Something else",
] as const;

/**
 * Ladder positions described by scope, not title. Titles are not comparable
 * across companies; "owns delivery of a system" is.
 */
export const LEVELS = [
  { value: "junior", label: "Junior", hint: "Works on well-defined tasks with support" },
  { value: "mid", label: "Mid", hint: "Owns features end to end" },
  { value: "senior", label: "Senior", hint: "Owns a system and helps others deliver" },
  { value: "staff", label: "Staff", hint: "Drives work across several teams" },
  { value: "principal", label: "Principal", hint: "Sets technical direction org-wide" },
  { value: "manager", label: "Engineering manager", hint: "People management is the main job" },
] as const;

export const CURRENCIES = [
  "EUR",
  "GBP",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "RON",
  "BGN",
  "RSD",
  "UAH",
  "USD",
] as const;

/**
 * Spain, Portugal, Italy, Austria and Greece commonly pay 14 or 13 months.
 * Without this, "€3,000 a month" is ambiguous by up to 17%.
 */
export const PAYMENTS_PER_YEAR = [12, 13, 14] as const;

/**
 * How the amount was quoted.
 *
 * "Per year" stays the default so nothing changes for an employee, while a
 * freelancer on a day rate no longer has to do the arithmetic themselves.
 */
export const SALARY_PERIODS = [
  { value: "year", label: "a year" },
  { value: "month", label: "a month" },
  { value: "day", label: "a day" },
  { value: "hour", label: "an hour" },
] as const;

export const COMPANY_SIZES = [
  { value: "micro", label: "1–10" },
  { value: "small", label: "11–50" },
  { value: "medium", label: "51–250" },
  { value: "large", label: "251–1000" },
  { value: "xlarge", label: "1001–5000" },
  { value: "huge", label: "5000+" },
] as const;

export const COMPANY_STAGES = [
  { value: "public", label: "Publicly listed" },
  { value: "private", label: "Private" },
] as const;

export const INDUSTRIES = [
  { value: "software", label: "Software / SaaS" },
  { value: "fintech", label: "Finance / fintech" },
  { value: "ecommerce", label: "E-commerce / retail" },
  { value: "health", label: "Health / biotech" },
  { value: "gaming", label: "Gaming" },
  { value: "consulting", label: "Consulting / agency" },
  { value: "industrial", label: "Industrial / automotive" },
  { value: "telecom", label: "Telecoms" },
  { value: "public", label: "Public sector / education" },
  { value: "other", label: "Something else" },
] as const;

export function valuesOf<T extends readonly { value: string }[]>(
  list: T,
): [T[number]["value"], ...T[number]["value"][]] {
  return list.map((item) => item.value) as [T[number]["value"], ...T[number]["value"][]];
}
