/**
 * Next.js bundles an imported SVG as a static file. Turbopack hands back its URL; webpack hands
 * back image data with the URL in `src`.
 */
declare module "flag-icons/flags/4x3/*.svg" {
  const image: string | { height: number; src: string; width: number };
  export default image;
}
