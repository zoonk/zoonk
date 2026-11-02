import { BELT_COLORS_ORDER, type BeltColor } from "./belt-level";

export type BuddyKind = "zu" | "noodle" | "beep" | "otto";

export type BuddyGlasses = "round" | "star" | "aviator" | "catEye" | "retro" | "monocle";

export type BuddyStage = "baby" | "young" | "adult";

const BUDDY_STAGE_BY_BELT: Record<BeltColor, BuddyStage> = {
  black: "adult",
  blue: "adult",
  brown: "adult",
  gray: "adult",
  green: "young",
  orange: "young",
  purple: "adult",
  red: "adult",
  white: "baby",
  yellow: "baby",
};

export function getBuddyStage(beltColor: BeltColor): BuddyStage {
  return BUDDY_STAGE_BY_BELT[beltColor];
}

export type BuddyEnergyState = "napping" | "awake" | "glowing";

const MAX_BUDDY_ENERGY = 100;

const BUDDY_AWAKE_FROM_ENERGY = 30;

const BUDDY_GLOWING_FROM_ENERGY = 80;

export function getBuddyEnergyState(
  energy: number | null,
  { studiedToday = false }: { studiedToday?: boolean } = {},
): BuddyEnergyState {
  if (energy === null) {
    return "awake";
  }

  if (energy >= BUDDY_GLOWING_FROM_ENERGY) {
    return "glowing";
  }

  return energy < BUDDY_AWAKE_FROM_ENERGY && !studiedToday ? "napping" : "awake";
}

/** Null for an Adult buddy, which is fully grown. */
export function getNextBuddyStage(
  beltColor: BeltColor,
): { belt: BeltColor; stage: BuddyStage } | null {
  const current = getBuddyStage(beltColor);

  const belt = BELT_COLORS_ORDER.slice(BELT_COLORS_ORDER.indexOf(beltColor) + 1).find(
    (color) => getBuddyStage(color) !== current,
  );

  return belt ? { belt, stage: getBuddyStage(belt) } : null;
}

export function getBuddyGlow(energy: number | null): number {
  return energy === null ? 0 : Math.min(1, Math.max(0, energy / MAX_BUDDY_ENERGY));
}
