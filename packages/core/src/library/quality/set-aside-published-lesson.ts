import "server-only";
import { markLockedPlanInputsChanged } from "@zoonk/db/learner-writes";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLibraryLessonCacheTag } from "../../cache/tags";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import {
  moveOnWithoutLesson,
  readHeldPlanIds,
  refreshPlansWithoutLesson,
} from "../generation/hold-back-lesson";
import {
  CURRENT_STEPS,
  lockCurrentLessonVersion,
  readStagedLessonVersion,
  retireUnaskedQuestions,
} from "../lessons/lesson-versions";

class PublishedLessonReplacedError extends Error {
  override name = "PublishedLessonReplacedError";
}

/** Returns false if `version` was replaced or has a fix staged; callers must leave the newer version playable. */
export async function setAsidePublishedLesson({
  lessonId,
  version,
}: {
  lessonId: string;
  version: number;
}): Promise<boolean> {
  const holdKey = `${lessonId}:published:${version}`;

  const { data: heldBack, error } = await safeAsync(() =>
    writePlanInputs(async (tx) => {
      const existing = await tx.step.findFirst({
        select: { lesson: { select: { contentStatus: true, setAsideAt: true } }, version: true },
        where: { lessonId, ...CURRENT_STEPS },
      });

      if (existing?.version !== version) {
        return null;
      }

      if (existing.lesson.contentStatus !== "completed") {
        return existing.lesson.setAsideAt
          ? { changed: false, planIds: await readHeldPlanIds(tx, holdKey) }
          : null;
      }

      const dependentPlanIds = await lockPlanSourceWrite(tx, { lessonIds: [lessonId] });
      await markLockedPlanInputsChanged(tx, { planIds: dependentPlanIds });

      if (
        (await lockCurrentLessonVersion(tx, lessonId)) !== version ||
        (await readStagedLessonVersion(lessonId, tx))
      ) {
        throw new PublishedLessonReplacedError();
      }

      await tx.lesson.update({
        data: { contentStatus: "failed", setAsideAt: new Date() },
        where: { id: lessonId },
      });

      await retireUnaskedQuestions(tx, { lessonId });
      return { changed: true, planIds: await moveOnWithoutLesson(tx, lessonId, holdKey) };
    }),
  );

  if (error instanceof PublishedLessonReplacedError) {
    return false;
  }

  if (error) {
    throw error;
  }

  if (!heldBack) {
    return false;
  }

  const userIds = await refreshPlansWithoutLesson(heldBack.planIds);

  revalidateCacheTags([
    getLibraryLessonCacheTag(lessonId),
    ...userIds.map((userId) => getGoalsCacheTag(userId)),
  ]);

  return heldBack.changed;
}
