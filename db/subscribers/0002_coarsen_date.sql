-- Widen the anonymity set at low volume.
--
-- Both stores already record dates rather than timestamps, which defeats
-- correlation whenever a day holds a reasonable number of each. It does not
-- help on a day with one response and one signup — trivially matched by date
-- alone, regardless of how far apart they arrived or which page they came
-- from. That is exactly the position during a cold start, when volume is
-- lowest and the list is smallest.
--
-- Storing the Monday of the week instead of the day multiplies the set this
-- address could belong to by seven, for no functional cost: the column's only
-- job is expiring addresses that never confirmed.

ALTER TABLE subscribers RENAME COLUMN subscribed_on TO subscribed_week;

COMMENT ON COLUMN subscribers.subscribed_week IS
    'Monday of the week the address was given. Deliberately coarser than a '
    'day: see 0002_coarsen_date.sql.';

DROP INDEX IF EXISTS subscribers_pending;
CREATE INDEX IF NOT EXISTS subscribers_pending
    ON subscribers (subscribed_week)
    WHERE confirmed_on IS NULL AND unsubscribed_on IS NULL;
