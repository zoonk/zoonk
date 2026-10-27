import { createCn } from "cn/config";

/**
 * Class names merged the Tailwind way, knowing the app's own theme: the type roles (`text-display`,
 * `text-headline`, `text-title`, `text-section`, `text-lead`, `text-label`) are type sizes
 * (`text-lead` and `text-label` bring their quiet color as a default), so a color beside them stays
 * and another size replaces them; `text-readout` is a number's face, kept beside a size and a
 * color; `rounded-option` is a radius and the measures (`max-w-column`, `max-w-form`,
 * `max-w-wide`) are widths, so another one replaces them. The motion tokens are their kind's too:
 * `duration-quick` to `duration-burst` are durations, `ease-spring` an easing and `animate-settle`,
 * `animate-pop`, `animate-hop`, `animate-fill`, `animate-spark` and `animate-tip` animations.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      duration: [{ duration: ["quick", "base", "pop", "settle", "fill", "burst"] }],
      "font-size": [{ text: ["display", "headline", "title", "section", "lead", "label"] }],
      readout: [{ text: ["readout"] }],
    },
    theme: {
      animate: ["settle", "pop", "hop", "fill", "spark", "tip"],
      container: ["column", "form", "wide"],
      ease: ["spring"],
      radius: ["option"],
    },
  },
});
