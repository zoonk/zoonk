import { createCn } from "cn/config";

/**
 * Class names merged the Tailwind way, knowing the app's own theme: `text-title` and `text-label`
 * are type sizes (`text-label` brings its quiet color as a default), so a color beside them stays
 * and another size replaces them; `rounded-option` is a radius and the measures (`max-w-column`,
 * `max-w-form`, `max-w-wide`) are widths, so another one replaces them.
 */
export const cn = createCn({
  extend: {
    classGroups: { "font-size": [{ text: ["title", "label"] }] },
    theme: { container: ["column", "form", "wide"], radius: ["option"] },
  },
});
