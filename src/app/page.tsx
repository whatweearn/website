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
  SurveyPreview,
} from "@/components/sections";
import { Container } from "@/components/ui";
import { getSiteStats } from "@/lib/stats";

export default async function Home() {
  const stats = await getSiteStats();

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-1/2 focus:z-[60] focus:-translate-x-1/2 focus:rounded-b-xl focus:bg-ink focus:px-5 focus:py-3 focus:text-xs focus:font-semibold focus:text-on-ink"
      >
        Skip to content
      </a>

      <Nav />

      <main id="main">
        <div id="top" />

        <div className="hero-glow">
          <Hero />
          {/* Spacer derived from the same token as the card's negative lift, so
              the card can never ride up over the hero copy. */}
          <div className="h-[calc(var(--card-lift)+clamp(2rem,3vw,3rem))]" />
        </div>

        <section className="bg-tint pb-[clamp(2.25rem,4vw,3.25rem)]">
          <Container>
            <DistributionCard distribution={stats.europe} />
            <Proof stats={stats} />
          </Container>
        </section>

        <SurveyPreview />
        <Payoff />
        <CountryTable stats={stats} />
        <Closing />
      </main>

      <SiteFooter />
      <Dock />
    </>
  );
}
