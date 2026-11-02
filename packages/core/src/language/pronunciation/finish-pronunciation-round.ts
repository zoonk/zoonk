import "server-only";
import { type LearningEvent, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../cache/tags";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { celebrateProgress } from "../../milestones/celebrate-progress";
import { applySessionProgress } from "../../sessions/_utils/session-progress";
import { getAnswersEnergyDelta, scoreAnswers } from "../../sessions/brain-power";
import { withActivityMissionMoment } from "../../sessions/missions/activity-mission-result";
import { settleLearnerMissions } from "../../sessions/missions/settle-learner-missions";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { recordLearningEvent } from "../../stats/record-learning-event";
import { getSession } from "../../users/get-session";
import {
  type PronunciationRoundInput,
  type PronunciationRoundResult,
} from "./pronunciation-contract";

const MS_PER_SECOND = 1000;

export type FinishPronunciationRoundResult =
  | { result: PronunciationRoundResult; status: "ready" }
  | { status: "invalid" | "notFound" | "unauthorized" };

type RoundAnswer = { answeredAt: Date; durationMs: number; isCorrect: boolean };

function getRoundSeconds(answers: readonly RoundAnswer[]): number {
  const first = answers[0];
  const last = answers.at(-1);
  const spoken = answers.reduce((total, answer) => total + answer.durationMs, 0);

  if (!first || !last) {
    return 0;
  }

  const span = last.answeredAt.getTime() - first.answeredAt.getTime() + last.durationMs;

  return Math.round(Math.max(spoken, span) / MS_PER_SECOND);
}

function toRoundResult(
  event: Pick<LearningEvent, "brainPower" | "correctAnswers" | "incorrectAnswers">,
): Omit<PronunciationRoundResult, "ceremony" | "missionMoment" | "reached"> {
  return {
    brainPower: event.brainPower,
    correct: event.correctAnswers,
    total: event.correctAnswers + event.incorrectAnswers,
  };
}

/** Retrying the same round returns its already-counted result. */
export async function finishPronunciationRound({
  input,
  roundId,
}: {
  input: PronunciationRoundInput;
  roundId: string;
}): Promise<FinishPronunciationRoundResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  if (!isUuid(roundId)) {
    return { status: "notFound" };
  }

  const owned = await findOwnedGoal(input.goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const answers = await prisma.attempt.findMany({
    orderBy: { answeredAt: "asc" },
    select: { answeredAt: true, durationMs: true, isCorrect: true },
    where: { answer: { equals: roundId, path: ["roundId"] }, userId },
  });

  if (answers.length === 0) {
    return { status: "invalid" };
  }

  const correct = answers.filter((answer) => answer.isCorrect).length;
  const incorrect = answers.length - correct;
  const seconds = getRoundSeconds(answers);

  const { brainPower } = scoreAnswers({
    answers: answers.map((answer) => ({
      isCorrect: answer.isCorrect,
      material: "due" as const,
      priorRightAnswers: 0,
    })),
  });

  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });

  const settled = await writeLearnerChange({ userId }, async (tx) => {
    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });

    const counted = await tx.learningEvent.findFirst({
      where: { contentIds: { equals: roundId, path: ["pronunciationRoundId"] }, userId },
    });

    if (counted) {
      return unchanged({ event: counted, progress: null });
    }

    const energyDelta = getAnswersEnergyDelta({ correct, incorrect });

    const progress = await applySessionProgress(tx, {
      completion: true,
      delta: {
        brainPower,
        correctAnswers: correct,
        energyDelta,
        incorrectAnswers: incorrect,
        seconds,
      },
      lock,
      userId,
    });

    const recorded = await recordLearningEvent(tx, {
      brainPower,
      contentIds: { pronunciationRoundId: roundId },
      correctAnswers: correct,
      endedAt: lock.completedAt,
      energyDelta,
      goalId: owned.goal.id,
      incorrectAnswers: incorrect,
      kind: "review",
      lessonKind: "pronunciationReview",
      seconds,
      startedAt: answers[0]?.answeredAt ?? lock.completedAt,
      timeZone,
      titleSnapshot: null,
      userId,
    });

    return { event: recorded, progress };
  });

  const source = { id: roundId, kind: "pronunciationRound" };

  const celebration = await celebrateProgress({
    progress: settled.progress,
    settleDay: () => settleLearnerMissions({ source, timeZone, userId }),
    userId,
  });

  revalidateCacheTags([getUserProgressCacheTag(userId)]);

  return {
    result: await withActivityMissionMoment({
      result: { ...toRoundResult(settled.event), ...celebration },
      source,
      timeZone,
      userId,
    }),
    status: "ready",
  };
}
