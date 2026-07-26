"use client";

import { type ReactNode, useId, useState, useSyncExternalStore } from "react";

import { EnvelopeIcon, LinkedInIcon, RedditIcon, WhatsAppIcon, XIcon } from "./icons";
import { buttonClasses, cx } from "./ui";

/**
 * Sharing, as a first-class mechanism rather than a courtesy button.
 *
 * This project has no marketing budget, no ad spend and no analytics. The only
 * thing that moves a country from nine responses to sixty is one engineer
 * forwarding it to another, so the share affordance is treated as a conversion
 * surface: the message is pre-written and visible, every channel is one click,
 * and the ask is stated rather than implied.
 *
 * Every channel here is a plain link to a public intent URL. No SDK, no
 * `platform.twitter.com`, no LinkedIn tag. That matters twice over: the CSP in
 * `next.config.ts` would block a third-party script anyway, and a share widget
 * that phones home is exactly the tracking this site promises it does not do.
 * A navigation the visitor chooses to start is not a third-party script.
 *
 * Copy is written to sound like a person, not a brand: short sentences, no
 * dashes, nothing that reads as generated. Somebody is about to put it under
 * their own name.
 */

const FALLBACK_ORIGIN = "https://whatweearn.eu";

/** Headline used by the channels that submit a link rather than a message. */
const LINK_TITLE = "whatweearn: an anonymous salary survey for engineers in Europe";

type Channel = {
  name: string;
  /** Shown to screen readers, which otherwise hear five bare brand names. */
  label: string;
  /** The mark. A share row is scanned for the logo before the word is read. */
  Icon: typeof XIcon;
  href: (message: string, url: string) => string;
};

/**
 * Five, and they fit on one line.
 *
 * Hacker News was the sixth and is deliberately gone. Every channel here is a
 * *forward* — one person handing this to people they know — and HN is a
 * submission to a global front page where only the first one counts. The
 * second through five-hundredth respondent pressing it produce duplicates
 * folded into the original, and a stream of repeat submissions of one URL from
 * many accounts is the pattern that gets a domain penalised. Submitting to HN
 * is the operator's job, once, as part of the seeding push in CLAUDE.md §9
 * Phase 7 — not something to nudge every respondent into.
 *
 * Reddit looks similar but earns its place: national subreddits mean many
 * different submissions are genuinely useful rather than duplicates.
 */

const CHANNELS: readonly Channel[] = [
  {
    name: "X",
    label: "Share on X",
    Icon: XIcon,
    href: (m, url) => `https://x.com/intent/post?text=${enc(m)}&url=${enc(url)}`,
  },
  {
    name: "LinkedIn",
    label: "Share on LinkedIn",
    Icon: LinkedInIcon,
    // LinkedIn drops any text passed alongside the URL and builds its own
    // preview card, so sending the message too would only be theatre.
    href: (_m, url) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
  },
  {
    name: "Reddit",
    label: "Post to Reddit",
    Icon: RedditIcon,
    href: (_m, url) => `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(LINK_TITLE)}`,
  },
  {
    name: "WhatsApp",
    label: "Send on WhatsApp",
    Icon: WhatsAppIcon,
    href: (m, url) => `https://wa.me/?text=${enc(`${m} ${url}`)}`,
  },
  {
    name: "Email",
    label: "Share by email",
    Icon: EnvelopeIcon,
    href: (m, url) => `mailto:?subject=${enc(LINK_TITLE)}&body=${enc(`${m}\n\n${url}\n`)}`,
  },
];

