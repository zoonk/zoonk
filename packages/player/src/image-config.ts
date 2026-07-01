/**
 * Step images now bleed to the full available player column. Keeping the
 * shared responsive `sizes` string here lets the visible image and the hidden
 * preloader ask Next.js for comparable image candidates across mobile and
 * desktop layouts.
 */
export const STEP_IMAGE_SIZES = "(max-width: 1024px) 100vw, 50vw";

/**
 * The preloader still needs explicit dimensions because hidden Next.js images
 * cannot use `fill`. A portrait-friendly request shape better matches the new
 * player layout and avoids prefetching a tiny square derivative for imagery
 * that now fills a taller stage.
 */
export const STEP_IMAGE_PRELOAD_PROPS = {
  height: 1280,
  sizes: STEP_IMAGE_SIZES,
  width: 1024,
} as const;

export const SELECT_IMAGE_PROPS = {
  height: 336,
  sizes: "(max-width: 672px) 50vw, 336px",
  width: 336,
} as const;
