export type ScreenTurn = "back" | "forward";

/** A screen arriving from the side it was turned from; still under reduced motion. */
export const SCREEN_TURN_CLASS: Record<ScreenTurn, string> = {
  back: "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-8 motion-safe:duration-base motion-safe:ease-out",
  forward:
    "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-8 motion-safe:duration-base motion-safe:ease-out",
};