function enc(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Both of these read something that exists only in a browser, and both must
 * render identically on the server and during hydration or React replaces the
 * markup. `useSyncExternalStore` is the sanctioned shape for exactly that: the
 * server snapshot is used for the first client render, the real one takes over
 * immediately after. Doing it with `useEffect` + `setState` works but is a
 * cascading render, which the lint rules correctly refuse.
 *
 * Nothing here ever changes after mount, so the subscribe function has nothing
 * to subscribe to. It still has to be referentially stable, hence module scope.
 */
const noSubscribe = () => () => {};

/**
 * The absolute URL to share.
 *
 * Falls back to the production origin so a server-rendered page carries a
 * usable link even before hydration, and corrects to the real origin on a
 * preview deployment or localhost.
 */
function useShareUrl(path: string): string {
  return useSyncExternalStore(
    noSubscribe,
    () => new URL(path, window.location.origin).toString(),
    () => new URL(path, FALLBACK_ORIGIN).toString(),
  );
}

/** Whether the platform offers a native share sheet, which is most phones. */
function useShareSheet(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

type ShareProps = {
  /** The pre-written message. Shown verbatim, because people share what they can see. */
  message: string;
  headline: ReactNode;
  blurb?: ReactNode;
  path?: string;
  /**
   * The full-width treatment used at the moment of most goodwill, straight
   * after submitting. Elsewhere the compact one keeps sharing present without
   * shouting over the page it sits on.
   */
  prominent?: boolean;
  className?: string;
};

export function Share({
  message,
  headline,
  blurb,
  path = "/",
  prominent = false,
  className,
}: ShareProps) {
  const url = useShareUrl(path);
  const canUseSheet = useShareSheet();
  const [copied, setCopied] = useState(false);
  const size = prominent ? "lg" : "base";
  // Generated rather than fixed, because two of these on one page would
  // otherwise duplicate the id and leave both regions pointing at one heading.
  const headingId = useId();

  const payload = `${message} ${url}`;

  async function share() {
    try {
      await navigator.share({ title: "whatweearn", text: message, url });
    } catch (error) {
      // Backing out of the sheet must do nothing. This used to fall through to
      // copying, so cancelling a share silently put text on the clipboard and
      // announced "Copied" — an action nobody asked for, reported as success.
      // Only a real failure to open the sheet is worth a fallback.
      if ((error as Error)?.name === "AbortError") return;
      await copy();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch {
      // Insecure context, or permission refused. The message is on screen and
      // selectable, so there is still a way through.
      setCopied(false);
    }
  }

  return (
    <section
      className={cx(
        "rounded-xl border bg-surface",
        prominent
          ? "border-accent/35 p-[clamp(1.5rem,4vw,2.25rem)] shadow-md"
          : "border-line p-6 shadow-sm",
        className,
      )}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className={cx("tracking-[-0.02em]", prominent ? "text-xl" : "text-lg")}>
        {headline}
      </h2>
      {blurb && (
        <p className="mt-3 max-w-[52ch] text-xs leading-relaxed text-ink-2">{blurb}</p>
      )}

      {/* The message is shown, not hidden behind a button. Seeing the words
          they are about to publish is most of what decides whether somebody
          posts at all, and it keeps us honest about writing something a person
          would actually be willing to say. */}
      <p
        className={cx(
          "mt-5 rounded-md border border-line bg-tint px-4 py-3",
          "text-xs leading-relaxed text-ink-2 select-all",
        )}
      >
        {message} <span className="text-accent">{url}</span>
      </p>

      {/*
        There is always exactly one copy button, and it always says what it
        does. It used to be labelled "Copy instead", which raised the question
        "instead of what", and the button beside it changed to "Copied, go
        paste it" even when the copy had come from the other one.

        The only thing that varies is whether a native share sheet exists to
        put in front of it. Where it does, it takes the filled treatment and
        copy steps back to a ghost; where it does not, copy is the whole
        action and takes the filled one. Both take their tokens from
        `buttonClasses` at one size, so they share a height.
      */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {canUseSheet && (
          <button type="button" onClick={share} className={buttonClasses("coral", size)}>
            Share it
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          className={buttonClasses(canUseSheet ? "ghost" : "coral", size)}
        >
          {copied ? "Copied" : "Copy the message"}
        </button>
      </div>

      <p aria-live="polite" className="mt-2 min-h-4 text-2xs text-ink-3">
        {copied ? "The message and the link are on your clipboard." : ""}
      </p>

      <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">
        {CHANNELS.map((channel) => (
          <li key={channel.name}>
            <a
              href={channel.href(message, url)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={channel.label}
              className={cx(
                "inline-flex items-center gap-[0.4rem] rounded-full border border-line-2 px-[0.8rem] py-[0.45rem]",
                "text-2xs font-semibold whitespace-nowrap text-ink-2 no-underline",
                "transition-colors hover:border-ink-3 hover:bg-tint hover:text-ink",
              )}
            >
              {/* The mark and the word together. The logo is what the eye
                  finds; the word is what makes it unambiguous at 13px, and
                  keeps the row legible if a mark ever fails to paint. */}
              <channel.Icon className="shrink-0" />
              {channel.name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

