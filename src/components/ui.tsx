import Link from "next/link";
import type { ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * The bordered shell every input shares. One definition, because the survey
 * and the explorer drawing the same hairline by hand is exactly how two
 * slightly different borders end up on one site.
 */
export const SHELL =
  "rounded-md border border-line bg-surface transition-colors hover:border-line-2";

/**
 * A select with its native chevron removed. Must be paired with a
 * `.comp-select` wrapper, which draws the replacement — the padding on the
 * right is the room that chevron sits in.
 */
export const SELECT_CONTROL = cx(SHELL, "appearance-none py-3 pr-10 pl-4 text-base text-ink");

/*
 * A button does not move on hover. The colour, the shadow and the arrow carry
 * the state; the box stays where it is.
 *
 * It used to rise a pixel, and the pixel was never the point — it was there to
 * say *interactive*, which the arrow already says, and better, because it says
 * it in the direction the click is going to take you. Two things moving at once
 * on a control this small is one too many.
 *
 * So the transition list below has no `translate` in it, and if you ever add a
 * movement back, put `translate` in the list rather than `transform`: Tailwind
 * v4 compiles `-translate-y-px` to the standalone `translate` property, not to
 * `transform` the way v3 did. Naming `transform` here transitions nothing and
 * the movement lands in a single frame, which is how the lift came to snap
 * instead of glide. The `transition-transform` shorthand is the safer spelling —
 * v4 expands it to `transform, translate, scale, rotate`, so it cannot go stale.
 * That is what the arrow uses, and it is why the arrow was gliding smoothly over
 * a button that was popping.
 */
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-display " +
  "leading-none whitespace-nowrap no-underline cursor-pointer transition-[background-color,box-shadow,border-color,color] " +
  "duration-200 group";

/**
 * Weight lives here rather than in {@link BUTTON_BASE} because it has to be
 * settable per size, and two competing `font-*` weight utilities on one
 * element do not resolve by class order — they resolve by whichever rule
 * Tailwind emitted last, which is not something a caller can see or control.
 * A `font-bold` variant added on top of a `font-semibold` base silently lost.
 */
const SIZES = {
  sm: "px-[1.2rem] py-[0.68rem] text-xs font-semibold",
  base: "px-[1.65rem] py-4 text-base font-semibold",
  lg: "px-[2.1rem] py-[1.15rem] text-lg font-semibold",
} as const;

/**
 * One filled coral, at every size, and it is `--wwe-accent`.
 *
 * Large buttons used to take the brighter `--wwe-coral` on the reasoning that
 * they cleared AA at 3:1. They did not. White on `--wwe-coral` is 3.38:1,
 * which only passes under WCAG's large-text rule, and that rule wants 18.66px
 * **bold** or 24px at any weight — `text-lg` is 19.3px, so at semibold it was
 * never large text and the real bar was 4.5:1. It had been failing since the
 * palette was solved, and it stayed invisible because the hero button sits on
 * `hero-glow`: axe cannot resolve a gradient to one background colour, files
 * the result as *incomplete* rather than a violation, and every scan here
 * asserts only violations. Putting the same button on the share card's flat
 * surface failed instantly.
 *
 * Bolting the weight to 700 would have propped it up. Moving to `--wwe-accent`
 * removes the dependency instead: 5.08:1, so size and weight are free design
 * choices again, and it restores what `globals.css` has always claimed — coral
 * is decorative (bars, marks, washes), accent carries interactive fills. There
 * is now no filled control anywhere using the decorative token.
 *
 * Treat axe `incomplete` as unreviewed, not as passing.
 */
/*
 * Every variant declares a border, and the filled ones make theirs transparent.
 * Without it a ghost button standing next to a filled one is 2px taller — the
 * border is outside the padding box at `height: auto` — which is exactly how
 * the share card's two buttons ended up mismatched.
 *
 * The transparent border is set here per variant rather than once in
 * {@link BUTTON_BASE}, so each element carries exactly one border-colour
 * utility. Two of them would resolve by emission order rather than class
 * order, the same trap that made `font-bold` lose to `font-semibold`.
 */
const VARIANTS = {
  coral:
    "bg-accent text-on-accent border border-transparent shadow-sm hover:bg-accent-hover hover:shadow-md",
  ink: "bg-ink text-on-ink border border-transparent shadow-sm hover:bg-accent-hover hover:text-on-accent",
  ghost: "bg-transparent text-ink border border-line-2 hover:bg-tint hover:border-ink-3",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

/**
 * The class list a {@link Button} carries, for controls that cannot be one.
 *
 * `Button` renders a `Link`, so anything that runs an action rather than
 * navigating has to be a real `<button>` and used to hand-roll its own
 * padding. They drifted immediately: the share card ended up with a primary at
 * `py-[1.15rem] text-lg` beside a secondary at `py-3 text-xs`, two different
 * heights sitting in the same row, and the primary had missed `leading-none`
 * so its line box inflated it further. Take the tokens from here instead.
 */
export function buttonClasses(
  variant: ButtonVariant = "coral",
  size: ButtonSize = "base",
  className?: string,
): string {
  return cx(BUTTON_BASE, SIZES[size], VARIANTS[variant], className);
}

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  arrow?: boolean;
  className?: string;
  id?: string;
};

export function Button({
  href,
  children,
  variant = "coral",
  size = "base",
  arrow = false,
  className,
  id,
}: ButtonProps) {
  return (
    <Link id={id} href={href} className={buttonClasses(variant, size, className)}>
      {children}
      {arrow && (
        <span
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-[3px]"
        >
          →
        </span>
      )}
    </Link>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-wash py-[0.42rem] pr-[0.95rem] pl-3 text-xs font-semibold text-accent">
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-coral" />
      {children}
    </span>
  );
}

/** The short reassurance line under a call to action. */
export function TrustLine({ items, className }: { items: string[]; className?: string }) {
  return (
    <p className={cx("flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-ink-3", className)}>
      {items.map((item) => (
        <span key={item} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-[5px] rounded-full bg-coral opacity-55" />
          {item}
        </span>
      ))}
    </p>
  );
}

export function SectionHead({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-[clamp(1.75rem,3.5vw,2.75rem)] flex max-w-[36ch] flex-col items-start gap-[0.85rem]">
      <h2 className="text-2xl tracking-[-0.034em]">{title}</h2>
      {children && <p className="max-w-[46ch] text-ink-2">{children}</p>}
    </div>
  );
}

export function Container({
  children,
  slim = false,
  className,
}: {
  children: ReactNode;
  slim?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "mx-auto px-[clamp(1.25rem,5vw,2.5rem)]",
        slim ? "max-w-[720px]" : "max-w-[1080px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
