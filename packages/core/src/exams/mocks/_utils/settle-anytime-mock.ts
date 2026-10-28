import "server-only";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { awardMilestones } from "../../../milestones/award-milestones";
import {
  type ProgressChange,
  applySessionProgress,
} from "../../../sessions/_utils/session-progress";
import { getAnswersEnergyDelta, scoreAnswers } from "../../../sessions/brain-power";
import { getCompletionEnergyContext } from "../../../stats/completion-energy";
import { recordLearningEvent } from "../../../stats/record-learning-event";
import { type GradedMockAnswer } from "../mock-analysis";
import { type MockSitting } from "./owned-mock";

const MS_PER_SECOND = 1000;

export async function settleAnytimeMock({
  graded,
  mock,
  timeZone,
}: {
  graded: readonly GradedMockAnswer[];
  mock: MockSitting;
  timeZone: string;
}): Promise<{ brainPower: ProgressChange; energy: ProgressChange } | null> {
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

  const progress = await writeLearnerChange({ userId: mock.userId }, async (tx) => {
    const lock = await getCompletionEnergyContext({
      timeZone,
      transaction: tx,
      userId: mock.userId,
    });

    const settled = await tx.learningEvent.findFirst({
      select: { id: true },
      where: {
        contentIds: { equals: mock.id, path: ["mockExamId"] },
        kind: "mock",
        userId: mock.userId,
      },
    });

    if (settled) {
      return unchanged(null);
    }

    const applied = await applySessionProgress(tx, {
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

    return applied;
  });

  if (progress) {
    await awardMilestones({ brainPower: progress.brainPower, userId: mock.userId });
  }

  return progress;
}
