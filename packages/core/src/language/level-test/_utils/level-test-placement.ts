import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { safeAsync } from "@zoonk/utils/error";
import { awardCourseCertificates } from "../../../certificates/_utils/award-course-certificate";
import { awardLanguageLevelCertificates } from "../../../certificates/_utils/award-language-certificates";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { announceTestedOutItems } from "../../../plans/announce-tested-out-items";
import { isPlanConflictError } from "../../../plans/plan-conflict";
import { type LevelTestProgress } from "../level-test-contract";
import { getBand } from "../level-test-rules";
import { readLevelTestAttempts } from "../read-level-test-summary";
import {
  canWriteLevelTest,
  levelTestDetailsWithProgress,
  readLevelTestProgress,
} from "./level-test-state";

type ResultPlacement = NonNullable<LevelTestProgress["placement"]>;

class PlacementAnnouncedError extends Error {
  override name = "PlacementAnnouncedError";
}

export async function skipConfirmedLanguageLessons({
  through,
  goalId,
  now,
  topicIds,
  tx,
}: {
  through: CefrLevel | null;
  topicIds?: ReadonlySet<string>;
  goalId: string;
  now: Date;
  tx: TransactionClient;
}): Promise<string[]> {
  if (!through || topicIds?.size === 0) {
    return [];
  }

  const items = await tx.planItem.findMany({
    select: {
      id: true,
      lesson: {
        select: { skills: { select: { skill: { select: { cefrLevel: true, id: true } } } } },
      },
    },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  const ids = items.flatMap(({ id, lesson }) => {
    const topics = lesson?.skills ?? [];

    return topics.length > 0 &&
      topics.every(
        ({ skill }) =>
          skill.cefrLevel !== null &&
          getBand(skill.cefrLevel) <= getBand(through) &&
          (topicIds === undefined || topicIds.has(skill.id)),
      )
      ? [id]
      : [];
  });

  if (ids.length === 0) {
    return [];
  }

  const finished = await tx.planItem.updateManyAndReturn({
    data: { completedAt: now, status: "testedOut" },
    select: { id: true, kind: true, phase: true, planId: true },
    where: { id: { in: ids }, status: "todo" },
  });

  await awardLanguageLevelCertificates(tx, { finished });
  await awardCourseCertificates(tx, { finished });

  return finished.map(({ id }) => id);
}

async function clearAnnounced({
  attemptId,
  changeId,
  goalId,
  placement,
  tx,
}: {
  attemptId?: string;
  changeId: string | null;
  goalId: string;
  placement: ResultPlacement;
  tx: TransactionClient;
}): Promise<boolean> {
  const goal = await tx.goal.findUnique({ where: { id: goalId } });
  const progress = goal && readLevelTestProgress(goal, attemptId);

  if (
    !goal ||
    !progress?.placement ||
    !canWriteLevelTest(goal, progress) ||
    !isDeepStrictEqual(progress.placement, placement)
  ) {
    return false;
  }

  const result = progress.result && { ...progress.result, changeId };

  const details = levelTestDetailsWithProgress(goal, {
    ...progress,
    placement: { ...placement, pastBasicsAreas: [], unannounced: [] },
    result,
  });

  const { lastResult } = readLevelTestAttempts(goal);
  const latest = isDeepStrictEqual(lastResult, progress.result) ? result : lastResult;

  await tx.goal.update({
    data: {
      details: {
        ...details,
        levelTest: { ...details.levelTest, ...(latest && { lastResult: latest }) },
      },
    },
    where: { id: goalId },
  });

  return true;
}

export async function announceLevelTestPlacement({
  goal,
  placement,
  attemptId,
  timeZone,
}: {
  attemptId?: string;
  goal: Pick<Goal, "id" | "userId">;
  placement: ResultPlacement;
  timeZone: string;
}) {
  const { id: goalId, userId } = goal;
  const { unannounced } = placement;

  if (unannounced.length === 0) {
    return true;
  }

  const { data, error } = await safeAsync(() =>
    announceTestedOutItems({
      extraWrites: async (tx, changeId) => {
        if (!(await clearAnnounced({ attemptId, changeId, goalId, placement, tx }))) {
          throw new PlacementAnnouncedError();
        }
      },
      followToday: false,
      goalId,
      now: new Date(),
      planItemIds: unannounced,
      skipBlocks: false,
      testReceipt: `levelTest:${attemptId ?? "onboarding"}`,
      timeZone,
    }),
  );

  if (error instanceof PlacementAnnouncedError || data) {
    return true;
  }

  if (isPlanConflictError(error)) {
    return false;
  }

  if (error) {
    throw error;
  }

  await writeLearnerChange({ userId }, async (tx) =>
    (await clearAnnounced({ attemptId, changeId: null, goalId, placement, tx }))
      ? null
      : unchanged(null),
  );

  return true;
}
