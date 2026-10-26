import { createCn } from "cn/config";

/**
 * Class names merged the Tailwind way, knowing the app's own theme: the type roles (`text-display`,
 * `text-headline`, `text-title`, `text-section`, `text-lead`, `text-label`) are type sizes
 * (`text-lead` and `text-label` bring their quiet color as a default), so a color beside them stays
 * and another size replaces them; `text-readout` is a number's face, kept beside a size and a
 * color; `rounded-option` is a radius and the measures (`max-w-column`, `max-w-form`,
 * `max-w-wide`) are widths, so another one replaces them.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "headline", "title", "section", "lead", "label"] }],
      readout: [{ text: ["readout"] }],
    },
    theme: { container: ["column", "form", "wide"], radius: ["option"] },
  },
});
