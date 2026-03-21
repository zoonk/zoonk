/**
 * Shared image dimension constants for step images. Used by both the rendering
 * components and the preloader to ensure the browser fetches the exact same
 * optimized `/_next/image` URL — guaranteeing a cache hit when the step mounts.
 */
export const VISUAL_IMAGE_PROPS = {
  height: 1024,
  sizes: "(max-width: 640px) calc(100vw - 2rem), 448px",
  width: 1024,
} as const;

export const SELECT_IMAGE_PROPS = {
  height: 336,
  sizes: "(max-width: 672px) 50vw, 336px",
  width: 336,
} as const;
