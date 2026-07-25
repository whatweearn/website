-- Let people quote pay the way they actually think about it.
--
-- Asking every respondent for "gross annual" forced a conversion in their
-- head: a Spanish employee thinks in fourteen monthly payments, a French
-- freelancer in a day rate, a Polish B2B contractor sometimes hourly. The
-- conversion was error-prone exactly where accuracy matters most.
--
-- Additive and nullable throughout. Existing rows have no period, which
-- annualise() reads as "year" — the only thing it could have meant.

ALTER TABLE responses
    ADD COLUMN IF NOT EXISTS salary_period   text
        CHECK (salary_period IS NULL OR salary_period IN ('year', 'month', 'day', 'hour')),
    -- Days and hours ACTUALLY BILLED last year, not a target. The multiplier
    -- is asked for rather than assumed: EUR 600 a day is EUR 120,000 over 200
    -- days and EUR 138,000 over 230, and choosing between those on someone
    -- else's behalf would be publishing a number nobody supplied.
    ADD COLUMN IF NOT EXISTS days_per_year   integer
        CHECK (days_per_year IS NULL OR days_per_year BETWEEN 1 AND 365),
    ADD COLUMN IF NOT EXISTS hours_per_year  integer
        CHECK (hours_per_year IS NULL OR hours_per_year BETWEEN 1 AND 4000);
