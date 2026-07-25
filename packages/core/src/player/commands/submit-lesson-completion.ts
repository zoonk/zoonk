import "server-only";
import { prisma } from "@zoonk/db";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { clampEnergy } from "../../progress/energy";
import { type ScoreResult } from "../contracts/compute-score";
import { getCompletionEnergyContext } from "./_utils/completion-energy";
import { getCompletionField, upsertDailyProgress } from "./_utils/daily-progress";
import { syncDurableCurriculumCompletion } from "./_utils/durable-curriculum-completion";

/**
 * Persists one validated lesson completion and its progress aggregates. Energy
 * decay and the earned score share one lock so concurrent completions cannot
 * apply inactivity twice or lose either completion's Energy change.
 */
export async function submitLessonCompletion(input: {
  durationSeconds: number;
  lessonId: string;
  score: ScoreResult;
  startedAt: Date;
  stepResults: {
    answer: object;
    answeredAt: Date;
    dayOfWeek: number;
    durationSeconds: number;
    hourOfDay: number;
    isCorrect: boolean;
    stepId: string;
  }[];
  timeZone: string;
  userId: string;
}): Promise<{
  belt: BeltLevelResult;
  brainPower: number;
  energyDelta: number;
  newTotalBp: number;
}> {
  return prisma.$transaction(async (tx) => {
    const { completedAt, completionDate, currentEnergy } = await getCompletionEnergyContext({
      timeZone: input.timeZone,
      transaction: tx,
      userId: input.userId,
    });

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
          stepId: step.stepId,
          userId: input.userId,
        })),
      });
    }

    await tx.lessonProgress.upsert({
      create: {
        completedAt,
        completedDate: completionDate,
        durationSeconds: input.durationSeconds,
        lessonId: input.lessonId,
        startedAt: input.startedAt,
        userId: input.userId,
      },
      update: {},
      where: { userLesson: { lessonId: input.lessonId, userId: input.userId } },
    });

    // A review completion is fresh practice, not a new first-completion event.
    // Only start-only rows should cross the completed boundary here; completed rows
    // keep their original timestamp, learner-local date, and duration so
    // completion metrics do not move backward when a learner revisits a lesson.
    await tx.lessonProgress.updateMany({
      data: { completedAt, completedDate: completionDate, durationSeconds: input.durationSeconds },
      where: { completedAt: null, lessonId: input.lessonId, userId: input.userId },
    });

    await syncDurableCurriculumCompletion(tx, { lessonId: input.lessonId, userId: input.userId });

    const clampedEnergy = clampEnergy(currentEnergy + input.score.energyDelta);

    const updatedProgress = await tx.userProgress.update({
      data: {
        currentEnergy: clampedEnergy,
        lastActiveAt: completedAt,
        totalBrainPower: { increment: input.score.brainPower },
      },
      where: { userId: input.userId },
    });

    const field = getCompletionField(input);

    await upsertDailyProgress(tx, {
      clampedEnergy,
      date: completionDate,
      dayOfWeek: completionDate.getUTCDay(),
      durationSeconds: input.durationSeconds,
      field,
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
