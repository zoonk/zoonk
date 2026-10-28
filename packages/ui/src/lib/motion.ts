export type MotionDuration = "base" | "burst" | "fill" | "frame" | "pop" | "quick" | "settle";

export type MotionEasing = "accelerate" | "follow" | "out" | "spring" | "swing";

const MS_PER_SECOND = 1000;

export const BEAT_MS = 250;
export const STAGGER_MS = 100;

/** 0 with reduced motion for the celebrations' tokens, and 0 where no stylesheet sets it. */
export function readDuration(element: Element, token: MotionDuration): number {
  const value = getComputedStyle(element).getPropertyValue(`--transition-duration-${token}`).trim();
  const time = /^(?<amount>\d*\.?\d+)(?<unit>ms|s)$/u.exec(value)?.groups;

  if (!time?.amount) {
    return 0;
  }

  const amount = Number(time.amount);
  return time.unit === "s" ? amount * MS_PER_SECOND : amount;
}

export function readEasing(element: Element, token: MotionEasing): string {
  return getComputedStyle(element).getPropertyValue(`--ease-${token}`).trim() || "ease-out";
}
