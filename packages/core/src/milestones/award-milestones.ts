import "server-only";
import { type Milestone, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../cache/tags";
import { CHECKPOINT_LEDGER_KINDS } from "../checkpoints/_utils/checkpoint-results";
import { getPassMark, hasPassedCheckpoint } from "../checkpoints/checkpoint-rules";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { type BrainPowerReward } from "./milestone-reward";
import {
  GLASSES_TARGETS,
  type MilestoneAward,
  type MilestoneCounts,
  getCrossedMilestones,
  getEarnedGlasses,
} from "./milestone-rules";

export const CAPSULE_LEDGER_KIND = "capsule";

/** Counts saturate at glasses targets and are not exact lifetime totals. */
export async function loadMilestoneCounts(userId: string): Promise<MilestoneCounts> {
  const [bosses, bigChallenges, capsulesOpened, fullMeals] = await Promise.all([
    prisma.learningEvent.findMany({
      select: { correctAnswers: true, incorrectAnswers: true, lessonKind: true },
      where: {
        endedAt: { not: null },
        kind: "checkpoint",
        lessonKind: { in: [CHECKPOINT_LEDGER_KINDS.boss, CHECKPOINT_LEDGER_KINDS.finalBoss] },
        userId,
      },
    }),
    prisma.learningEvent.count({
      take: GLASSES_TARGETS.bigChallenges,
      where: { endedAt: { not: null }, lessonKind: CHECKPOINT_LEDGER_KINDS.weekly, userId },
    }),
    prisma.learningEvent.count({
      take: GLASSES_TARGETS.capsulesOpened,
      where: { kind: "review", lessonKind: CAPSULE_LEDGER_KIND, userId },
    }),
    prisma.studySession.count({ where: { fullMealAt: { not: null }, userId } }),
  ]);

  const won = bosses.filter((boss) =>
    hasPassedCheckpoint({
      correct: boss.correctAnswers,
      passMark: getPassMark(boss.correctAnswers + boss.incorrectAnswers),
    }),
  );

  return {
    bigChallenges,
    bossesWon: Math.min(won.length, GLASSES_TARGETS.bossesWon),
    capsulesOpened,
    finalBossesWon: Math.min(
      won.filter((boss) => boss.lessonKind === CHECKPOINT_LEDGER_KINDS.finalBoss).length,
      GLASSES_TARGETS.finalBossesWon,
    ),
    fullMeals: Math.min(fullMeals, GLASSES_TARGETS.fullMeals),
  };
}

/** Returns only newly inserted milestones; repeating an award has no effect. */
export async function awardMilestones({
  badges = [],
  brainPower,
  brainPowerRewards = [],
  userId,
}: {
  badges?: readonly MilestoneAward[];
  brainPower: { after: number; before: number } | null;
  /** Separately paid rewards retain their own intervals, including across account linking. */
  brainPowerRewards?: readonly BrainPowerReward[];
  userId: string;
}): Promise<Milestone[]> {
  const counts = await loadMilestoneCounts(userId);

  const awards = [
    ...getEarnedGlasses(counts),
    ...[...(brainPower ? [brainPower] : []), ...brainPowerRewards].flatMap((reward) =>
      getCrossedMilestones(reward),
    ),
    ...badges,
  ];

  if (awards.length === 0) {
    return [];
  }

  const byAward = awards.map((award) => ({ key: award.key, kind: award.kind }));
  const existing = await prisma.milestone.findMany({ where: { OR: byAward, userId } });

  const missing = awards.filter(
    (award) => !existing.some((row) => row.kind === award.kind && row.key === award.key),
  );

  if (missing.length === 0) {
    return [];
  }

  const inserted = await prisma.$transaction(async (tx) => {
    await markLearnerChanged(tx, { userId });

    const { count } = await tx.milestone.createMany({
      data: missing.map((award) => ({ ...award, userId })),
      skipDuplicates: true,
    });

    return count;
  });

  if (inserted > 0) {
    revalidateCacheTags([getUserProgressCacheTag(userId)]);
  }

  return prisma.milestone.findMany({
    orderBy: { earnedAt: "asc" },
    where: { OR: missing.map((award) => ({ key: award.key, kind: award.kind })), userId },
  });
}
