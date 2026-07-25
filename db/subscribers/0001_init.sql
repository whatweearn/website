-- whatweearn: subscriber list
--
-- A PHYSICALLY SEPARATE DATABASE from the one holding survey responses.
-- Different instance, different credentials, different migration directory.
-- Nothing here may reference that schema, and no application module may reach
-- both (enforced by src/lib/subscribers/boundary.test.ts).
--
-- This list exists for one purpose: telling people when results publish. It
-- carries no salary, no answer, and no way back to either.

CREATE TABLE IF NOT EXISTS subscribers (
    -- Random, not sequential. A bigserial would order rows by insertion time,
    -- which is exactly the signal the date-only columns exist to remove: with
    -- both tables append-only, an attacker could otherwise line up "the 1,203rd
    -- subscriber" against "the 4,812th response".
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    email           text        NOT NULL UNIQUE,

    -- Dates, never timestamps. Sub-second precision on both sides is what
    -- makes a response and a signup correlatable; removing it is the whole
    -- point of the design.
    subscribed_on   date        NOT NULL,
    -- Null until the double opt-in link is followed. Unconfirmed rows are
    -- purged, so an address someone never asked us to hold does not linger.
    confirmed_on    date,
    unsubscribed_on date
);

CREATE INDEX IF NOT EXISTS subscribers_pending
    ON subscribers (subscribed_on)
    WHERE confirmed_on IS NULL AND unsubscribed_on IS NULL;

-- Written when a broadcast goes out, so "when did we last email the list" is
-- answerable without keeping per-person send logs.
CREATE TABLE IF NOT EXISTS broadcasts (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sent_on     date    NOT NULL,
    subject     text    NOT NULL,
    recipients  integer NOT NULL
);
