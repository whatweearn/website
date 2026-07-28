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
 *
 * Every country carries at least its capital, and the type enforces both
 * halves of that: `Record` rather than `Partial<Record>` means a country added
 * to {@link COUNTRIES} without cities fails the build, and the non-empty tuple
 * means an empty array does too. Eleven countries previously had no entry at
 * all, which left the respondent a select whose only option was "Elsewhere" —
 * elsewhere than what? — under a hint telling them to pick the nearest.
 *
 * Adding hubs costs nothing in disclosure: city is never aggregated into a
 * published cut, and `microdata.ts` drops it from the released dataset
 * outright as the most identifying field held.
 */
export const CITIES: Record<CountryCode, readonly [string, ...string[]]> = {
  AT: ["Vienna", "Graz", "Linz"],
  BE: ["Brussels", "Antwerp", "Ghent"],
  BG: ["Sofia", "Plovdiv", "Varna"],
  CH: ["Zurich", "Geneva", "Basel", "Lausanne", "Bern", "Zug"],
  CZ: ["Prague", "Brno", "Ostrava"],
  DE: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart", "Düsseldorf", "Leipzig"],
  DK: ["Copenhagen", "Aarhus"],
  EE: ["Tallinn", "Tartu"],
  ES: ["Madrid", "Barcelona", "Valencia", "Seville", "Málaga", "Bilbao"],
  FI: ["Helsinki", "Tampere", "Turku"],
  FR: ["Paris", "Lyon", "Toulouse", "Bordeaux", "Nantes", "Lille", "Marseille"],
  GR: ["Athens", "Thessaloniki"],
  HR: ["Zagreb", "Split", "Rijeka"],
  HU: ["Budapest", "Debrecen", "Szeged"],
  IE: ["Dublin", "Cork", "Galway"],
  IT: ["Milan", "Rome", "Turin", "Bologna", "Naples"],
  LT: ["Vilnius", "Kaunas"],
  // Riga alone: Latvian software employment is concentrated there to a degree
  // that a second entry would be a cell that never clears MIN_CELL_SIZE.
  LV: ["Riga"],
  NL: ["Amsterdam", "Rotterdam", "Utrecht", "The Hague", "Eindhoven"],
  NO: ["Oslo", "Bergen", "Trondheim"],
  PL: ["Warsaw", "Kraków", "Wrocław", "Poznań", "Gdańsk", "Katowice", "Łódź"],
  PT: ["Lisbon", "Porto", "Braga"],
  RO: ["Bucharest", "Cluj-Napoca", "Timișoara", "Iași"],
  RS: ["Belgrade", "Novi Sad", "Niš"],
  SE: ["Stockholm", "Gothenburg", "Malmö"],
  SI: ["Ljubljana", "Maribor"],
  SK: ["Bratislava", "Košice"],
  UA: ["Kyiv", "Lviv", "Kharkiv", "Dnipro"],
  UK: ["London", "Manchester", "Edinburgh", "Cambridge", "Bristol", "Glasgow", "Leeds", "Birmingham"],
};

export const ELSEWHERE = "Elsewhere" as const;

export function citiesFor(country: CountryCode): readonly string[] {
  return [...CITIES[country], ELSEWHERE];
}

export const WORK_SETUPS = [
  { value: "onsite", label: "On-site", hint: "In an office nearly every day" },
  { value: "hybrid", label: "Hybrid", hint: "Split between office and home" },
  { value: "remote_domestic", label: "Remote, same country", hint: "Employer is in your country" },
  { value: "remote_international", label: "Remote, another country", hint: "Employer is abroad" },
] as const;

export type WorkSetup = (typeof WORK_SETUPS)[number]["value"];

/**
 * Whether where you live and where your employer is can differ.
 *
 * This is what decides whether asking "is your pay adjusted for where you
 * live?" means anything. On-site and hybrid both imply commuting distance, so
 * the answer is either tautological or a comment on the employer's banding,
 * and both readings get recorded in one boolean — noise, on the majority of
 * respondents. City is already asked on screen 1 and carries the geography for
 * them. Remote is the case where the two places come apart, and it is the case
 * within a country as much as across one: a Berlin employer either pays the
 * Berlin band into Leipzig or adjusts it down, which is precisely the question.
 */
