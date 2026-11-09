import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { citeScreens } from "../lessons/_utils/checked-version";
import { loadPublishedLessonInputs } from "../lessons/_utils/lesson-writing-inputs";
import { CURRENT_STEPS } from "../lessons/lesson-versions";
import { type LessonCheckPlan } from "../lessons/write-lesson-content";
import { BACKGROUND_TIER, type CheckContext, toTaskAnalytics } from "./_utils/published-versions";

/** Internal workflow bridge; a failed citation call throws so the workflow step can retry. */
export async function citePublishedLesson({
  plan,
  ...context
}: CheckContext & { plan: Pick<LessonCheckPlan, "lesson" | "version"> }): Promise<number> {
  const inputs = await loadPublishedLessonInputs(context.lessonId);

  if (!inputs) {
    return 0;
  }

  const citations = await citeScreens({
    analytics: await toTaskAnalytics(context),
    inputs,
    lesson: plan.lesson,
    serviceTier: BACKGROUND_TIER,
  });

  const cited = citations.flatMap((citation, position) =>
    citation ? [{ citation, position }] : [],
  );

  const updates = await prisma.$transaction(
    cited.map(({ citation, position }) =>
      prisma.step.updateMany({
        data: { sourceId: citation.sourceId, sourcePage: citation.page },
        where: { lessonId: context.lessonId, position, version: plan.version, ...CURRENT_STEPS },
      }),
    ),
  );

  const count = updates.reduce((total, update) => total + update.count, 0);

  if (count > 0) {
    revalidateCacheTags([getLibraryLessonCacheTag(context.lessonId)]);
  }

  return count;
}
