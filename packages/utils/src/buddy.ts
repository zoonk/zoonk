import { BELT_COLORS_ORDER, type BeltColor } from "./belt-level";

/**
 * The learner's buddy. The profile stores the kind, an optional custom name
 * and the chosen glasses; growth and glow are always derived from the belt and
 * Energy, so buddies never need an economy of their own.
 */
export type BuddyKind = "zu" | "noodle" | "beep" | "otto";

/**
 * Every frame fits every buddy because they share one face layout. Round comes
 * with the buddy; the others are earned by fixed milestones, never at random.
 */
export type BuddyGlasses = "round" | "star" | "aviator" | "catEye" | "retro" | "monocle";

export type BuddyStage = "baby" | "young" | "adult" | "wise";

/**
 * Brain Power only goes up, so belts never regress and neither does the buddy:
 * each group of belts maps to one stage.
 */
const BUDDY_STAGE_BY_BELT: Record<BeltColor, BuddyStage> = {
  black: "wise",
  blue: "adult",
  brown: "adult",
  gray: "wise",
  green: "young",
  orange: "young",
  purple: "adult",
  red: "wise",
  white: "baby",
  yellow: "baby",
};

export function getBuddyStage(beltColor: BeltColor): BuddyStage {
  return BUDDY_STAGE_BY_BELT[beltColor];
}

export type BuddyEnergyState = "napping" | "awake" | "glowing";

const MAX_BUDDY_ENERGY = 100;

/**
 * Energy keeps today's rules (it rises slowly with right answers and drops by one a day away), so
 * the buddy's thresholds are settled on that scale: below 30 the buddy naps, from 80 it glows. A
 * learner who studied today never sees a napping buddy, since learning is what wakes it: a new
 * learner's buddy is awake from the first session even while Energy is still low.
 */
const BUDDY_AWAKE_FROM_ENERGY = 30;

const BUDDY_GLOWING_FROM_ENERGY = 80;

export function getBuddyEnergyState(
  /** Null before the learner has any Energy (no day of study has passed): the buddy just met them. */
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

/**
 * The buddy's next stage and the belt that brings it, or null for a Wise buddy, which has grown up.
 * Brain Power only goes up, so the next stage is always ahead.
 */
export function getNextBuddyStage(
  beltColor: BeltColor,
): { belt: BeltColor; stage: BuddyStage } | null {
  const current = getBuddyStage(beltColor);

  const belt = BELT_COLORS_ORDER.slice(BELT_COLORS_ORDER.indexOf(beltColor) + 1).find(
    (color) => getBuddyStage(color) !== current,
  );

  return belt ? { belt, stage: getBuddyStage(belt) } : null;
}

/** Energy (0–100) as the 0–1 opacity of the buddy's orange glow; none before any Energy. */
export function getBuddyGlow(energy: number | null): number {
  return energy === null ? 0 : Math.min(1, Math.max(0, energy / MAX_BUDDY_ENERGY));
}
