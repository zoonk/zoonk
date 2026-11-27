import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type TestEventContext } from "../../analytics/test-event-catalog";
import { testEventContext } from "../../analytics/test-events";
import {
  LANGUAGE_LEVEL_TEST_OFFER,
  type LevelTestResult,
} from "../../language/level-test/level-test-contract";
import {
  readLevelTestAttempts,
  readLevelTestDetails,
} from "../../language/level-test/read-level-test-summary";
import {
  getAttemptParts,
  getCourseOffer,
  readPlacementAttempt,
} from "../../learner/placement/_utils/placement-attempt-record";
import {
  readPlacementCourse,
  readPlacementNextLesson,
} from "../../learner/placement/_utils/placement-result";
import { levelTestOutReceipt, levelTestReceipt, placementPartReceipt } from "./test-out-receipt";

function clearResult(result: LevelTestResult | undefined, receipt: string) {
  return result && levelTestReceipt(result.attemptId) === receipt
    ? { ...result, changeId: null, lessonsSkipped: 0, levelsSkipped: [] }
    : result;
}

function restoreLevelTest(details: Goal["details"], receipt: string) {
  const goal = { details };
  const { attempt, completedAttempt, lastResult, testOut } = readLevelTestAttempts(goal);
  const levelTest = readLevelTestDetails(goal);

  if (testOut?.result && levelTestOutReceipt(testOut.id) === receipt) {
    return {
      ...levelTest,
      testOut: { ...testOut, result: { ...testOut.result, planItemIds: [], topicsSkipped: [] } },
    };
  }

  const result = attempt?.result && clearResult(attempt.result, receipt);
  const completed = completedAttempt?.result && clearResult(completedAttempt.result, receipt);
  const latest = clearResult(lastResult, receipt);

  if (
    result === attempt?.result &&
    completed === completedAttempt?.result &&
    latest === lastResult
  ) {
    return null;
  }

  return {
    ...levelTest,
    ...(attempt && result && { attempt: { ...attempt, result } }),
    ...(completedAttempt &&
      completed && { completedAttempt: { ...completedAttempt, result: completed } }),
    ...(latest && { lastResult: latest }),
  };
}

async function restorePlacement({
  details,
  goalId,
  lessonsSkipped,
  receipt,
  tx,
}: {
  details: unknown;
  goalId: string;
  lessonsSkipped: number;
  receipt: string;
  tx: TransactionClient;
}) {
  const { attempt, finishedParts, result, ...rest } = readPlacementAttempt({ details });
  const attemptId = attempt?.id ?? result?.attemptId;
  const [receiptId] = receipt.split(":");

  const part =
    attemptId && attemptId === receiptId
      ? finishedParts.find(
          (finished) =>
            placementPartReceipt(
              attemptId,
              finished.part,
              finished.finish?.end === "stopped" ? finished.finish.answered : undefined,
            ) === receipt,
        )
      : undefined;

  const nextLesson =
    result?.attemptId === receiptId ? await readPlacementNextLesson(goalId, tx) : null;

  const updatedResult =
    result && result.attemptId === receiptId
      ? {
          ...result,
          lessonsSkipped: Math.max(0, result.lessonsSkipped - lessonsSkipped),
          ...(result.startedPastSkillIds && {
            chapter: nextLesson?.chapter ?? result.chapter,
            course: await readPlacementCourse(goalId, new Set(), tx),
            startedPastSkillIds: [],
          }),
          nextLesson,
        }
      : result;

  if (!part && updatedResult === result) {
    return null;
  }

  return {
    ...rest,
    attempt:
      attempt && part
        ? { ...attempt, lessonsSkipped: Math.max(0, attempt.lessonsSkipped - lessonsSkipped) }
        : attempt,
    finishedParts: finishedParts.map((finished) =>
      finished === part ? { ...finished, lessonsSkipped: 0, testedOutPlanItemIds: [] } : finished,
    ),
    result: updatedResult,
  };
}

function testContextFromReceipt({
  details,
  goal,
  receipt,
}: {
  details: Goal["details"];
  goal: Parameters<typeof testEventContext>[0];
  receipt: string;
}): TestEventContext {
  const [kindOrId, value] = receipt.split(":");

  if (kindOrId === "levelTestOut") {
    const { testOut } = readLevelTestAttempts({ details });

    return testEventContext(goal, {
      attemptId: value,
      questions: testOut && testOut.id === value ? testOut.questions.length : null,
      test: "level_test_out",
    });
  }

  if (kindOrId === "levelTest") {
    return testEventContext(goal, {
      attemptId: value === "onboarding" ? null : value,
      questions: LANGUAGE_LEVEL_TEST_OFFER.total,
      test: "language",
    });
  }

  const { attempt } = readPlacementAttempt({ details });
  const parts = attempt && attempt.id === kindOrId ? getAttemptParts(attempt) : null;
  const part = Number(value) || 1;

  return testEventContext(goal, {
    attemptId: kindOrId,
    part,
    parts: parts?.length ?? null,
    questions: getCourseOffer(parts?.[part - 1]?.length ?? 0)?.questions ?? null,
    test: "course",
  });
}

export async function undoTestOutResult({
  goal,
  receipt,
  lessonsSkipped,
  tx,
}: {
  goal: Pick<Goal, "id" | "planRevealedAt" | "userId">;
  receipt: string;
  lessonsSkipped: number;
  tx: TransactionClient;
}): Promise<TestEventContext | null> {
  const { id: goalId } = goal;

  const { details } = await tx.goal.findUniqueOrThrow({
    select: { details: true },
    where: { id: goalId },
  });

  if (!isJsonObject(details)) {
    return null;
  }

  const languageReceipt = receipt.startsWith("levelTest");

  const result = languageReceipt
    ? restoreLevelTest(details, receipt)
    : await restorePlacement({ details, goalId, lessonsSkipped, receipt, tx });

  if (result) {
    await tx.goal.update({
      data: { details: { ...details, [languageReceipt ? "levelTest" : "placementTest"]: result } },
      where: { id: goalId },
    });
  }

  return testContextFromReceipt({ details, goal, receipt });
}
