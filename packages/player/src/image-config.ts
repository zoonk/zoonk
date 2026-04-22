/**
 * Static-step images now render inside a flexible media stage instead of a
 * fixed square tile. Keeping the shared responsive `sizes` string here lets
 * the visible image and the hidden preloader ask Next.js for comparable image
 * candidates even though the on-screen layout changes between mobile and
 * desktop.
 */
export const STEP_IMAGE_SIZES = "(max-width: 1024px) calc(100vw - 1rem), 50vw";

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
