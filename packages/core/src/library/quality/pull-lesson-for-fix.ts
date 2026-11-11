import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { markPlanSourcesChanged } from "../../learner/_utils/mark-learner-changed";
import { resolvePlanInputDependents } from "../../plans/_utils/plan-input-dependencies";

class LessonPullLostError extends Error {
  override name = "LessonPullLostError";
}

export async function pullLessonForFix(lessonId: string): Promise<boolean> {
  const { data: pulled, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      const current = await tx.lesson.findFirst({
        include: { skills: { select: { skillId: true } } },
        omit: { spec: true, summary: true },
        where: { contentStatus: "completed", id: lessonId },
      });

      if (!current) {
        return false;
      }

      const planIds = await resolvePlanInputDependents(tx, {
        lessonIds: [lessonId],
        skillIds: current.skills.map(({ skillId }) => skillId),
      });

      await markPlanSourcesChanged(tx, { planIds });

      const { count } = await tx.lesson.updateMany({
        data: { contentStatus: "failed" },
        where: { contentStatus: "completed", id: lessonId },
      });

      if (count === 0) {
        throw new LessonPullLostError();
      }

      return true;
    }),
  );

  if (error instanceof LessonPullLostError) {
    return false;
  }

  if (error) {
    throw error;
  }

  if (pulled) {
    revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  }

  return pulled;
}