export function isRemoteSetup(workSetup: string | undefined): boolean {
  return workSetup === "remote_domestic" || workSetup === "remote_international";
}

/**
 * Contract type is the field a US-shaped survey omits and the one that most
 * distorts European medians: Poland's B2B and Germany's Freiberufler carry far
 * higher gross for the same net, because the worker bears the contributions.
 */
export const CONTRACT_TYPES = [
  { value: "permanent", label: "Permanent employee", hint: "Open-ended employment contract" },
  { value: "fixed_term", label: "Fixed-term employee", hint: "Employment contract with an end date" },
  { value: "contractor", label: "Contractor / freelance", hint: "You invoice for your work" },
  { value: "b2b", label: "B2B", hint: "Company-to-company, through your own business" },
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number]["value"];

/**
 * The local name for each contract type, shown once the country is known.
 *
 * This is a data-quality measure, not a translation. The generic English
 * labels describe four categories accurately and still fail in practice,
 * because the boundary that decides which figures a response joins — employee
 * versus not — is drawn by *local* law under local names. Somebody on a Polish
 * umowa zlecenie or an Italian co.co.co. is not an employee, but "Fixed-term
 * employee" reads like a fair description of their situation. Picking it puts
 * a non-employee gross figure into the employee median, which is precisely the
 * contamination {@link populationOf} keeps the two populations apart to
 * prevent, and nothing downstream can detect it.
 *
 * Only the hint changes. Values are never localised: the stored answer is the
 * same token whatever the respondent read, so the dataset stays language-
 * independent and comparable across countries. `options.test.ts` enforces that.
 *
 * Countries are absent rather than guessed. An omission falls back to the
 * generic hint, which is merely unhelpful; a wrong legal term is worse than
 * none, because it invites exactly the misclassification this is meant to fix.
 * Switzerland is deliberately absent — it has three working languages and
 * picking one would mislead the other two.
 *
 * TODO: these need review by a native speaker per country. They are
 * researched, not authoritative, and a mistranslated contract form here
 * silently moves a response into the wrong population.
 */
export const CONTRACT_LOCAL_TERMS: Partial<
  Record<CountryCode, Partial<Record<ContractType, string>>>
