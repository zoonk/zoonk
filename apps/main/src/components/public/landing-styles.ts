/**
 * Shared look of the public pages (the visitor home, pricing, a shared plan), so every page a
 * visitor lands on reads as one product.
 */

/**
 * The public pages' one container: 80rem of content with 16, 24 and 32px gutters, so the top bar,
 * every section and the footer share one left edge. Text inside keeps its own reading width.
 */
export const PUBLIC_CONTAINER_CLASS = "mx-auto w-full max-w-wide px-4 sm:px-6 lg:px-8";

/**
 * The page's one display headline: the landing's promise. Its lines fill greedily (`text-pretty`),
 * so a two-line promise breaks after its first idea ("…every day / until the big day.") rather
 * than in the middle of it, as balancing would.
 */
export const DISPLAY_CLASS =
  "text-[40px] leading-[1.04] font-semibold tracking-[-0.045em] text-pretty sm:text-[54px] lg:text-[64px] lg:leading-[1.02] xl:text-[72px]";

/** A public page's headline when it isn't the landing's promise (pricing). */
export const HEADLINE_CLASS =
  "text-[34px] leading-[1.06] font-semibold tracking-[-0.04em] text-balance lg:text-[52px] lg:leading-[1.04]";

/** A stop's heading: one short sentence. */
export const STOP_TITLE_CLASS =
  "max-w-[20em] text-[28px] leading-[1.12] font-semibold tracking-[-0.035em] text-balance sm:text-[34px] lg:text-[40px] lg:leading-[1.08]";

/** The one line under a headline or a stop's heading, at body size. */
export const LEAD_CLASS =
  "text-muted-foreground max-w-[38rem] text-[17px] leading-normal text-pretty lg:text-lg";

/** The quiet line over a heading: where it sits in the story, in the mono face. */
export const EYEBROW_CLASS =
  "text-muted-foreground font-mono text-xs leading-4 tracking-[0.04em] text-balance uppercase tabular-nums";

/** A public page's first screen: the page's promise on the left and its panel beside it (below it on phones). */
export const HERO_CLASS = `${PUBLIC_CONTAINER_CLASS} grid grid-cols-1 gap-10 pt-6 pb-4 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_444px] lg:items-start lg:gap-14`;

/** A shared plan's name as the page's headline. */
export const HERO_TITLE_CLASS =
  "text-[36px] leading-[1.06] font-semibold tracking-[-0.035em] text-balance sm:text-5xl sm:leading-[1.04] lg:text-[56px]";

export const HERO_LEAD_CLASS =
  "text-muted-foreground mt-4 max-w-[600px] text-base leading-relaxed text-pretty sm:mt-6 sm:text-lg";

/**
 * A row of cards that swipes sideways on phones and tablets, each card snapping to the page's edge
 * (its first one on the page's gutter), and lies flat as a grid from `lg`. It scrolls, so it takes
 * the keyboard's focus and a name. It's positioned, so what's absolutely placed inside a card (a
 * screen-reader-only label) scrolls with the row instead of widening the page.
 */
export const SNAP_ROW_CLASS =
  "relative -mx-4 grid snap-x snap-mandatory auto-cols-[86%] grid-flow-col gap-3 overflow-x-auto overflow-y-hidden scroll-px-4 px-4 pb-1.5 outline-none scrollbar-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:-mx-6 sm:auto-cols-[47%] sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid-flow-row lg:auto-cols-auto lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden";

/** Times, counts, dates and amounts: the mono face with numbers that line up. */
export const NUMERIC_CLASS = "font-mono tabular-nums";
