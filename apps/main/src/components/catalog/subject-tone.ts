/**
 * A band across the page's whole width, on its own surface, so where a part of the page starts and
 * ends shows at a glance: to the screen's edges on a phone, the tablet's column (rounded) on a
 * tablet, and from the sidebar to the window's edge from `lg`, its content on the page's own edges.
 */
export const BAND_CLASS =
  "-mx-4 px-4 py-10 sm:-mx-8 sm:rounded-3xl sm:px-8 sm:py-12 lg:-mx-10 lg:rounded-none lg:px-10 lg:py-14";

/**
 * The subject's color (`data-subject` on the page, `@zoonk/learn/subject-label`'s `getSubject`)
 * washed into the page's background, light in light and dark in dark; a plain page when more
 * contrast is asked for. `soft` is lighter, for the band between the two the color frames.
 */
export const SUBJECT_WASH_CLASS = {
  soft: "bg-[color-mix(in_srgb,var(--subject)_9%,var(--background))] contrast-more:bg-background",
  strong:
    "bg-[color-mix(in_srgb,var(--subject)_15%,var(--background))] contrast-more:bg-background",
} as const;
