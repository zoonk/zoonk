export const PUBLIC_CONTAINER_CLASS = "mx-auto w-full max-w-wide px-4 sm:px-6 lg:px-8";

export const PUBLIC_BAND_CLASS = "py-14 sm:py-20 lg:py-24";

/** `text-pretty`, not balance, so a two-line promise breaks after its first idea rather than in its middle. */
export const DISPLAY_CLASS =
  "text-[40px] leading-[1.04] font-semibold tracking-[-0.045em] text-pretty sm:text-[54px] lg:text-[64px] lg:leading-[1.02] xl:text-[72px]";

export const STOP_TITLE_CLASS =
  "max-w-[20em] text-[28px] leading-[1.12] font-semibold tracking-[-0.035em] text-balance sm:text-[34px] lg:text-[40px] lg:leading-[1.08]";

export const LEAD_CLASS =
  "text-muted-foreground max-w-[38rem] text-[17px] leading-normal text-pretty lg:text-lg";

export const EYEBROW_CLASS =
  "text-muted-foreground font-mono text-xs leading-4 tracking-[0.04em] text-balance uppercase tabular-nums";

export const HERO_CLASS = `${PUBLIC_CONTAINER_CLASS} grid grid-cols-1 gap-10 pt-6 pb-4 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_444px] lg:items-start lg:gap-14`;

export const HERO_LEAD_CLASS = "text-lead mt-4 max-w-[600px] sm:mt-5";

/**
 * It scrolls, so it needs the keyboard's focus and a name. Positioned, so an absolutely placed
 * screen-reader-only label scrolls with the row instead of widening the page.
 */
export const SNAP_ROW_CLASS =
  "relative -mx-4 grid snap-x snap-mandatory auto-cols-[86%] grid-flow-col gap-3 overflow-x-auto overflow-y-hidden scroll-px-4 px-4 pb-1.5 outline-none scrollbar-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:-mx-6 sm:auto-cols-[47%] sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid-flow-row lg:auto-cols-auto lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden";

export const NUMERIC_CLASS = "font-mono tabular-nums";
