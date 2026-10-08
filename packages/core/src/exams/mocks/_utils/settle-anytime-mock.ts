import "server-only";
import { prisma } from "@zoonk/db";
import { applySessionProgress } from "../../../sessions/_utils/session-progress";
import { getAnswersEnergyDelta, scoreAnswers } from "../../../sessions/brain-power";
import { getCompletionEnergyContext } from "../../../stats/completion-energy";
import { recordLearningEvent } from "../../../stats/record-learning-event";
import { type GradedMockAnswer } from "../mock-analysis";
import { type MockSitting } from "./owned-mock";

const MS_PER_SECOND = 1000;

/**
 * A mock taken any time counts like the rest of the learner's study, once: its right answers earn
 * Brain Power (each question is new to them, Hyperdrive building as in a session), its answers
 * move Energy, its time counts for the day, and one ledger row of kind `mock` lets preparation
 * read it like the plan's mocks. It has no session block, so no checkpoint bonus: taking mocks
 * again and again earns what their answers earn.
 */
export async function settleAnytimeMock({
  graded,
  mock,
  timeZone,
}: {
  graded: readonly GradedMockAnswer[];
  mock: MockSitting;
  timeZone: string;
}): Promise<void> {
  const correct = graded.filter((answer) => answer.outcome === "right").length;
  const incorrect = graded.length - correct;

  const seconds = Math.round(
    graded.reduce((sum, answer) => sum + answer.durationMs, 0) / MS_PER_SECOND,
  );

  const energyDelta = getAnswersEnergyDelta({ correct, incorrect });

  const { brainPower } = scoreAnswers({
    answers: graded.map((answer) => ({
      isCorrect: answer.outcome === "right",
      material: "new" as const,
      priorRightAnswers: 0,
    })),
  });

  await prisma.$transaction(async (tx) => {
    const lock = await getCompletionEnergyContext({
      timeZone,
      transaction: tx,
      userId: mock.userId,
    });

    // A finish that stopped after its ledger row was written grades the rest without a second one.
    const settled = await tx.learningEvent.findFirst({
      select: { id: true },
      where: {
        contentIds: { equals: mock.id, path: ["mockExamId"] },
        kind: "mock",
        userId: mock.userId,
      },
    });

    if (settled) {
      return;
    }

    await applySessionProgress(tx, {
      completion: true,
      delta: {
        brainPower,
        correctAnswers: correct,
        energyDelta,
        incorrectAnswers: incorrect,
        seconds,
      },
      lock,
      userId: mock.userId,
    });

    await recordLearningEvent(tx, {
      brainPower,
      contentIds: { mockExamId: mock.id },
      correctAnswers: correct,
      endedAt: lock.completedAt,
      energyDelta,
      goalId: mock.goalId,
      incorrectAnswers: incorrect,
      kind: "mock",
      lessonKind: mock.conditions.purpose === "placement" ? "placementMock" : "anytimeMock",
      seconds,
      startedAt: mock.startedAt,
      timeZone,
      titleSnapshot: null,
      userId: mock.userId,
    });
  });
}
