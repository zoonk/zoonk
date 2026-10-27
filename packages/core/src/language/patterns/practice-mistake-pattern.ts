import "server-only";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../cache/tags";
import { getLearnerTimeZone } from "../../learner/_utils/goal-time-zone";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { celebrateProgress } from "../../milestones/celebrate-progress";
import { applySessionProgress } from "../../sessions/_utils/session-progress";
import { getAnswersEnergyDelta, scoreAnswers } from "../../sessions/brain-power";
import { saveDayBeforeActivity } from "../../sessions/ensure-study-session";
import { withActivityMissionMoment } from "../../sessions/missions/activity-mission-result";
import { settleLearnerMissions } from "../../sessions/missions/settle-learner-missions";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { recordLearningEvent } from "../../stats/record-learning-event";
import { getSession } from "../../users/get-session";
import { findOwnedPattern } from "./get-mistake-pattern";
import {
  type MistakePatternPracticeInput,
  type MistakePatternPracticeResult,
} from "./pattern-contract";

/** A three-minute drill, counted as its answers' time in today's totals. */
const DRILL_SECONDS = 180;

export type PracticeMistakePatternResult =
  | { result: MistakePatternPracticeResult; status: "ready" }
  | { status: "invalid" | "notFound" | "unauthorized" };

/**
 * Finishes the three-minute drill of a pattern: each answer is checked against the drill, the drill
 * pays Brain Power like any practice (less when repeated) and counts toward today, and the pattern
 * leaves Today once practiced. The same drill sent again (`requestId`, a retry after a lost
 * response) returns what it already counted.
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

  // Once the drill counts, a day planned after it no longer offers it: today's is saved first.
  await saveDayBeforeActivity({ goalId: row.goalId, timeZone: input.timeZone, userId });

  const timeZone = await getLearnerTimeZone({ timeZone: input.timeZone, userId });
  const incorrect = verdicts.length - correct;

  const counted = await writeLearnerChange({ userId }, async (tx) => {
    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });

    // The progress lock serializes a double submit: the second one finds the first's row. The id
    // names this pattern's drill; another pattern sent with it is its own drill.
    const earlier = await tx.learningEvent.findFirst({
      where: {
        AND: [
          { contentIds: { equals: input.requestId, path: ["patternDrillId"] } },
          { contentIds: { equals: row.id, path: ["mistakePatternId"] } },
        ],
        userId,
      },
    });

    if (earlier) {
      return unchanged({ event: earlier, progress: null, retry: true });
    }

    const energyDelta = getAnswersEnergyDelta({ correct, incorrect });

    const progress = await applySessionProgress(tx, {
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

    const recorded = await recordLearningEvent(tx, {
      brainPower,
      contentIds: { mistakePatternId: row.id, patternDrillId: input.requestId },
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

    return { event: recorded, progress, retry: false };
  });

  const { event } = counted;
  const source = { id: event.id, kind: "patternDrill" };

  const celebration = await celebrateProgress({
    progress: counted.progress,
    settleDay: () => settleLearnerMissions({ source, timeZone, userId }),
    userId,
  });

  revalidateCacheTags([getUserProgressCacheTag(userId)]);

  if (!counted.retry) {
    await trackLearnerEvents({
      events: [
        { name: "Mistake Pattern Practiced", properties: { correct, questions: verdicts.length } },
      ],
      goalId: row.goalId,
      userId,
    });
  }

  return {
    result: await withActivityMissionMoment({
      result: {
        ...celebration,
        brainPower: event.brainPower,
        correct: event.correctAnswers,
        total: event.correctAnswers + event.incorrectAnswers,
      },
      source,
      timeZone,
      userId,
    }),
    status: "ready",
  };
}
