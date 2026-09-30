import { type BuddyGlasses, type MilestoneKind } from "@zoonk/db";
import { BELT_COLORS_ORDER, type BeltColor, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { getBuddyStage } from "@zoonk/utils/buddy";

/**
 * Milestones come from the ledger, never from chance, and each says upfront how it's earned.
 * Glasses: Round comes with the buddy, Star for the first boss beaten, Aviator for the first Big
 * Challenge, Cat-eye for seven full meals, Retro for fifty capsules opened and Monocle for the final
 * boss. Badges ("Trap hunter" for a boss won) go to the logbook. A new belt color and the buddy's next
 * stage are celebrated once each.
 */
export type MilestoneCounts = {
  bigChallenges: number;
  bossesWon: number;
  capsulesOpened: number;
  finalBossesWon: number;
  fullMeals: number;
};

type EarnedGlasses = Exclude<BuddyGlasses, "round">;

const GLASSES_RULES: readonly {
  glasses: EarnedGlasses;
  metric: keyof MilestoneCounts;
  target: number;
}[] = [
  { glasses: "star", metric: "bossesWon", target: 1 },
  { glasses: "aviator", metric: "bigChallenges", target: 1 },
  { glasses: "catEye", metric: "fullMeals", target: 7 },
  { glasses: "retro", metric: "capsulesOpened", target: 50 },
  { glasses: "monocle", metric: "finalBossesWon", target: 1 },
];

export type GlassesProgress = {
  current: number;
  earned: boolean;
  glasses: BuddyGlasses;
  target: number;
};

/** Every pair of glasses with how far the learner is: "4/7 full meals", "38/50 capsules". */
export function getGlassesProgress(counts: MilestoneCounts): GlassesProgress[] {
  return [
    { current: 0, earned: true, glasses: "round", target: 0 },
    ...GLASSES_RULES.map((rule) => ({
      current: Math.min(counts[rule.metric], rule.target),
      earned: counts[rule.metric] >= rule.target,
      glasses: rule.glasses,
      target: rule.target,
    })),
  ];
}

export type MilestoneAward = { kind: MilestoneKind; key: string };

/** Glasses the counts have earned. */
export function getEarnedGlasses(counts: MilestoneCounts): MilestoneAward[] {
  return getGlassesProgress(counts)
    .filter((progress) => progress.earned && progress.glasses !== "round")
    .map((progress) => ({ key: progress.glasses, kind: "glasses" }));
}

/**
 * Belt colors, and the buddy stages they bring, crossed between two Brain Power totals. Only what
 * was crossed counts, so a learner who arrives with Brain Power from before never gets a ceremony
 * for a belt they already had.
 */
export function getCrossedMilestones({
  after,
  before,
  hasBuddy,
}: {
  after: number;
  before: number;
  hasBuddy: boolean;
}): MilestoneAward[] {
  const from = BELT_COLORS_ORDER.indexOf(calculateBeltLevel(before).color);
  const to = BELT_COLORS_ORDER.indexOf(calculateBeltLevel(after).color);
  const crossed: BeltColor[] = BELT_COLORS_ORDER.slice(from + 1, to + 1);

  return crossed.flatMap((color, index) => {
    const previous = BELT_COLORS_ORDER[from + index] ?? color;
    const stage = getBuddyStage(color);
    const grew = hasBuddy && stage !== getBuddyStage(previous);
    const belt: MilestoneAward = { key: color, kind: "belt" };

    return grew ? [belt, { key: stage, kind: "buddyStage" }] : [belt];
  });
}

/** A boss won puts a "Trap hunter" badge in the logbook, one per boss. */
export function getTrapHunterBadge(planItemId: string): MilestoneAward {
  return { key: `trapHunter:${planItemId}`, kind: "badge" };
}

/** The buddy growing matters most, then a new belt, then glasses, then badges. */
const CEREMONY_PRIORITY: Readonly<Record<MilestoneKind, number>> = {
  badge: 3,
  belt: 1,
  buddyStage: 0,
  glasses: 2,
};

/**
 * At most one ceremony per session: the most important milestone not shown yet, the newest first
 * among equals. The rest show quietly in the logbook and the buddy's page.
 */
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
