import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import {
  getLessonScreenSkillId,
  isNotebookQuestionStep,
} from "../../src/library/lessons/_utils/lesson-screen-skill";
import { lockSkillAttribution } from "../../src/library/skills/_utils/lock-skill-attribution";

type Repair = { id: string; skillId: string };
type RecoveryScope = { lessonIds?: string[]; userIds?: string[] };
type RecoveryCounts = { recoverable: number; repaired: number; unresolved: number };

/** Group null-only updates by attribution so a production run needs no write per learner row. */
async function applyRepairs({
  dryRun,
  repairs,
  update,
}: {
  dryRun: boolean;
  repairs: Repair[];
  update: (repair: { ids: string[]; skillId: string }) => Promise<{ count: number }>;
}): Promise<number> {
  if (dryRun) {
    return 0;
  }

  const groups = new Map<string, string[]>();

  for (const repair of repairs) {
    const ids = groups.get(repair.skillId) ?? [];
    ids.push(repair.id);
    groups.set(repair.skillId, ids);
  }

  // An interactive transaction has one connection; queue each group on it in order.
  return [...groups].reduce(async (previous, [skillId, ids]) => {
    const total = await previous;
    const result = await update({ ids, skillId });
    return total + result.count;
  }, Promise.resolve(0));
}

function counts({
  repaired,
  repairs,
  total,
}: {
  repaired: number;
  repairs: Repair[];
  total: number;
}): RecoveryCounts {
  return { recoverable: repairs.length, repaired, unresolved: total - repairs.length };
}

async function repairSteps({
  dryRun,
  scope,
  tx,
}: {
  dryRun: boolean;
  scope: RecoveryScope;
  tx: TransactionClient;
}) {
  const steps = await tx.step.findMany({
    include: {
      lesson: {
        select: {
          skills: {
            orderBy: [{ createdAt: "asc" }, { skillId: "asc" }],
            select: { skillId: true },
          },
        },
      },
    },
    omit: { content: true },
    where: {
      lessonId: scope.lessonIds ? { in: scope.lessonIds } : undefined,
      skillId: null,
      ...(scope.userIds && {
        OR: [
          { attempts: { some: { userId: { in: scope.userIds } } } },
          { mistakes: { some: { userId: { in: scope.userIds } } } },
        ],
      }),
    },
  });

  const questions = steps.filter((step) => isNotebookQuestionStep(step));

  const repairs = questions.flatMap((step) => {
    const skillId = getLessonScreenSkillId({
      lessonSkillIds: step.lesson.skills.map((link) => link.skillId),
      skillId: null,
    });

    return skillId ? [{ id: step.id, skillId }] : [];
  });

  const repaired = await applyRepairs({
    dryRun,
    repairs,
    update: ({ ids, skillId }) =>
      tx.step.updateMany({ data: { skillId }, where: { id: { in: ids }, skillId: null } }),
  });

  return {
    counts: counts({ repaired, repairs, total: questions.length }),
    skillIds: new Map(repairs.map((repair) => [repair.id, repair.skillId])),
  };
}

async function repairAttempts({
  dryRun,
  scope,
  stepSkills,
  tx,
}: {
  dryRun: boolean;
  scope: RecoveryScope;
  stepSkills: Map<string, string>;
  tx: TransactionClient;
}) {
  const attempts = await tx.attempt.findMany({
    include: {
      item: { select: { skillId: true } },
      step: { select: { kind: true, skillId: true } },
    },
    omit: { answer: true },
    where: {
      skillId: null,
      step: scope.lessonIds ? { lessonId: { in: scope.lessonIds } } : undefined,
      userId: scope.userIds ? { in: scope.userIds } : undefined,
    },
  });

  const repairs = attempts.flatMap((attempt) => {
    const skillId =
      attempt.step?.skillId ??
      (attempt.stepId ? stepSkills.get(attempt.stepId) : null) ??
      attempt.item?.skillId;

    return skillId ? [{ id: attempt.id, skillId }] : [];
  });

  const repaired = await applyRepairs({
    dryRun,
    repairs,
    update: ({ ids, skillId }) =>
      tx.attempt.updateMany({ data: { skillId }, where: { id: { in: ids }, skillId: null } }),
  });

  return {
    counts: counts({ repaired, repairs, total: attempts.length }),
    skillIds: new Map(repairs.map((repair) => [repair.id, repair.skillId])),
  };
}

async function repairMistakes({
  attemptSkills,
  dryRun,
  scope,
  stepSkills,
  tx,
}: {
  attemptSkills: Map<string, string>;
  dryRun: boolean;
  scope: RecoveryScope;
  stepSkills: Map<string, string>;
  tx: TransactionClient;
}) {
  const mistakes = await tx.mistake.findMany({
    include: {
      attempt: {
        select: {
          item: { select: { skillId: true } },
          skillId: true,
          step: { select: { skillId: true } },
          stepId: true,
        },
      },
      item: { select: { skillId: true } },
      step: { select: { skillId: true } },
    },
    omit: { snapshot: true },
    where: {
      skillId: null,
      userId: scope.userIds ? { in: scope.userIds } : undefined,
      ...(scope.lessonIds && {
        OR: [
          { step: { lessonId: { in: scope.lessonIds } } },
          { attempt: { step: { lessonId: { in: scope.lessonIds } } } },
        ],
      }),
    },
  });

  const repairs = mistakes.flatMap((mistake) => {
    const skillId =
      mistake.attempt?.skillId ??
      (mistake.attemptId ? attemptSkills.get(mistake.attemptId) : null) ??
      mistake.step?.skillId ??
      (mistake.stepId ? stepSkills.get(mistake.stepId) : null) ??
      mistake.attempt?.step?.skillId ??
      (mistake.attempt?.stepId ? stepSkills.get(mistake.attempt.stepId) : null) ??
      mistake.item?.skillId ??
      mistake.attempt?.item?.skillId;

    return skillId ? [{ id: mistake.id, skillId }] : [];
  });

  const repaired = await applyRepairs({
    dryRun,
    repairs,
    update: ({ ids, skillId }) =>
      tx.mistake.updateMany({ data: { skillId }, where: { id: { in: ids }, skillId: null } }),
  });

  return counts({ repaired, repairs, total: mistakes.length });
}

/**
 * One-off attribution recovery, not a learner mutation capability. Repairs only null pointers
 * from surviving content/answer links, never snapshots, verdicts, status, FSRS or analytics.
 * Dry runs carry proposed step/attempt skills through the same derivation without writing.
 */
export function backfillLessonMistakes({ dryRun, ...scope }: RecoveryScope & { dryRun: boolean }) {
  return prisma.$transaction(
    async (tx) => {
      await lockSkillAttribution({ mode: "recovery", tx });

      const steps = await repairSteps({ dryRun, scope, tx });
      const attempts = await repairAttempts({ dryRun, scope, stepSkills: steps.skillIds, tx });

      const mistakes = await repairMistakes({
        attemptSkills: attempts.skillIds,
        dryRun,
        scope,
        stepSkills: steps.skillIds,
        tx,
      });

      return { attempts: attempts.counts, dryRun, mistakes, steps: steps.counts };
    },
    { timeout: 120_000 },
  );
}
