import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { gradedTestAnswer, testEventContext, trackTestEvents } from "../../analytics/test-events";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../cache/tags";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { createLearnerAttempt } from "../../learner/_utils/create-learner-attempt";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { gradeSessionAnswer, parseSessionItem } from "../../sessions/_utils/session-items";
import {
  availableLevelTestOut,
  listTestOutSkillIds,
  readTestOutBank,
} from "./_utils/level-test-out-items";
import {
  loadTestOutAnswers,
  nextTestOutQuestion,
  readTestOutView,
  saveTestOut,
} from "./_utils/level-test-out-state";
import {
  type LevelTestOutAnswer,
  type LevelTestOutLevel,
  type LevelTestOutProgress,
  isOpenLevelTestOut,
} from "./level-test-out-contract";
import { readLevelTestAttempts, readLevelTestSummary } from "./read-level-test-summary";

const PREPARATION_WINDOW_MS = 10 * 60 * 1000;

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
    ? {
        status: "ready",
        test: await readTestOutView({ goalId, progress: testOut, tx: prisma, userId }),
      }
    : { status: "notFound" };
}

export async function getNextAvailableLevelTestOut(goalId: string) {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready" || owned.goal.kind !== "language") {
    return null;
  }

  const { goal, userId } = owned;
  const { eligibleTestOutLevels, openTestOutLevel } = readLevelTestSummary(goal);

  return (
    openTestOutLevel ??
    availableLevelTestOut({
      goalId,
      levels: eligibleTestOutLevels,
      timeZone: getAnswerTimeZone({ goal }),
      userId,
    })
  );
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

  const opened = await writeLearnerChange({ userId }, async (tx) => {
    const current = await tx.goal.findUniqueOrThrow({ where: { id: goalId, userId } });
    const { attempt, testOut } = readLevelTestAttempts(current);

    if (attempt && !attempt.result) {
      return unchanged(null);
    }

    if (testOut && isOpenLevelTestOut(testOut)) {
      return unchanged({ id: testOut.id, started: false as const });
    }

    const skillIds = await listTestOutSkillIds({
      goalId,
      level,
      timeZone: getAnswerTimeZone({ goal }),
      tx,
      userId,
    });

    if (
      skillIds.length === 0 &&
      testOut?.level === level &&
      testOut.questions.length === 0 &&
      !testOut.preparingUntil &&
      !testOut.result
    ) {
      return unchanged({ id: testOut.id, started: false as const });
    }

    const { questions } =
      skillIds.length > 0 ? await readTestOutBank({ skillIds, tx, userId }) : { questions: [] };

    const progress: LevelTestOutProgress = { id: randomUUID(), level, questions };

    if (skillIds.length > 0 && questions.length === 0) {
      progress.preparingUntil = new Date(Date.now() + PREPARATION_WINDOW_MS).toISOString();

      await oweFollowUps({
        db: tx,
        followUps: [
          { input: { attemptId: progress.id, goalId, skillIds }, kind: "prepareLevelTestOut" },
        ],
        userId,
      });
    }

    await saveTestOut({ goal: current, progress, tx });

    return {
      id: progress.id,
      questions: questions.length,
      started: questions.length > 0 || skillIds.length > 0,
    };
  });

  if (!opened) {
    return { status: "invalid" };
  }

  if (opened.started) {
    trackTestEvents(goal, [
      {
        name: "Test Started",
        properties: {
          ...testEventContext(goal, {
            attemptId: opened.id,
            questions: opened.questions || null,
            test: "level_test_out",
          }),
          level,
          resumed: false,
          row: "test_out",
        },
      },
    ]);
  }

  revalidateCacheTags([getGoalsCacheTag(userId)]);
  return getLanguageLevelTestOut({ attemptId: opened.id, goalId });
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

  const properties = await writeLearnerChange({ userId }, async (tx) => {
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

    return {
      ...testEventContext(current, {
        attemptId: testOut.id,
        questions: testOut.questions.length,
        test: "level_test_out",
      }),
      answer: gradedTestAnswer({ correct: graded.isCorrect, unknown: "dontKnow" in input.answer }),
      duration_ms: input.durationMs,
      kind: next.question.skill,
      level: testOut.level,
      question_number: answers.length + 1,
      skill_id: item.skillId,
    };
  });

  if (properties) {
    trackTestEvents(goal, [{ name: "Test Answered", properties }]);
  }

  return getLanguageLevelTestOut({ attemptId: input.attemptId, goalId });
}
