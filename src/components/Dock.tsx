"use client";

import { useEffect, useState } from "react";

import { Button, cx } from "./ui";

/**
 * Sticky call to action.
 *
 * Shown only between the hero's CTA and the closing one, so there is never a
 * redundant duplicate of a button already on screen.
 */
export function Dock() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("cta-hero");
    const closing = document.getElementById("start");
    if (!hero) return;

    let heroIn = true;
    let closingIn = false;
    const sync = () => setVisible(!heroIn && !closingIn);

    const heroObserver = new IntersectionObserver((entries) => {
      heroIn = entries[0]?.isIntersecting ?? false;
      sync();
    });
    heroObserver.observe(hero);

    let closingObserver: IntersectionObserver | undefined;
    if (closing) {
      closingObserver = new IntersectionObserver(
        (entries) => {
          closingIn = entries[0]?.isIntersecting ?? false;
          sync();
        },
        { threshold: 0.2 },
      );
      closingObserver.observe(closing);
    }

    return () => {
      heroObserver.disconnect();
      closingObserver?.disconnect();
    };
  }, []);

  return (
    <div
      className={cx(
        "fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4",
        "border-t border-line bg-surface/90 px-[clamp(1.25rem,5vw,2.5rem)] py-[0.7rem]",
        "backdrop-blur-lg backdrop-saturate-150",
        "pb-[max(0.7rem,env(safe-area-inset-bottom))]",
        "transition-transform duration-300 ease-out",
        visible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <p className="hidden text-xs text-ink-2 min-[620px]:block">
        Nine questions. Anonymous. The dataset opens when you submit.
      </p>
      <Button href="/survey" size="sm" arrow className="ml-auto">
        Add your salary
      </Button>
    </div>
  );
}
