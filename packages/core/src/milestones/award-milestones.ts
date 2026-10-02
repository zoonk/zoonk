import "server-only";
import { type Milestone, prisma } from "@zoonk/db";
import { CHECKPOINT_LEDGER_KINDS } from "../checkpoints/_utils/checkpoint-results";
import { getPassMark, hasPassedCheckpoint } from "../checkpoints/checkpoint-rules";
import {
  type MilestoneAward,
  type MilestoneCounts,
  getCrossedMilestones,
  getEarnedGlasses,
} from "./milestone-rules";

/** The ledger's count of opened capsules: one `review` row per capsule, marked as such. */
export const CAPSULE_LEDGER_KIND = "capsule";

/** Counts what glasses are earned from, all from learner rows that outlive content. */
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
      where: { endedAt: { not: null }, lessonKind: CHECKPOINT_LEDGER_KINDS.weekly, userId },
    }),
    prisma.learningEvent.count({
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
    bossesWon: won.length,
    capsulesOpened,
    finalBossesWon: won.filter((boss) => boss.lessonKind === CHECKPOINT_LEDGER_KINDS.finalBoss)
      .length,
    fullMeals,
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
  userId,
}: {
  badges?: readonly MilestoneAward[];
  /** Brain Power before and after the activity, to find belts crossed. */
  brainPower: { after: number; before: number } | null;
  userId: string;
}): Promise<Milestone[]> {
  const [counts, profile] = await Promise.all([
    loadMilestoneCounts(userId),
    prisma.userLearningProfile.findUnique({ select: { buddyKind: true }, where: { userId } }),
  ]);

  const awards = [
    ...getEarnedGlasses(counts),
    ...(brainPower
      ? getCrossedMilestones({ ...brainPower, hasBuddy: Boolean(profile?.buddyKind) })
      : []),
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

  await prisma.milestone.createMany({
    data: missing.map((award) => ({ ...award, userId })),
    skipDuplicates: true,
  });

  return prisma.milestone.findMany({
    orderBy: { earnedAt: "asc" },
    where: { OR: missing.map((award) => ({ key: award.key, kind: award.kind })), userId },
  });
}
