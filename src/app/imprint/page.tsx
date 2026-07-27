import type { Metadata } from "next";

import { LegalPage, MissingController, Points, Section } from "@/components/legal";
import { SOURCE_URL, getController } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Imprint",
  description: "Who operates whatweearn.",
  alternates: { canonical: "/imprint" },
};

export const dynamic = "force-dynamic";

/**
 * Legally mandated operator identification.
 *
 * Separate from the privacy policy and required by a different law. Belgium's
 * Code of Economic Law (Book XII) obliges an information society service to
 * identify itself; Germany's DDG requires an Impressum, and several other
 * countries have equivalents. A site aimed at German and Austrian engineers,
 * operated by a company, is squarely the case those rules exist for.
 */
export default function ImprintPage() {
  const controller = getController();

  return (
    <LegalPage
      title="Imprint"
      updated="25 July 2026"
      intro="Who operates this site, and how to reach them."
    >
      {controller ? (
        <>
          <Section heading="Operator">
            <Points
              items={[
                ["Company", controller.name],
                ...(controller.address ? ([["Address", controller.address]] as const) : []),
                ["Email", controller.email],
                ...(controller.companyNumber
                  ? ([["Enterprise number", controller.companyNumber]] as const)
                  : []),
                ...(controller.vatId ? ([["VAT", controller.vatId]] as const) : []),
              ]}
            />
          </Section>

          <Section heading="Responsibility">
            <p>
              {controller.name} operates whatweearn and is the data controller for it. What that
              means in practice (what is stored, what cannot be stored, and why) is set out on
              the <a href="/privacy" className="text-accent underline underline-offset-2">privacy page</a>.
            </p>
            <p>
              The survey is free to take, carries no advertising and sells nothing. It exists
              because pay secrecy costs engineers money, and it is funded as a side project
              rather than a product.
            </p>
          </Section>
        </>
      ) : (
        <Section heading="Operator">
          <MissingController />
        </Section>
      )}

      <Section heading="Content and corrections">
        <p>
          Published figures are computed from survey responses by the code in the{" "}
          <a href={SOURCE_URL} className="text-accent underline underline-offset-2">
            public repository
          </a>
          . If a figure looks wrong, the aggregation is open and the dataset is downloadable,
          please check it and tell us what you find.
        </p>
        <p>
          Links to other sites are their operators&rsquo; responsibility, not ours.
        </p>
      </Section>
    </LegalPage>
  );
}
