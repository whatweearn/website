-- whatweearn: initial schema
--
-- Two things are deliberately absent and must stay absent: any column that
-- could hold an address, and any column that could hold an email. The
-- subscriber list lives in a physically separate database with separate
-- credentials (CLAUDE.md §4). Nothing here may reference it.

CREATE TABLE IF NOT EXISTS responses (
    id              bigserial PRIMARY KEY,

    -- Coarse by design. A precise timestamp is the correlation vector the
    -- whole anonymity design defends against, so we store a date and stop.
    submitted_on    date        NOT NULL,

    -- One-way, salted with a secret scoped to a single day and then thrown
    -- away. Cannot be reversed to an address; cannot follow anyone across
    -- days. Present only so a duplicate can be spotted within the day.
    handle          text        NOT NULL,

    country         text        NOT NULL,
    city            text,
    work_setup      text,
    pay_location_adjusted boolean,
    contract_type   text        NOT NULL,
    fte_percent     integer,
    discipline      text,
    primary_language text,
    level           text        NOT NULL,
    years_experience integer,

    base_salary     integer     NOT NULL CHECK (base_salary >= 0),
    currency        text        NOT NULL,
    payments_per_year smallint,
    bonus           integer     CHECK (bonus IS NULL OR bonus >= 0),
    equity_annual   integer     CHECK (equity_annual IS NULL OR equity_annual >= 0),
    company_stage   text,
    company_size    text,
    industry        text,

    -- Cross-field oddities noted at submission. Never blocks a response; the
    -- review queue reads these.
    flags           text[]      NOT NULL DEFAULT '{}',

    -- Append-only: corrections are new rows plus an audit entry, so
    -- retrospective manipulation is detectable (CLAUDE.md §6).
    superseded_by   bigint      REFERENCES responses (id),
    excluded_reason text
);

-- One response per handle per day. This is the duplicate rule, enforced by
-- the database rather than by application code that could be bypassed.
CREATE UNIQUE INDEX IF NOT EXISTS responses_handle_day
    ON responses (handle, submitted_on);

CREATE INDEX IF NOT EXISTS responses_country_level
    ON responses (country, level)
    WHERE superseded_by IS NULL AND excluded_reason IS NULL;

-- European Central Bank daily reference rates, units of CURRENCY per 1 EUR.
-- Stored per day so a response is always converted at the rate that applied
-- when it was given, and a re-run of the aggregation reproduces the same
-- numbers rather than silently drifting with today's rate.
CREATE TABLE IF NOT EXISTS fx_rates (
    rate_date   date            NOT NULL,
    currency    text            NOT NULL,
    per_eur     numeric(18, 8)  NOT NULL CHECK (per_eur > 0),
    PRIMARY KEY (rate_date, currency)
);

-- Written whenever a batch is excluded, so the exclusion is public rather
-- than a silent edit to the numbers.
CREATE TABLE IF NOT EXISTS anomaly_log (
    id          bigserial PRIMARY KEY,
    logged_on   date    NOT NULL DEFAULT CURRENT_DATE,
    summary     text    NOT NULL,
    affected    integer NOT NULL
);
