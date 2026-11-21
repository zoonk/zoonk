import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../cache/tags";
import { createLearnerAttempt } from "../../learner/_utils/create-learner-attempt";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { readPendingTopicWalkAssessmentId } from "../../learner/placement/_utils/placement-attempt-record";
import { gradeSessionAnswer, parseSessionItem } from "../../sessions/_utils/session-items";
import { pickTestOutQuestions } from "./_utils/level-test-out-items";
import {
  loadTestOutAnswers,
  nextTestOutQuestion,
  readTestOutView,
  saveTestOut,
} from "./_utils/level-test-out-state";
import { type LevelTestOutAnswer, type LevelTestOutLevel } from "./level-test-out-contract";
import { hasOpenLanguageTopicWalk, readLevelTestAttempts } from "./read-level-test-summary";

export type LanguageLevelTestOutResult =
  | { status: "invalid" | "notFound" | "notLanguage" | "unauthorized" }
  | { status: "ready"; test: Awaited<ReturnType<typeof readTestOutView>> };

export async function getLanguageLevelTestOut({
  attemptId,
  goalId,
}: {
  attemptId: string;
  goalId: string;
}): Promise<LanguageLevelTestOutResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;

  if (goal.kind !== "language") {
    return { status: "notLanguage" };
  }

  const { testOut } = readLevelTestAttempts(goal);

  return testOut?.id === attemptId
    ? { status: "ready", test: await readTestOutView({ progress: testOut, tx: prisma, userId }) }
    : { status: "notFound" };
}

export async function startLanguageLevelTestOut({
  goalId,
  level,
}: {
  goalId: string;
  level: LevelTestOutLevel;
}): Promise<LanguageLevelTestOutResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;

  if (goal.kind !== "language") {
    return { status: "notLanguage" };
  }

  const id = await writeLearnerChange({ userId }, async (tx) => {
    const current = await tx.goal.findUniqueOrThrow({ where: { id: goalId, userId } });
    const { attempt, testOut } = readLevelTestAttempts(current);

    if (
      hasOpenLanguageTopicWalk(current) ||
      readPendingTopicWalkAssessmentId(current) !== null ||
      (attempt && (!attempt.result || attempt.placement?.unannounced.length))
    ) {
      return unchanged(null);
    }

    if (testOut && (!testOut.result || testOut.result.unannounced.length > 0)) {
      return unchanged(testOut.id);
    }

    const questions = await pickTestOutQuestions({
      goalId,
      level,
      timeZone: getAnswerTimeZone({ goal }),
      tx,
      userId,
    });

    if (questions.length === 0) {
      return unchanged(null);
    }

    const progress = { id: randomUUID(), level, questions };
    await saveTestOut({ goal: current, progress, tx });
    return progress.id;
  });

  if (!id) {
    return { status: "invalid" };
  }

  revalidateCacheTags([getGoalsCacheTag(userId)]);
  return getLanguageLevelTestOut({ attemptId: id, goalId });
}

export async function answerLanguageLevelTestOut({
  goalId,
  input,
}: {
  goalId: string;
  input: LevelTestOutAnswer;
}): Promise<LanguageLevelTestOutResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;

  if (goal.kind !== "language") {
    return { status: "notLanguage" };
  }

  await writeLearnerChange({ userId }, async (tx) => {
    const current = await tx.goal.findUniqueOrThrow({ where: { id: goalId, userId } });
    const { testOut } = readLevelTestAttempts(current);

    if (testOut?.id !== input.attemptId || testOut.result) {
      return unchanged(null);
    }

    const answers = await loadTestOutAnswers({ progress: testOut, tx, userId });

    const next = await nextTestOutQuestion({
      answered: new Set(answers.map(({ itemId }) => itemId)),
      progress: testOut,
      tx,
    });

    if (!next || next.row.id !== input.itemId) {
      return unchanged(null);
    }

    const item = parseSessionItem(next.row);

    if (!item) {
      return unchanged(null);
    }

    const graded = gradeSessionAnswer({ answer: input.answer, blockId: testOut.id, item });

    await createLearnerAttempt({
      answeredAt: new Date(),
      input: {
        answer: graded.recorded,
        focusTestId: testOut.id,
        graded: { durationMs: input.durationMs, isCorrect: graded.isCorrect },
        isPlacement: true,
        itemId: item.id,
        language: goal.language,
        purpose: "diagnostic",
        skillId: item.skillId,
        targetLanguage: goal.targetLanguage,
        timeZone: getAnswerTimeZone({ goal }),
        userId,
      },
      transaction: tx,
    });

    return null;
  });

  return getLanguageLevelTestOut({ attemptId: input.attemptId, goalId });
}
