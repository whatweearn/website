import Link from "next/link";
import type { ReactNode } from "react";

import { Container } from "./ui";

export function LegalPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="py-[clamp(2rem,5vw,4rem)]">
      <Container slim>
        <Link href="/" className="text-xs text-ink-3 no-underline transition-colors hover:text-ink">
          <span aria-hidden="true">←</span> whatweearn
        </Link>

        <h1 className="mt-8 text-2xl tracking-[-0.034em]">{title}</h1>
        <p className="mt-4 max-w-[60ch] leading-relaxed text-ink-2">{intro}</p>
        <p className="mt-3 text-xs text-ink-3">Last updated {updated}</p>

        <div className="mt-12 flex flex-col gap-10">{children}</div>
      </Container>
    </main>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg">{heading}</h2>
      <div className="flex max-w-[62ch] flex-col gap-3 text-xs leading-relaxed text-ink-2">
        {children}
      </div>
    </section>
  );
}

export function Points({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <dl className="m-0 grid gap-3">
      {items.map(([term, detail]) => (
        <div key={term} className="grid gap-1">
          <dt className="font-semibold text-ink">{term}</dt>
          <dd className="m-0">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Shown in place of controller details when they are not configured.
 *
 * Deliberately impossible to miss. The failure mode this prevents is a policy
 * that reads as complete while omitting the one thing the law requires.
 */
export function MissingController() {
  return (
    <div
      role="alert"
      className="rounded-lg border border-dashed border-coral bg-wash p-5 text-xs leading-relaxed"
    >
      <b className="font-semibold text-ink">This site is not ready to collect data.</b> No data
      controller is configured, so there is nobody legally answerable for it and no address to
      contact. Set <code className="font-mono">LEGAL_CONTROLLER_NAME</code> and{" "}
      <code className="font-mono">LEGAL_CONTACT_EMAIL</code> before launch.
    </div>
  );
}
