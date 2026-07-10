import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { type Chapter } from "@zoonk/db";
import { addCategoriesStep } from "../steps/add-categories-step";
import { addChaptersStep } from "../steps/add-chapters-step";
import { type CourseContext } from "../steps/initialize-course-step";
import { updateCourseStep } from "../steps/update-course-step";
import { type ExistingCourseContent } from "./existing-course-content";
import { type GeneratedContent } from "./generate-missing-content";

async function emitSkippedPersistSteps({
  needsCategories,
  needsChapters,
  needsCourseUpdate,
}: {
  needsCategories: boolean;
  needsChapters: boolean;
  needsCourseUpdate: boolean;
}) {
  if (!needsCourseUpdate) {
    await streamSkipStep("updateCourse");
  }

  if (!needsCategories) {
    await streamSkipStep("addCategories");
  }

  if (!needsChapters) {
    await streamSkipStep("addChapters");
  }
}

/**
 * A missing landing page only means the course update is incomplete when new
 * generated landing copy exists. Language courses intentionally return null
 * landing content, so they should not keep scheduling metadata updates after
 * description and image are already saved.
 */
function needsLandingPageUpdate({
  content,
  existing,
}: {
  content: GeneratedContent;
  existing: ExistingCourseContent;
}) {
  return Boolean(content.landingPage && !existing.landingPage);
}

/**
 * Decides whether the course row still needs generated metadata persisted. This
 * keeps the idempotency check aligned with nullable landing-page content
 * instead of treating every language course as permanently incomplete.
 */
function needsCourseMetadataUpdate({
  content,
  existing,
}: {
  content: GeneratedContent;
  existing: ExistingCourseContent;
}) {
  return (
    !existing.description || !existing.imageUrl || needsLandingPageUpdate({ content, existing })
  );
}

/**
 * Regular courses reserve position zero for the intro chapter forever. Language
 * courses do not have this generated intro, so their normal curriculum starts at
 * the current append offset.
 */
function getMainChapterPositionOffset({
  course,
  existing,
}: {
  course: CourseContext;
  existing: ExistingCourseContent;
}): number {
  if (course.format === "language") {
    return existing.chapterCount;
  }

  return 1;
}

export async function persistGeneratedContent(
  course: CourseContext,
  content: GeneratedContent,
  existing: ExistingCourseContent,
): Promise<Chapter[]> {
  const needsCourseUpdate = needsCourseMetadataUpdate({ content, existing });

  const needsCategories = !existing.hasCategories && content.categories.length > 0;

  const needsChapters = !existing.hasMainCurriculum && content.chapters.length > 0;

  await emitSkippedPersistSteps({ needsCategories, needsChapters, needsCourseUpdate });

  const metadataOps = [
    needsCourseUpdate &&
      updateCourseStep({
        course,
        description: content.description,
        imageUrl: content.imageUrl,
        landingPage: content.landingPage,
      }),
    needsCategories && addCategoriesStep({ categories: content.categories, course }),
  ].filter(Boolean);

  const [chapters] = await Promise.all([
    needsChapters
      ? addChaptersStep({
          chapters: content.chapters,
          course,
          positionOffset: getMainChapterPositionOffset({ course, existing }),
        })
      : Promise.resolve<Chapter[]>([]),
    ...metadataOps,
  ]);

  return chapters;
}
