import { DistributionCard } from "@/components/DistributionCard";
import { Dock } from "@/components/Dock";
import {
  Closing,
  CountryTable,
  Hero,
  Nav,
  Payoff,
  Proof,
  SiteFooter,
  Stakes,
  SurveyPreview,
} from "@/components/sections";
import { Container } from "@/components/ui";
import { getSiteStats, hasPublishedFigures } from "@/lib/stats";

export default async function Home() {
  const stats = await getSiteStats();
  const published = hasPublishedFigures(stats);

  return (
    <>
      {/*
        Two deliberate choices here, both about the same collision.

        After every client-side navigation Next's App Router walks to the first element
        of the newly rendered segment and calls `focus()` on it. On this page that
        element is the skip link, which is the only route in the app whose first element
        is focusable at all — everywhere else it is a plain `<main>`, where the call is
        a no-op. So:

        `fixed`, not `absolute`, is what removes the collision: Next skips fixed and
        sticky elements during that walk, so it passes over this link, calls `focus()` on
        a non-focusable ancestor instead, and leaves focus on `<body>` — the link is
        neither revealed nor consuming the first Tab stop. `fixed` also keeps the pill on
        screen when it is reached by Shift+Tab from further down a scrolled page, which
        `absolute` positioned off the top of the document instead.

        `focus-visible`, not `focus`, is the narrower guard, and on its own it was enough
        to hide the pill: focus taken in the same breath as a click is attributed to the
        pointer, so Chromium does not consider it visible focus. It is kept because it is
        the right selector for a control only keyboard users ever need to see — but note
        that it does not generalise. Script focus arriving with no recent pointer event
        *does* match `:focus-visible`, so `fixed` is what actually holds this together,
        and there is no test below for this half because the router no longer reaches it.
      */}
      <a
        href="#main"
        className="sr-only fixed focus-visible:not-sr-only focus-visible:fixed focus-visible:top-0 focus-visible:left-1/2 focus-visible:z-[60] focus-visible:-translate-x-1/2 focus-visible:rounded-b-xl focus-visible:bg-ink focus-visible:px-5 focus-visible:py-3 focus-visible:text-xs focus-visible:font-semibold focus-visible:text-on-ink"
      >
        Skip to content
      </a>

      <Nav />

      <main id="main">
        <div id="top" />

        <div className="hero-glow">
          <Hero published={published} />
          {/* Spacer derived from the same token as the card's negative lift, so
              the card can never ride up over the hero copy. */}
          <div className="h-[calc(var(--card-lift)+clamp(2rem,3vw,3rem))]" />
        </div>

        <section className="bg-tint pb-[clamp(2.25rem,4vw,3.25rem)]">
          <Container>
            <DistributionCard distribution={stats.europe} lifted />
            <Proof stats={stats} />
          </Container>
        </section>

        {/*
          Order is the argument. It used to run hero → what we never ask →
          what you get, which put two screens of things we promise not to do
          in front of any reason to care. Privacy is what makes this safe to
          answer, never why anyone would want to, so the case for spending the
          two minutes now comes first and the privacy section lands as
          reassurance for somebody already interested.
        */}
        <Stakes />
        <Payoff published={published} />
        <SurveyPreview />
        <CountryTable stats={stats} />
        <Closing />
      </main>

      <SiteFooter />
      <Dock />
    </>
  );
}
