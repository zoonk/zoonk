import "server-only";
import { prisma } from "@zoonk/db";
import { type ScoreResult } from "@zoonk/player/compute-score";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { MS_PER_DAY, parseLocalDate } from "@zoonk/utils/date";
import { clampEnergy, computeDecayedEnergy, toUTCMidnight } from "@zoonk/utils/energy";
import { fillDecayGaps, getCompletionField, upsertDailyProgress } from "./_utils/daily-progress";
import { syncDurableCurriculumCompletion } from "./_utils/durable-curriculum-completion";

const MAX_LOCAL_DATE_DRIFT_MS = 2 * MS_PER_DAY;

export async function submitActivityCompletion(input: {
  activityId: bigint;
  durationSeconds: number;
  localDate: string;
  organizationId: number | null;
  score: ScoreResult;
  startedAt: Date;
  stepResults: {
    answer: object;
    answeredAt: Date;
    dayOfWeek: number;
    durationSeconds: number;
    hourOfDay: number;
    isCorrect: boolean;
    stepId: bigint;
  }[];
  userId: number;
}): Promise<{
  belt: BeltLevelResult;
  brainPower: number;
  energyDelta: number;
  newTotalBp: number;
}> {
  const now = new Date();
  const today = parseLocalDate(input.localDate);

  // localDate is client-provided, so a malicious client could send a far-future
  // date and cause fillDecayGaps to create millions of records. The ±48h window
  // is generous enough for all real timezone differences (max ~14h).
  if (Math.abs(today.getTime() - now.getTime()) > MAX_LOCAL_DATE_DRIFT_MS) {
    throw new Error("localDate is too far from server time");
  }

  return prisma.$transaction(async (tx) => {
    // Create StepAttempt records
    if (input.stepResults.length > 0) {
      await tx.stepAttempt.createMany({
        data: input.stepResults.map((step) => ({
          answer: step.answer,
          answeredAt: step.answeredAt,
          dayOfWeek: step.dayOfWeek,
          durationSeconds: step.durationSeconds,
          hourOfDay: step.hourOfDay,
          isCorrect: step.isCorrect,
          organizationId: input.organizationId,
          stepId: step.stepId,
          userId: input.userId,
        })),
      });
    }

    // ActivityProgress upsert
    await tx.activityProgress.upsert({
      create: {
        activityId: input.activityId,
        completedAt: now,
        durationSeconds: input.durationSeconds,
        startedAt: input.startedAt,
        userId: input.userId,
      },
      update: {
        completedAt: now,
        durationSeconds: input.durationSeconds,
      },
      where: {
        userActivity: {
          activityId: input.activityId,
          userId: input.userId,
        },
      },
    });

    const { courseId } = await syncDurableCurriculumCompletion(tx, {
      activityId: input.activityId,
      userId: input.userId,
    });

    // CourseUser + userCount (only on first completion per course)
    const { count } = await tx.courseUser.createMany({
      data: [{ courseId, userId: input.userId }],
      skipDuplicates: true,
    });

    if (count > 0) {
      await tx.course.update({
        data: { userCount: { increment: 1 } },
        where: { id: courseId },
      });
    }

    // Find existing UserProgress to apply decay
    const existingProgress = await tx.userProgress.findUnique({
      where: { userId: input.userId },
    });

    const decayedBase = existingProgress
      ? computeDecayedEnergy(existingProgress.currentEnergy, existingProgress.lastActiveAt, today)
      : 0;

    // Fill DailyProgress records for inactive days
    if (existingProgress) {
      const lastActiveDate = toUTCMidnight(existingProgress.lastActiveAt);
      await fillDecayGaps(tx, input.userId, existingProgress.currentEnergy, lastActiveDate, today);
    }

    const clampedEnergy = clampEnergy(decayedBase + input.score.energyDelta);

    // Absolute write is safe: the interactive transaction serializes row access,
    // so concurrent requests block until the prior commit completes.

    const updatedProgress = await tx.userProgress.upsert({
      create: {
        currentEnergy: clampedEnergy,
        lastActiveAt: now,
        totalBrainPower: input.score.brainPower,
        userId: input.userId,
      },
      update: {
        currentEnergy: clampedEnergy,
        lastActiveAt: now,
        totalBrainPower: { increment: input.score.brainPower },
      },
      where: { userId: input.userId },
    });

    // DailyProgress upsert for today
    const field = getCompletionField(input);

    await upsertDailyProgress(tx, {
      clampedEnergy,
      date: today,
      dayOfWeek: today.getUTCDay(),
      durationSeconds: input.durationSeconds,
      field,
      organizationId: input.organizationId,
      score: input.score,
      userId: input.userId,
    });

    const newTotalBp = Number(updatedProgress.totalBrainPower);

    return {
      belt: calculateBeltLevel(newTotalBp),
      brainPower: input.score.brainPower,
      energyDelta: input.score.energyDelta,
      newTotalBp,
    };
  });
}
