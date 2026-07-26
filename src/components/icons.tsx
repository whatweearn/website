import type { ReactNode } from "react";

/**
 * Every icon on the site, in one file.
 *
 * There is no icon library here and there cannot be one: the CSP allows no
 * third-party origin, so an icon font or a CDN sprite sheet is off the table
 * and every glyph has to be inline SVG. That cost is what left the site using
 * bare Unicode codepoints in the places an icon belonged.
 *
 * Two of those were a correctness problem rather than a style choice. `☀`
 * (U+2600) and `☾` have emoji presentation on several platforms, so the theme
 * toggle could render as a colour emoji sitting inside a hairline-drawn nav,
 * and `✓`/`✕` fall back to whatever font happens to carry them. An SVG renders
 * identically everywhere and inherits `currentColor`, which the theme system
 * depends on.
 *
 * What deliberately stays as text: the `→` and `←` in buttons and back links.
 * They sit inline in a sentence, need to inherit font size rather than be
 * given one, and one of them is animated on hover through a transform on a
 * text span. Text is genuinely the better tool there.
 *
 * Everything here is decorative — every control that carries an icon already
 * has a visible label or an `aria-label` — so all of it is `aria-hidden` and
 * removed from the tab order by default.
 */

type IconProps = {
  className?: string;
  /** Edge length in px. Icons are square on a 24-unit grid. */
  size?: number;
};

function Svg({
  size,
  className,
  filled = false,
  children,
}: IconProps & { filled?: boolean; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...(filled
        ? { fill: "currentColor" }
        : {
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.7,
            strokeLinecap: "round" as const,
            strokeLinejoin: "round" as const,
          })}
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------- ui -- */

export function SunIcon({ size = 15, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
    </Svg>
  );
}

export function MoonIcon({ size = 15, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M20.5 14.6A8.9 8.9 0 0 1 9.4 3.5a8.9 8.9 0 1 0 11.1 11.1Z" />
    </Svg>
  );
}

/**
 * "Follows your system" — a circle half filled, the long-standing convention
 * for an automatic light/dark setting, and the shape `◐` was standing in for.
 */
export function AutoThemeIcon({ size = 15, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 3.4a8.6 8.6 0 0 1 0 17.2Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CheckIcon({ size = 12, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="m4.5 12.5 4.8 4.8L19.5 7" strokeWidth={2.4} />
    </Svg>
  );
}

export function CrossIcon({ size = 10, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M6 6l12 12M18 6 6 18" strokeWidth={2.4} />
    </Svg>
  );
}

/* -------------------------------------------------------------- payoff -- */

export function GlobeIcon({ size = 20, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
    </Svg>
  );
}

export function FiltersIcon({ size = 20, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2.2" />
      <circle cx="15" cy="12" r="2.2" />
      <circle cx="8" cy="17" r="2.2" />
    </Svg>
  );
}

export function FileIcon({ size = 20, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
      <path d="M12 12v6M9.5 15.5 12 18l2.5-2.5" />
    </Svg>
  );
}

/* --------------------------------------------------------------- share -- */

/**
 * Brand marks, filled rather than stroked, because that is the only form these
 * are recognisable in — a share row is scanned for the logo, not read.
 *
 * Paths are the official single-colour marks as published by simple-icons,
 * which releases them CC0. They are reproduced verbatim: a hand-redrawn logo
 * is worse than no logo, and every one of these was copied from the source
 * rather than written from memory. LinkedIn is the exception worth noting —
 * simple-icons removed it at LinkedIn's request, so its path is pinned from
 * simple-icons 11.14.0, the last release that carried it.
 *
 * The envelope is not a brand mark and is drawn here, in two filled subpaths
 * so the flap reads as a gap rather than needing a fill rule.
 */
export function XIcon({ size = 13, className }: IconProps) {
  return (
    <Svg size={size} className={className} filled>
      <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
    </Svg>
  );
}

export function LinkedInIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className} filled>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </Svg>
  );
}

export function RedditIcon({ size = 15, className }: IconProps) {
  return (
    <Svg size={size} className={className} filled>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z" />
    </Svg>
  );
}

export function HackerNewsIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className} filled>
      <path d="M0 24V0h24v24H0zM6.951 5.896l4.112 7.708v5.064h1.583v-4.972l4.148-7.799h-1.749l-2.457 4.875c-.372.745-.688 1.434-.688 1.434s-.297-.708-.651-1.434L8.831 5.896h-1.88z" />
    </Svg>
  );
}

export function WhatsAppIcon({ size = 15, className }: IconProps) {
  return (
    <Svg size={size} className={className} filled>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </Svg>
  );
}

export function EnvelopeIcon({ size = 14, className }: IconProps) {
  return (
    <Svg size={size} className={className} filled>
      <path d="M3 4h18a1.6 1.6 0 0 1 1.6 1.6v.55L12 12.9 1.4 6.15V5.6A1.6 1.6 0 0 1 3 4Z" />
      <path d="M22.6 8.05v10.35A1.6 1.6 0 0 1 21 20H3a1.6 1.6 0 0 1-1.6-1.6V8.05L12 14.8Z" />
    </Svg>
  );
}
