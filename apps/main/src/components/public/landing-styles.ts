/**
 * Shared look of the visitor home and the public course, chapter and lesson pages, so every page
 * a visitor lands on reads as one product.
 */

export const SECTION_CLASS = "mx-auto max-w-6xl px-5 sm:px-8";

export const SECTION_TITLE_CLASS =
  "text-[32px] leading-[1.08] font-bold tracking-[-0.035em] text-balance sm:text-[44px] lg:text-5xl lg:leading-[1.06]";

export const SECTION_LEAD_CLASS =
  "text-muted-foreground mt-3 text-base leading-relaxed text-pretty sm:mt-4 sm:text-[19px]";

/** The first screen: the promise on the left and a product card beside it (below it on phones). */
export const HERO_CLASS =
  "mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 pt-6 pb-4 sm:px-8 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_444px] lg:items-start lg:gap-14";

/** A course's, chapter's or lesson's name as the page's headline. */
export const HERO_TITLE_CLASS =
  "text-[36px] leading-[1.06] font-bold tracking-[-0.035em] text-balance sm:text-5xl sm:leading-[1.04] lg:text-[56px]";

export const HERO_LEAD_CLASS =
  "text-muted-foreground mt-4 max-w-[520px] text-base leading-relaxed text-pretty sm:mt-6 sm:text-[19px]";

/** A card that floats over the page, like the home's plan or a lesson's first question. */
export const FLOATING_CARD_CLASS =
  "bg-card rounded-3xl p-5 shadow-[0_0_0_1px_rgb(0_0_0/0.04),0_1px_2px_rgb(0_0_0/0.04),0_10px_28px_-12px_rgb(0_0_0/0.14)] sm:rounded-[28px] sm:p-7 dark:shadow-[0_0_0_1px_rgb(255_255_255/0.1)]";

/** A soft panel that holds a product preview. */
export const TILE_CLASS = "bg-muted/60 dark:bg-card rounded-3xl sm:rounded-[28px]";

/** A product screen inside a tile, drawn in HTML and CSS instead of a screenshot. */
export const PREVIEW_CARD_CLASS =
  "bg-card dark:bg-muted rounded-2xl shadow-[0_0_0_1px_rgb(0_0_0/0.04),0_1px_2px_rgb(0_0_0/0.04),0_10px_28px_-12px_rgb(0_0_0/0.14)] sm:rounded-[18px] dark:shadow-none";

/** A tile's icon: a tinted square with the goal kind's color. */
export const TILE_ICON_CLASS = "flex size-10 flex-none items-center justify-center rounded-xl";
