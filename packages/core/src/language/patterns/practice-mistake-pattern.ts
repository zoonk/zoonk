import "server-only";
import { prisma } from "@zoonk/db";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../cache/tags";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { applySessionProgress } from "../../sessions/_utils/session-progress";
import { getAnswersEnergyDelta, scoreAnswers } from "../../sessions/brain-power";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { recordLearningEvent } from "../../stats/record-learning-event";
import { getSession } from "../../users/get-session";
import { findOwnedPattern } from "./get-mistake-pattern";
import { type MistakePatternPracticeInput } from "./pattern-contract";

/** A three-minute drill, counted as its answers' time in today's totals. */
const DRILL_SECONDS = 180;

export type PracticeMistakePatternResult =
  | { result: { brainPower: number; correct: number; total: number }; status: "ready" }
  | { status: "invalid" | "notFound" | "unauthorized" };

/**
 * Finishes the three-minute drill of a pattern: each answer is checked against the drill, the drill
 * pays Brain Power like any practice (less when repeated) and counts toward today, and the pattern
 * leaves Today once practiced.
 */
export async function practiceMistakePattern({
  input,
  patternId,
}: {
  input: MistakePatternPracticeInput;
  patternId: string;
}): Promise<PracticeMistakePatternResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const owned = await findOwnedPattern({ patternId, userId });

  if (!owned) {
    return { status: "notFound" };
  }

  const { content, row } = owned;

  if (content.drill.length === 0 || input.answers.length !== content.drill.length) {
    return { status: "invalid" };
  }

  const verdicts = content.drill.map(
    (question, index) => input.answers[index]?.trim() === question.answer.trim(),
  );

  const correct = verdicts.filter(Boolean).length;
  const repeated = row.practicedAt !== null;

  const { brainPower } = scoreAnswers({
    answers: verdicts.map((isCorrect) => ({
      isCorrect,
      material: repeated ? "repeat" : "new",
      priorRightAnswers: repeated ? 1 : 0,
    })),
  });

  const timeZone = getAnswerTimeZone({ goal: null, timeZone: input.timeZone });
  const incorrect = verdicts.length - correct;

  await prisma.$transaction(async (tx) => {
    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });
    const energyDelta = getAnswersEnergyDelta({ correct, incorrect });

    await applySessionProgress(tx, {
      completion: true,
      delta: {
        brainPower,
        correctAnswers: correct,
        energyDelta,
        incorrectAnswers: incorrect,
        seconds: DRILL_SECONDS,
      },
      lock,
      userId,
    });

    await recordLearningEvent(tx, {
      brainPower,
      contentIds: { mistakePatternId: row.id },
      correctAnswers: correct,
      endedAt: lock.completedAt,
      energyDelta,
      goalId: row.goalId,
      incorrectAnswers: incorrect,
      kind: "questions",
      lessonKind: "patternDrill",
      seconds: DRILL_SECONDS,
      startedAt: lock.completedAt,
      timeZone,
      titleSnapshot: row.title,
      userId,
    });

    await tx.mistakePattern.update({
      data: { practicedAt: lock.completedAt },
      where: { id: row.id },
    });
  });

  revalidateCacheTags([getUserProgressCacheTag(userId)]);

  await trackLearnerEvents({
    events: [
      { name: "Mistake Pattern Practiced", properties: { correct, questions: verdicts.length } },
    ],
    goalId: row.goalId,
    userId,
  });

  return { result: { brainPower, correct, total: verdicts.length }, status: "ready" };
}
