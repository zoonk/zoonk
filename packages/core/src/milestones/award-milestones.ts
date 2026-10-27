import "server-only";
import { type Milestone, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
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

/** The ledger's count of opened capsules: one `review` row per capsule, marked as such. */
export const CAPSULE_LEDGER_KIND = "capsule";

/** A competing award owns the new rows; this transaction's redundant marks must roll back. */
class MilestoneAwardUnchangedError extends Error {
  override name = "MilestoneAwardUnchangedError";
}

/** Counts toward glasses targets, saturated at each target, from rows that outlive content. */
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

/**
 * Records every milestone the learner has now earned and returns the new ones: glasses from the
 * ledger's counts, belts and buddy stages crossed by Brain Power just earned, and badges from the
 * activity that just ended. Each is stored once, so running it again changes nothing.
 */
export async function awardMilestones({
  badges = [],
  brainPower,
  brainPowerRewards = [],
  userId,
}: {
  badges?: readonly MilestoneAward[];
  /** Brain Power before and after the activity, to find belts crossed. */
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

  const { error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { userId });

      const { count } = await tx.milestone.createMany({
        data: missing.map((award) => ({ ...award, userId })),
        skipDuplicates: true,
      });

      if (count === 0) {
        throw new MilestoneAwardUnchangedError("The milestones were already awarded");
      }
    }),
  );

  if (error && !(error instanceof MilestoneAwardUnchangedError)) {
    throw error;
  }

  if (!error) {
    revalidateCacheTags([getUserProgressCacheTag(userId)]);
  }

  return prisma.milestone.findMany({
    orderBy: { earnedAt: "asc" },
    where: { OR: missing.map((award) => ({ key: award.key, kind: award.kind })), userId },
  });
}
