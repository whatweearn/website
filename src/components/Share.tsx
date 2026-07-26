"use client";

import { type ReactNode, useId, useState, useSyncExternalStore } from "react";

import { cx } from "./ui";

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
  /** Shown to screen readers, which otherwise hear six bare brand names. */
  label: string;
  href: (message: string, url: string) => string;
};

const CHANNELS: readonly Channel[] = [
  {
    name: "X",
    label: "Share on X",
    href: (m, url) => `https://x.com/intent/post?text=${enc(m)}&url=${enc(url)}`,
  },
  {
    name: "LinkedIn",
    label: "Share on LinkedIn",
    // LinkedIn drops any text passed alongside the URL and builds its own
    // preview card, so sending the message too would only be theatre.
    href: (_m, url) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
  },
  {
    name: "Reddit",
    label: "Post to Reddit",
    href: (_m, url) => `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(LINK_TITLE)}`,
  },
  {
    name: "Hacker News",
    label: "Submit to Hacker News",
    href: (_m, url) => `https://news.ycombinator.com/submitlink?u=${enc(url)}&t=${enc(LINK_TITLE)}`,
  },
  {
    name: "WhatsApp",
    label: "Send on WhatsApp",
    href: (m, url) => `https://wa.me/?text=${enc(`${m} ${url}`)}`,
  },
  {
    name: "Email",
    label: "Share by email",
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
  // Generated rather than fixed, because two of these on one page would
  // otherwise duplicate the id and leave both regions pointing at one heading.
  const headingId = useId();

  const payload = `${message} ${url}`;

  async function primary() {
    if (canUseSheet) {
      try {
        await navigator.share({ title: "whatweearn", text: message, url });
        return;
      } catch {
        // Dismissed, or refused. Copying is still useful, so fall through.
      }
    }
    await copy();
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

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={primary}
          className={cx(
            "inline-flex cursor-pointer items-center gap-2 rounded-full",
            "font-display whitespace-nowrap text-on-accent",
            "transition-[background-color,box-shadow,transform] duration-200",
            "hover:-translate-y-px hover:shadow-md",
            // Bold on the coral one is a contrast requirement, not a style
            // choice, and the weight is set alongside the size for the reason
            // given on SIZES in ui.tsx. Same pairings as a real Button, which
            // this cannot be: Button renders a Link, and this runs an action.
            prominent
              ? "bg-coral px-[2.1rem] py-[1.15rem] text-lg font-bold hover:bg-accent"
              : "bg-accent px-[1.65rem] py-4 text-base font-semibold hover:bg-accent-hover",
          )}
        >
          {copied ? "Copied, go paste it" : canUseSheet ? "Share it" : "Copy the message"}
        </button>

        {canUseSheet && (
          <button
            type="button"
            onClick={copy}
            className="inline-flex cursor-pointer items-center rounded-full border border-line-2 px-5 py-3 font-display text-xs font-semibold text-ink transition-colors hover:bg-tint"
          >
            {copied ? "Copied" : "Copy instead"}
          </button>
        )}
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
                "inline-flex items-center rounded-full border border-line-2 px-[0.85rem] py-[0.45rem]",
                "text-2xs font-semibold whitespace-nowrap text-ink-2 no-underline",
                "transition-colors hover:border-ink-3 hover:bg-tint hover:text-ink",
              )}
            >
              {channel.name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

