/**
 * The motion tokens (`packages/ui/src/styles/globals.css`) as a script reads them, from the styles
 * an element resolves: an animation JavaScript runs (a number counting up) keeps the CSS's time
 * and curve, and with reduced motion, whose celebration durations are 0, it shows its end state.
 */

/** A duration token: `duration-<name>` in Tailwind, `--transition-duration-<name>` in CSS. */
export type MotionDuration = "base" | "burst" | "fill" | "pop" | "quick" | "settle";

/** An easing token: `ease-<name>` in Tailwind, `--ease-<name>` in CSS. */
export type MotionEasing = "out" | "spring";

const MS_PER_SECOND = 1000;

/**
 * A duration token in milliseconds as `element` resolves it: 0 with reduced motion for the
 * celebrations' tokens, and 0 where no stylesheet sets it, so a script never animates blind.
 */
export function readDuration(element: Element, token: MotionDuration): number {
  const value = getComputedStyle(element).getPropertyValue(`--transition-duration-${token}`).trim();
  const time = /^(?<amount>\d*\.?\d+)(?<unit>ms|s)$/u.exec(value)?.groups;

  if (!time?.amount) {
    return 0;
  }

  const amount = Number(time.amount);
  return time.unit === "s" ? amount * MS_PER_SECOND : amount;
}

/** An easing token as `element` resolves it, for `element.animate()`; ease-out without one. */
export function readEasing(element: Element, token: MotionEasing): string {
  return getComputedStyle(element).getPropertyValue(`--ease-${token}`).trim() || "ease-out";
}
