import "server-only";
import { prisma } from "@zoonk/db";
import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { clampEnergy } from "../../progress/energy";
import { getStepAnswerCounts } from "../contracts/answer-counts";
import { type AnswerResult } from "../contracts/check-answer";
import { type CompletionResult } from "../contracts/completion-input-schema";
import { type ScoreResult } from "../contracts/compute-score";
import { getCompletionEnergyContext } from "./_utils/completion-energy";
import { getCompletionReceipt } from "./_utils/completion-receipt";
import { getCompletionField, upsertDailyProgress } from "./_utils/daily-progress";
import { syncDurableCurriculumCompletion } from "./_utils/durable-curriculum-completion";

export class LessonSupersededError extends Error {
  readonly courseId: string | null;

  constructor(courseId: string | null) {
    super("The lesson was replaced by a newer curriculum");
    this.name = "LessonSupersededError";
    this.courseId = courseId;
  }
}

/**
 * Persists one validated lesson completion and its progress aggregates. Energy
 * decay and the earned score share one lock so concurrent completions cannot
 * apply inactivity twice or lose either completion's Energy change.
 */
export async function submitLessonCompletion(input: {
  courseRevision?: { courseId: string; contentRevision: number };
  durationSeconds: number;
  lessonId: string;
  score: ScoreResult;
  startedAt: Date;
  stepResults: {
    answer: object;
    answerCounts?: AnswerResult["answerCounts"];
    answeredAt: Date;
    dayOfWeek: number;
    durationSeconds: number;
    hourOfDay: number;
    isCorrect: boolean;
    stepId: string;
  }[];
  timeZone: string;
  userId: string;
}): Promise<CompletionResult> {
  const receipt = await getCompletionReceipt(input);

  if (receipt) {
    return receipt;
  }

  const reference =
    input.courseRevision ??
    (await prisma.lesson
      .findUnique({
        include: { chapter: { include: { course: true } } },
        where: { id: input.lessonId },
      })
      .then((lesson) =>
        lesson
          ? {
              contentRevision: lesson.chapter.course.contentRevision,
              courseId: lesson.chapter.courseId,
            }
          : null,
      ));

  if (!reference) {
    throw new LessonSupersededError(null);
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM courses WHERE id = ${reference.courseId}::uuid FOR UPDATE`;

    // Same-course completions share the lock; only the first identical attempt applies rewards.
    const savedReceipt = await getCompletionReceipt({ ...input, database: tx });

    if (savedReceipt) {
      return savedReceipt;
    }

    const current = await tx.lesson.findUnique({
      include: { chapter: { include: { course: true } } },
      where: { id: input.lessonId },
    });

    if (
      !current ||
      current.chapter.courseId !== reference.courseId ||
      current.chapter.course.contentRevision !== reference.contentRevision
    ) {
      throw new LessonSupersededError(reference.courseId);
    }

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
          correctAnswers: getStepAnswerCounts(step).correct,
          dayOfWeek: step.dayOfWeek,
          durationSeconds: step.durationSeconds,
          hourOfDay: step.hourOfDay,
          incorrectAnswers: getStepAnswerCounts(step).incorrect,
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

    const result: CompletionResult = {
      belt: calculateBeltLevel(newTotalBp),
      brainPower: input.score.brainPower,
      correctCount: input.score.correctCount,
      energyDelta: input.score.energyDelta,
      incorrectCount: input.score.incorrectCount,
      newTotalBp,
    };

    await tx.lessonCompletionReceipt.create({
      data: {
        originalLessonId: input.lessonId,
        result,
        startedAt: input.startedAt,
        userId: input.userId,
      },
    });

    return result;
  });
}
