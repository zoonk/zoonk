import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../cache/tags";
import { getLearnerTimeZone } from "../../learner/_utils/goal-time-zone";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { celebrateProgress } from "../../milestones/celebrate-progress";
import { pausedBlockTiming } from "../../sessions/_utils/block-timing";
import { isCurrentSession } from "../../sessions/_utils/current-session";
import { applySessionProgress } from "../../sessions/_utils/session-progress";
import { STUDY_SESSION_INCLUDE } from "../../sessions/_utils/study-session-access";
import { readBlockPayload } from "../../sessions/block-payload";
import { getAnswersEnergyDelta, scoreAnswers } from "../../sessions/brain-power";
import { findActivityGoal, saveDayBeforeActivity } from "../../sessions/ensure-study-session";
import { withActivityMissionMoment } from "../../sessions/missions/activity-mission-result";
import { settleLearnerMissions } from "../../sessions/missions/settle-learner-missions";
import { oweDaySettlement } from "../../sessions/settle-owed-session-day";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { recordLearningEvent } from "../../stats/record-learning-event";
import { getSession } from "../../users/get-session";
import { findOwnedPattern } from "./get-mistake-pattern";
import {
  type MistakePatternPracticeInput,
  type MistakePatternPracticeResult,
  PATTERN_DRILL_SECONDS,
} from "./pattern-contract";

export type PracticeMistakePatternResult =
  | { result: MistakePatternPracticeResult; status: "ready" }
  | { status: "invalid" | "notFound" | "unauthorized" };

/**
 * The goal a drill counts for: the one that noticed its pattern, or the goal Today shows once that
 * one is paused, finished or removed, so one drill completes one goal's mission.
 */
async function findDrillGoalId({
  language,
  ownerId,
  userId,
}: {
  language: string;
  ownerId: string | null;
  userId: string;
}): Promise<string | null> {
  const owner = ownerId
    ? await prisma.goal.findFirst({
        select: { id: true },
        where: { id: ownerId, status: "active" },
      })
    : null;

  if (owner) {
    return owner.id;
  }

  const goal = await findActivityGoal({ language, userId });
  return goal?.id ?? ownerId;
}

async function completePatternBlock(
  tx: TransactionClient,
  {
    goalId,
    now,
    patternId,
    timeZone,
    userId,
  }: { goalId: string | null; now: Date; patternId: string; timeZone: string; userId: string },
) {
  const today = getDateInTimeZone({ date: now, timeZone });
  const yesterday = new Date(today.getTime() - MS_PER_DAY);

  const candidates = await tx.studySessionBlock.findMany({
    include: { session: { include: STUDY_SESSION_INCLUDE } },
    orderBy: [{ startedAt: { nulls: "last", sort: "desc" } }, { session: { localDate: "desc" } }],
    where: {
      kind: "practice",
      payload: { equals: patternId, path: ["patternId"] },
      session: { goalId, localDate: { in: [today, yesterday] }, userId },
      status: { in: ["active", "pending"] },
    },
  });

  const block = candidates.find(({ session }) => isCurrentSession({ now, session, timeZone }));

  if (!block) {
    return;
  }

  const { count } = await tx.studySessionBlock.updateMany({
    data: {
      completedAt: now,
      payload: { ...readBlockPayload(block), timing: pausedBlockTiming({ block, now }) },
      startedAt: block.startedAt ?? now,
      status: "completed",
    },
    where: { id: block.id, status: { in: ["active", "pending"] } },
  });

  if (count > 0) {
    await oweDaySettlement(tx, { block, timeZone, userId });
  }
}

/** Reusing a `requestId` replays the already-counted drill. */
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

  const [goalId] = await Promise.all([
    findDrillGoalId({ language: row.language, ownerId: row.goalId, userId }),
    saveDayBeforeActivity({ language: row.language, timeZone: input.timeZone, userId }),
  ]);

  const timeZone = await getLearnerTimeZone({ timeZone: input.timeZone, userId });
  const incorrect = verdicts.length - correct;

  const counted = await writeLearnerChange({ userId }, async (tx) => {
    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });

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
        seconds: PATTERN_DRILL_SECONDS,
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
      goalId,
      incorrectAnswers: incorrect,
      kind: "questions",
      lessonKind: "patternDrill",
      seconds: PATTERN_DRILL_SECONDS,
      startedAt: lock.completedAt,
      timeZone,
      titleSnapshot: row.title,
      userId,
    });

    await tx.mistakePattern.update({
      data: { practicedAt: lock.completedAt },
      where: { id: row.id },
    });

    await completePatternBlock(tx, {
      goalId,
      now: lock.completedAt,
      patternId: row.id,
      timeZone,
      userId,
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
