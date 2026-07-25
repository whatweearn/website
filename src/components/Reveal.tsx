"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cx } from "./ui";

/**
 * Fades content in on scroll.
 *
 * Drives a data attribute rather than React state: the observer is
 * synchronising an external system (the DOM), so there is no reason to
 * re-render, and it keeps reduced-motion handling entirely in CSS.
 *
 * The rootMargin is the whole point — the observer fires 240px *before* the
 * element reaches the viewport. An earlier version triggered on entry with a
 * 0.6s fade, which meant fast scrolling landed on entirely blank screens and
 * the page looked broken. Reveal early, fade briefly, or don't do it at all.
 */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          node.dataset.reveal = "in";
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px 240px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal="out" className={cx("reveal", className)}>
      {children}
    </div>
  );
}
