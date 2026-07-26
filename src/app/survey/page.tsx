import type { Metadata } from "next";
import Link from "next/link";

import { SurveyWizard } from "@/components/survey/SurveyWizard";
import { Container } from "@/components/ui";
import { issueFormToken } from "@/lib/security/formToken";

export const metadata: Metadata = {
  title: "The survey",
  description: "Nine questions, about two minutes. Anonymous.",
  robots: { index: false, follow: true },
};

/**
 * Rendered per request so each visitor gets a freshly signed form token.
 *
 * The token proves we served the form and when, which is what makes the
 * minimum-duration check on submission meaningful. It carries no identity —
 * two people loading this page in the same millisecond receive the same token.
 */
export const dynamic = "force-dynamic";

export default async function SurveyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return (
    <main className="py-[clamp(2rem,5vw,4rem)]">
      <Container slim>
        <Link
          href="/"
          className="text-xs text-ink-3 no-underline transition-colors hover:text-ink"
        >
          ← whatweearn
        </Link>

        <div className="mt-8">
          <SurveyWizard
            formToken={issueFormToken()}
            turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            initialCountry={first("country")}
            initialLevel={first("level")}
          />
        </div>
      </Container>
    </main>
  );
}
