import { type BuddyGlasses, type MilestoneKind } from "@zoonk/db";
import { BELT_COLORS_ORDER, type BeltColor, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { getBuddyStage } from "@zoonk/utils/buddy";

/** Saturated at GLASSES_TARGETS; never treat these as exact lifetime totals. */
export type MilestoneCounts = {
  bigChallenges: number;
  bossesWon: number;
  capsulesOpened: number;
  finalBossesWon: number;
  fullMeals: number;
};

type EarnedGlasses = Exclude<BuddyGlasses, "round">;

export const GLASSES_TARGETS = {
  bigChallenges: 1,
  bossesWon: 1,
  capsulesOpened: 50,
  finalBossesWon: 1,
  fullMeals: 7,
} as const satisfies Readonly<Record<keyof MilestoneCounts, number>>;

const GLASSES_RULES: readonly { glasses: EarnedGlasses; metric: keyof MilestoneCounts }[] = [
  { glasses: "star", metric: "bossesWon" },
  { glasses: "aviator", metric: "bigChallenges" },
  { glasses: "catEye", metric: "fullMeals" },
  { glasses: "retro", metric: "capsulesOpened" },
  { glasses: "monocle", metric: "finalBossesWon" },
];

export type GlassesProgress = {
  current: number;
  earned: boolean;
  glasses: BuddyGlasses;
  target: number;
};

export function getGlassesProgress(counts: MilestoneCounts): GlassesProgress[] {
  return [
    { current: 0, earned: true, glasses: "round", target: 0 },
    ...GLASSES_RULES.map(({ glasses, metric }) => {
      const target = GLASSES_TARGETS[metric];

      return {
        current: Math.min(counts[metric], target),
        earned: counts[metric] >= target,
        glasses,
        target,
      };
    }),
  ];
}

export type MilestoneAward = { kind: MilestoneKind; key: string };

export function getEarnedGlasses(counts: MilestoneCounts): MilestoneAward[] {
  return getGlassesProgress(counts)
    .filter((progress) => progress.earned && progress.glasses !== "round")
    .map((progress) => ({ key: progress.glasses, kind: "glasses" }));
}

/** Counts only crossings in this interval, never retroactive ceremonies for an existing balance. */
export function getCrossedMilestones({
  after,
  before,
}: {
  after: number;
  before: number;
}): MilestoneAward[] {
  const from = BELT_COLORS_ORDER.indexOf(calculateBeltLevel(before).color);
  const to = BELT_COLORS_ORDER.indexOf(calculateBeltLevel(after).color);
  const crossed: BeltColor[] = BELT_COLORS_ORDER.slice(from + 1, to + 1);

  return crossed.flatMap((color, index) => {
    const previous = BELT_COLORS_ORDER[from + index] ?? color;
    const stage = getBuddyStage(color);
    const grew = stage !== getBuddyStage(previous);
    const belt: MilestoneAward = { key: color, kind: "belt" };

    return grew ? [belt, { key: stage, kind: "buddyStage" }] : [belt];
  });
}

export function getTrapHunterBadge(planItemId: string): MilestoneAward {
  return { key: `trapHunter:${planItemId}`, kind: "badge" };
}

const CEREMONY_PRIORITY: Readonly<Record<MilestoneKind, number>> = {
  badge: 3,
  belt: 1,
  buddyStage: 0,
  glasses: 2,
};

/** Returns at most one unshown milestone, newest first among equal priorities. */
export function pickCeremony<
  TMilestone extends { earnedAt: Date; kind: MilestoneKind; shownAt: Date | null },
>(milestones: readonly TMilestone[]): TMilestone | null {
  return (
    milestones
      .filter((milestone) => milestone.shownAt === null)
      .toSorted(
        (a, b) =>
          CEREMONY_PRIORITY[a.kind] - CEREMONY_PRIORITY[b.kind] ||
          b.earnedAt.getTime() - a.earnedAt.getTime(),
      )[0] ?? null
  );
}
