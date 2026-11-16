export const PUBLIC_CONTAINER_CLASS = "mx-auto w-full max-w-wide px-4 sm:px-6 lg:px-8";

export const PUBLIC_BAND_CLASS = "py-14 sm:py-20 lg:py-24";

/** The room between the public header and a page's first screen: one value for each kind of page. */
export const FIRST_SCREEN_TOP_CLASS = {
  landing: "pt-3 sm:pt-8 lg:pt-14",
  page: "pt-6 sm:pt-10",
  pricing: "pt-12 lg:pt-24",
} as const;

export const HERO_CLASS = `${PUBLIC_CONTAINER_CLASS} ${FIRST_SCREEN_TOP_CLASS.page} grid grid-cols-1 gap-10 pb-4 lg:grid-cols-[minmax(0,1fr)_444px] lg:items-start lg:gap-14`;

export const HERO_LEAD_CLASS = "text-lead mt-4 max-w-[600px] sm:mt-5";

export const NUMERIC_CLASS = "font-mono tabular-nums";

/**
 * A footer's row of links: inline, so its lines balance and no link is left alone on the last one
 * in a language whose words run long.
 */
export const FOOTER_LINKS_CLASS = "text-balance";

export const FOOTER_LINK_CLASS =
  "hover:text-foreground focus-visible:ring-ring/50 hit-area relative me-6 inline-flex min-h-11 items-center rounded-md align-top outline-none transition-colors last:me-0 focus-visible:ring-[3px]";