> = {
  AT: {
    permanent: "Unbefristeter Dienstvertrag",
    fixed_term: "Befristeter Dienstvertrag",
    contractor: "Freier Dienstvertrag oder Werkvertrag",
    b2b: "Über eine eigene Firma (GmbH)",
  },
  BE: {
    permanent: "Contract onbepaalde duur / CDI",
    fixed_term: "Contract bepaalde duur / CDD",
    contractor: "Zelfstandige / indépendant",
    b2b: "Via je eigen vennootschap / via votre société",
  },
  CZ: {
    permanent: "Pracovní smlouva na dobu neurčitou",
    fixed_term: "Pracovní smlouva na dobu určitou",
    contractor: "OSVČ (na IČO)",
    b2b: "Přes vlastní s.r.o.",
  },
  DE: {
    permanent: "Unbefristeter Arbeitsvertrag",
    fixed_term: "Befristeter Arbeitsvertrag",
    contractor: "Freiberuflich, auf Rechnung",
    b2b: "Über eine eigene GmbH oder UG",
  },
  DK: {
    permanent: "Fastansættelse",
    fixed_term: "Tidsbegrænset ansættelse",
    contractor: "Freelance / selvstændig",
    b2b: "Gennem eget selskab (ApS)",
  },
  ES: {
    permanent: "Contrato indefinido",
    fixed_term: "Contrato temporal",
    contractor: "Autónomo",
    b2b: "A través de tu propia sociedad (SL)",
  },
  FI: {
    permanent: "Toistaiseksi voimassa oleva työsopimus",
    fixed_term: "Määräaikainen työsopimus",
    contractor: "Toiminimi tai kevytyrittäjyys",
    b2b: "Oman yrityksen kautta (Oy)",
  },
  FR: {
    permanent: "CDI",
    fixed_term: "CDD",
    contractor: "Freelance / auto-entrepreneur",
    b2b: "Via votre société (SASU, EURL)",
  },
  GR: {
    permanent: "Σύμβαση αορίστου χρόνου",
    fixed_term: "Σύμβαση ορισμένου χρόνου",
    contractor: "Μπλοκάκι — ελεύθερος επαγγελματίας",
    b2b: "Μέσω δικής σου εταιρείας",
  },
  IE: {
    permanent: "Permanent contract of employment",
    fixed_term: "Fixed-term or specified-purpose contract",
    contractor: "Sole trader contractor",
    b2b: "Through your own limited company",
  },
  IT: {
    permanent: "Contratto a tempo indeterminato",
    fixed_term: "Contratto a tempo determinato o co.co.co.",
    contractor: "Partita IVA",
    b2b: "Tramite la tua società (SRL)",
  },
  NL: {
    permanent: "Vast contract, onbepaalde tijd",
    fixed_term: "Tijdelijk contract, bepaalde tijd",
    contractor: "ZZP'er",
    b2b: "Via je eigen BV",
  },
  NO: {
    permanent: "Fast ansettelse",
    fixed_term: "Midlertidig ansettelse",
    contractor: "Frilans / selvstendig",
    b2b: "Gjennom eget selskap (AS)",
  },
  PL: {
    permanent: "Umowa o pracę na czas nieokreślony",
    fixed_term: "Umowa o pracę na czas określony",
    contractor: "Umowa zlecenie lub umowa o dzieło",
    b2b: "Kontrakt B2B (JDG)",
  },
  PT: {
    permanent: "Contrato sem termo",
    fixed_term: "Contrato a termo",
    contractor: "Recibos verdes — trabalhador independente",
    b2b: "Através da tua empresa (Lda.)",
  },
  RO: {
    permanent: "Contract individual de muncă, perioadă nedeterminată",
    fixed_term: "Contract individual de muncă, perioadă determinată",
    contractor: "PFA sau întreprindere individuală",
    b2b: "Prin propria firmă (SRL)",
  },
  SE: {
    permanent: "Tillsvidareanställning",
    fixed_term: "Visstidsanställning",
    contractor: "Frilans / egenanställd",
    b2b: "Via eget bolag (AB)",
  },
  UK: {
    permanent: "Permanent contract of employment",
    fixed_term: "Fixed-term contract",
    contractor: "Sole trader, umbrella, or inside IR35",
    b2b: "Own limited company, outside IR35",
  },
};

/**
 * The contract options to show, named the way the respondent's own payslip
 * names them once {@link COUNTRIES} has been answered.
 *
 * Order and values are identical in every country, so this cannot change what
 * gets stored — only what the respondent reads while choosing.
 */
export function contractTypesFor(
  country?: CountryCode,
): readonly { value: ContractType; label: string; hint: string }[] {
  const local = country ? CONTRACT_LOCAL_TERMS[country] : undefined;
  return CONTRACT_TYPES.map((option) => ({
    value: option.value,
    label: option.label,
    hint: local?.[option.value] ?? option.hint,
  }));
}

/**
 * What the respondent works on — the technical domain, not the job.
 *
 * Architecture is deliberately absent: it is a level, because it describes
 * scope rather than subject matter. An architect still came up through, and
 * usually still works in, one of these. Listing it in both places would split
 * architects across two answers that mean the same thing, and every cut would
 * thin out for no gain.
 */
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
 *
 * Two of these are parallel tracks rather than rungs. Engineering manager was
 * always one; architect is the same shape and was missing, so architects had to
 * claim staff or principal — a rung whose description ("drives work across
 * several teams", "sets technical direction org-wide") describes someone who is
 * still on a delivery team. Every entry carries a hint for exactly this reason.
 */
export const LEVELS = [
  { value: "junior", label: "Junior", hint: "Works on well-defined tasks with support" },
  { value: "mid", label: "Mid", hint: "Owns features end to end" },
  { value: "senior", label: "Senior", hint: "Owns a system and helps others deliver" },
  { value: "staff", label: "Staff", hint: "Drives work across several teams" },
  { value: "principal", label: "Principal", hint: "Sets technical direction org-wide" },
  {
    value: "architect",
    label: "Architect",
    hint: "Designs systems other teams build, rather than delivering on one",
  },
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
