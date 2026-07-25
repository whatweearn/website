import Link from "next/link";
import type { ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold " +
  "leading-none whitespace-nowrap no-underline cursor-pointer transition-[background-color,box-shadow,transform,border-color,color] " +
  "duration-200 group";

const SIZES = {
  sm: "px-[1.2rem] py-[0.68rem] text-xs",
  base: "px-[1.65rem] py-4 text-base",
  lg: "px-[2.1rem] py-[1.15rem] text-lg",
} as const;

/**
 * Coral is reserved for the two conversion moments (hero and dock). Large
 * buttons take the brighter coral because they clear AA at 3:1; small ones
 * keep the deeper accent, which they need for 4.5:1.
 */
const VARIANTS = {
  coral: "bg-accent text-on-accent shadow-sm hover:bg-accent-hover hover:shadow-md hover:-translate-y-px",
  coralLarge: "bg-coral text-on-accent shadow-sm hover:bg-accent hover:shadow-md hover:-translate-y-px",
  ink: "bg-ink text-on-ink shadow-sm hover:bg-accent-hover hover:text-on-accent hover:-translate-y-px",
  ghost: "bg-transparent text-ink border border-line-2 hover:bg-tint hover:border-ink-3",
} as const;

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "coral" | "ink" | "ghost";
  size?: keyof typeof SIZES;
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
  const resolved = variant === "coral" && size === "lg" ? "coralLarge" : variant;
  return (
    <Link
      id={id}
      href={href}
      className={cx(BUTTON_BASE, SIZES[size], VARIANTS[resolved], className)}
    >
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
