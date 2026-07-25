import type { Metadata } from "next";
import Link from "next/link";

import { Button, Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

const MESSAGES = {
  confirmed: {
    heading: "You're on the list.",
    body: "We'll email you once when the results publish, and once a year when the survey reopens. Nothing else, and never about your own answers — we have no way to find them.",
  },
  removed: {
    heading: "You're off the list.",
    body: "Nothing further will arrive. If that was a mistake, you can sign up again on the data page.",
  },
  invalid: {
    heading: "That link didn't work.",
    body: "It may have been altered in transit or truncated by a mail client. Try the link again from the original email, or sign up once more from the data page.",
  },
  unavailable: {
    heading: "Not available right now.",
    body: "The notification list is temporarily unreachable. Nothing was changed — try again shortly.",
  },
} as const;

type State = keyof typeof MESSAGES;

export default async function SubscribedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.state) ? params.state[0] : params.state;
  const state: State = raw && raw in MESSAGES ? (raw as State) : "invalid";
  const message = MESSAGES[state];

  return (
    <main className="py-[clamp(3rem,8vw,6rem)]">
      <Container slim>
        <Link href="/" className="text-xs text-ink-3 no-underline transition-colors hover:text-ink">
          <span aria-hidden="true">←</span> whatweearn
        </Link>

        <h1 className="mt-8 text-2xl tracking-[-0.034em]">{message.heading}</h1>
        <p className="mt-4 max-w-[52ch] leading-relaxed text-ink-2">{message.body}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/data" variant="ghost" size="sm" arrow>
            See the data
          </Button>
        </div>
      </Container>
    </main>
  );
}
